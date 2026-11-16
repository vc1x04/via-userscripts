// ==UserScript==
// @name         夸克网盘去广告直达
// @namespace    https://viayoo.com/
// @version      1.1.0
// @description  清洗夸克网盘分享页与文件主页的推广横幅、会员与客户端引导入口，关闭自动弹出的登录窗，保留网页下载入口直达文件列表
// @author       you
// @run-at       document-end
// @match        *://pan.quark.cn/*
// @match        *://drive.quark.cn/*
// @grant        none
// @homepageURL  https://github.com/vc1x04/via-userscripts
// @supportURL   https://github.com/vc1x04/via-userscripts/issues
// ==/UserScript==

(function () {
  'use strict';

  /* 推广 / 引导入口：分享页右侧横幅栏、会员中心、打开客户端、去客户端查看；文件主页头部客户端入口 */
  var AD_SELECTORS = [
    '.share-right-side-content',
    '.next-box',
    '.pc-member-entrance',
    '[class*="client-download--"]',
    '[class*="SectionHeaderController--icon-download--"]',
    '[class*="DownloadDropDown--"]',
    '.add-backup-tooltip',
    '.open-share'
  ];

  var MODAL_SELECTOR = '.ant-modal.login-modal';
  var MODAL_CLOSE_SELECTOR = '.ant-modal-close';
  var MODAL_WRAP_SELECTOR = '.ant-modal-wrap';
  var MODAL_MASK_SELECTOR = '.ant-modal-mask';

  /* 触发登录窗是正当的权限流程：点过下载/保存/登录后，本会话内不再自动关窗 */
  var ACTION_SELECTOR = '.share-download, .share-save, [class*="share-download"], [class*="share-save"], .ant-btn.login';

  var autoClose = true;

  function removeBySelector(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n && n.parentNode) n.parentNode.removeChild(n);
    }
  }

  function cleanPromo() {
    AD_SELECTORS.forEach(removeBySelector);
  }

  function modalVisible() {
    var modal = document.querySelector(MODAL_SELECTOR);
    if (!modal) return false;
    return getComputedStyle(modal).display !== 'none';
  }

  function closeModal() {
    var close = document.querySelector(MODAL_CLOSE_SELECTOR);
    if (close) {
      close.click();
      return;
    }
    /* 兜底：没有关闭按钮时直接隐藏弹窗与遮罩 */
    var modal = document.querySelector(MODAL_SELECTOR);
    var wrap = document.querySelector(MODAL_WRAP_SELECTOR);
    var mask = document.querySelector(MODAL_MASK_SELECTOR);
    if (modal) modal.style.display = 'none';
    if (wrap) wrap.style.display = 'none';
    if (mask) mask.style.display = 'none';
  }

  function dismissAutoModal() {
    /* 用户点过下载/保存/登录后，保留其触发的弹窗；只挡页面加载时自动弹出的那一次 */
    if (!autoClose) return;
    if (modalVisible()) closeModal();
  }

  function injectStyle() {
    if (document.getElementById('quark-share-cleaner-style')) return;
    var st = document.createElement('style');
    st.id = 'quark-share-cleaner-style';
    st.textContent = [
      /* 推广横幅与引导入口直接隐藏，避免短暂闪现 */
      '.share-right-side-content,.next-box,.pc-member-entrance,[class*="client-download--"],[class*="SectionHeaderController--icon-download--"],[class*="DownloadDropDown--"],.add-backup-tooltip,.open-share{display:none !important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function markUserAction() {
    autoClose = false;
  }

  function bindActionGuard() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest(ACTION_SELECTOR);
      if (el) markUserAction();
    }, true);
  }

  var timer = null;
  function scheduleRun() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  function run() {
    cleanPromo();
    dismissAutoModal();
  }

  function init() {
    injectStyle();
    bindActionGuard();
    run();

    /* 异步插入的推广位与延迟弹出的登录窗，靠观察器兜底 */
    var mo = new MutationObserver(function () { scheduleRun(); });
    mo.observe(document.body, { childList: true, subtree: true });

    [1000, 3000, 6000].forEach(function (ms) {
      setTimeout(run, ms);
    });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
