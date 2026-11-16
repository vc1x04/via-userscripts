// ==UserScript==
// @name         GOG 购物车一键清空
// @namespace    https://viayoo.com/
// @version      1.5.1
// @description  在 GOG 购物车（结算页）添加「一键清空」按钮，确认后逐项移除商品并刷新
// @author       you
// @run-at       document-end
// @homepageURL  https://github.com/vc1x04/via-userscripts
// @supportURL   https://github.com/vc1x04/via-userscripts/issues
// @match        *://www.gog.com/checkout*
// @match        *://www.gog.com/*/checkout*
// @match        *://www.gog.com/cart
// @match        *://www.gog.com/*/cart
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* 页面是 JSON（比如误把 /cart 接口当页面打开），直接不动作 */
  if (document.body && /^\s*\{\s*"checksum"/.test((document.body.textContent || '').slice(0, 200))) return;

  var BTN_ID = 'gog-clear-cart-btn';
  var running = false;
  var refreshTimer = null;
  var fetching = false;
  var btn = null;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- 购物车数据 ---------------- */

  function cartIds(data) {
    var cart = (data && data.cart) || {};
    var ids = [];
    Object.keys(cart).forEach(function (k) {
      var it = cart[k] || {};
      var id = it.id || it.productId || it.product_id;
      if (!id && /^\d+$/.test(k)) id = k; // 兼容以商品 id 为键的返回
      id = String(id || '');
      if (id && /^\d+$/.test(id) && ids.indexOf(id) === -1) ids.push(id);
    });
    return ids;
  }

  function getCart() {
    return fetch('/cart', { credentials: 'same-origin', cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('读取购物车失败 HTTP ' + res.status);
      return res.json();
    });
  }

  function getCartIds() {
    return getCart().then(cartIds).catch(function (e) {
      console.warn('[GOG 清空购物车] 读取购物车失败', e);
      return null;   // null = 读取失败，别当成"购物车为空"
    });
  }

  /* ---------------- 移除单个商品 ---------------- */
  /* 同源接口，不额外加自定义请求头，避免触发预检 */
  function removeOne(id) {
    return fetch('/cart/remove/' + id, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) {
      if (res.ok || res.status === 404) return true; // 404 = 已不在购物车里
      throw new Error('移除商品 ' + id + ' 失败 HTTP ' + res.status);
    });
  }

  /* 备用通道：走结算接口返回的 removeLink（与网页自己"删除"按钮同一条路径） */
  function removeViaCheckoutApi() {
    var code = (window.gogData && window.gogData.currentCurrency && window.gogData.currentCurrency.code) || 'USD';
    var url = 'https://api.gog.com/v1/checkout?currencyCode=' + encodeURIComponent(code);
    return fetch(url, { credentials: 'include', cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(async function (data) {
        var items = (data && data.itemsInCart) || [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i] || {};
          if (!it.removeLink || it.productType === 'tip') continue;
          try {
            await fetch(it.removeLink, { method: 'DELETE', credentials: 'include' });
          } catch (e) { /* 忽略单件失败，最后统一校验 */ }
          await sleep(120);
        }
      })
      .catch(function (e) { console.warn('[GOG 清空购物车] 备用通道失败', e); });
  }

  /* ---------------- 界面 ---------------- */

  function injectStyle() {
    if (document.getElementById(BTN_ID + '-style')) return;
    var st = document.createElement('style');
    st.id = BTN_ID + '-style';
    st.textContent = [
      '#' + BTN_ID + '{position:fixed;right:14px;bottom:84px;z-index:99999;border:0;border-radius:12px;',
      'padding:11px 15px;font-size:15px;line-height:1.2;color:#fff;background:#7a9e2e;',
      'box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;',
      'cursor:pointer;font-family:inherit;touch-action:manipulation;}',
      '#' + BTN_ID + ':disabled{opacity:.65;}',
      '#' + BTN_ID + ' em{font-style:normal;background:rgba(255,255,255,.22);border-radius:6px;padding:1px 7px;font-size:12px;}',
      '.gog-cc-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:24px;}',
      '.gog-cc-box{width:100%;max-width:340px;background:#1b1b1b;color:#eee;border-radius:14px;padding:18px 16px;font-size:15px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.5);}',
      '.gog-cc-box p{margin:0 0 14px;white-space:pre-line;}',
      '.gog-cc-box .gog-cc-actions{display:flex;gap:10px;justify-content:flex-end;}',
      '.gog-cc-box button{border:0;border-radius:9px;padding:9px 16px;font-size:14px;cursor:pointer;font-family:inherit;touch-action:manipulation;}',
      '.gog-cc-cancel{background:#3a3a3a;color:#ddd;}',
      '.gog-cc-ok{background:#7a9e2e;color:#fff;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* 自绘确认/提示框，不依赖 window.confirm（部分 WebView 会吞掉） */
  function dialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'gog-cc-mask';
      var box = document.createElement('div');
      box.className = 'gog-cc-box';
      var p = document.createElement('p');
      p.textContent = message;
      box.appendChild(p);

      var actions = document.createElement('div');
      actions.className = 'gog-cc-actions';
      if (!opts.onlyOk) {
        var cancel = document.createElement('button');
        cancel.className = 'gog-cc-cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', function () { close(false); });
        actions.appendChild(cancel);
      }
      var ok = document.createElement('button');
      ok.className = 'gog-cc-ok';
      ok.textContent = opts.okText || '确定';
      ok.addEventListener('click', function () { close(true); });
      actions.appendChild(ok);
      box.appendChild(actions);
      mask.appendChild(box);
      document.body.appendChild(mask);

      function close(v) { mask.remove(); resolve(v); }
    });
  }

  function setLabel(b, text, badge) {
    if (!b) return;
    b.innerHTML = '<span>' + text + '</span>' + (badge ? '<em>' + badge + '</em>' : '');
  }

  function createButton() {
    var old = document.getElementById(BTN_ID);
    if (old) old.remove();
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.style.display = 'none';
    setLabel(b, '清空购物车', '');
    b.addEventListener('click', onClearClick);
    document.body.appendChild(b);
    return b;
  }

  /* ---------------- 数量角标 ---------------- */

  function refreshCount() {
    if (!btn || running || fetching) return;
    fetching = true;
    getCartIds().then(function (ids) {
      fetching = false;
      if (!btn || running || ids === null) return;
      if (ids.length) {
        btn.style.display = '';
        setLabel(btn, '清空购物车', String(ids.length));
      } else {
        btn.style.display = 'none';
      }
    });
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshCount, 1500);
  }

  /* ---------------- 清空主流程 ---------------- */

  /* 固定 6 路并发逐件移除；每件单独容错，失败的留给下一轮 */
  async function removeBatch(ids, concurrency) {
    var idx = 0, done = 0, total = ids.length;
    async function worker() {
      while (idx < total) {
        var i = idx++;
        try { await removeOne(ids[i]); } catch (e) { console.warn('[GOG 清空购物车]', e.message); }
        done++;
        setLabel(btn, '移除中', done + '/' + total);
      }
    }
    var ws = [];
    var n = Math.min(concurrency || 4, total);
    for (var k = 0; k < n; k++) ws.push(worker());
    await Promise.all(ws);
  }

  /* 回到不含订单号的购物车页：带订单号的地址刷新后会按那份订单渲染，看着像没清掉 */
  function goToCartPage() {
    var m = location.pathname.match(/^(.*\/checkout)(?:\/[^/]+)?\/?$/);
    var target = m ? m[1] : location.pathname;
    if (target === location.pathname) location.reload();
    else location.replace(location.origin + target + (location.search || ''));
  }

  /* 逐件移除 + 每轮结束回读校验：状态被并发写覆盖时，下一轮会把漏掉的再删一次 */
  async function clearAll(seedIds) {
    for (var round = 1; round <= 3; round++) {
      var ids = (round === 1 && seedIds && seedIds.length) ? seedIds : await getCartIds();
      if (ids === null) { await sleep(600); continue; }   // 读不到，下一轮再试
      if (ids.length) {
        setLabel(btn, round > 1 ? '再清一次' : '移除中', '0/' + ids.length);
        await removeBatch(ids, 6);         // 6 路并发：12 件约 2~3s（再多并发也受服务端串行限制）
      }
      await sleep(600);                    // 让在途写入落盘，再复核一次
      var left = await getCartIds();
      if (left === null) continue;
      if (!left.length) return left;
      // 非空：可能是被迟到的写入带回来了，再跑一轮
    }

    var rest = await getCartIds();
    if (rest === null) return null;
    if (rest.length) {
      setLabel(btn, '备用通道', '');
      await removeViaCheckoutApi();
      await sleep(900);
      return await getCartIds();
    }
    return rest;
  }

  async function onClearClick() {
    // 防重复：正在跑，或确认框还开着，就不再响应
    if (running || document.querySelector('.gog-cc-mask')) return;
    running = true;

    try {
      var ids = await getCartIds();
      if (ids === null) {
        await dialog('读取购物车失败，请稍后重试。', { onlyOk: true });
        return;
      }
      if (!ids.length) {
        await dialog('购物车已经是空的。', { onlyOk: true });
        return;
      }

      var go = await dialog('确定清空购物车？\n共 ' + ids.length + ' 件商品，移除后需重新添加。', { okText: '清空' });
      if (!go) return;

      btn.disabled = true;
      var left = await clearAll(ids);

      if (!left || !left.length) {
        setLabel(btn, '清空购物车', '0');
        goToCartPage();
        return;
      }

      setLabel(btn, '清空购物车', String(left.length));
      await dialog('还有 ' + left.length + ' 件没能移除，可能需要登录或该商品不支持直接删除。\n请回到购物车手动处理一下。', { onlyOk: true });
    } finally {
      running = false;
      btn.disabled = false;
    }
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    if (document.getElementById(BTN_ID)) return;
    injectStyle();
    btn = createButton();
    refreshCount();
    var mo = new MutationObserver(scheduleRefresh);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
