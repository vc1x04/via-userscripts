// ==UserScript==
// @name         CSDN 去广告并自动展开全文
// @namespace    https://viayoo.com/
// @version      1.0.0
// @description  清洗 CSDN 博客的广告、推广位与登录弹窗，自动展开被折叠的文章全文
// @author       you
// @run-at       document-end
// @match        *://blog.csdn.net/*
// @match        *://bbs.csdn.net/*
// @grant        none
// @homepageURL  https://github.com/vc1x04/via-userscripts
// @supportURL   https://github.com/vc1x04/via-userscripts/issues
// ==/UserScript==

(function () {
  'use strict';

  /* 广告 / 推广 / 弹窗：当前新版布局与经典布局的选择器都覆盖 */
  var AD_SELECTORS = [
    '#blogColumnPayAdvert',
    '.simple-ad-slot',
    '.recommend-ad-box',
    '.recommend-ad',
    '.adsbox',
    '.article-remark-ad',
    '.comment-ad',
    '.con-ad',
    '.csdn-advert',
    '.hide-preCode-box',
    '[id^="kp_box"]',
    '[id^="dmp_ad"]',
    '.pulllog-box',
    '.mediav_ad',
    '.post_recommend',
    '.csdn-tracking-statistics',
    '#asideFooter',
    '#adContent',
    '.p4course_target',
    '.bdsharebuttonbox',
    '.vip-caise',
    '.fourth_column',
    '.second-recommend-box.recommend-box',
    '.recommend-box.insert-baidu-box',
    '.template-box',
    '.blog-footer-bottom',
    '#rightAside',
    '.aside-box.vip-card',
    '.passport-container',
    '#passportbox',
    '.register-box',
    '.recommend-fixed-box',
    'ins.adsbygoogle'
  ];

  /* 折叠遮罩与展开按钮 */
  var MASK_SELECTOR = '.hide-article-box';
  var READMORE_SELECTOR = '#btn-readmore, .btn-readmore, #btn-no-login';

  function removeBySelector(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n && n.parentNode) n.parentNode.removeChild(n);
    }
  }

  function cleanAds() {
    AD_SELECTORS.forEach(removeBySelector);
  }

  /* 解除正文高度裁剪：遮罩只挡住了已在 DOM 里的内容；付费专栏/会员墙的内容不在 DOM 中，这里不绕过 */
  function unclipBody() {
    var containers = document.querySelectorAll('#article_content, .article_content, .htmledit_views, .markdown_views');
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    }
  }

  function expandArticle() {
    var btn = document.querySelector(READMORE_SELECTOR);
    if (btn) {
      /* 去掉跳转链接，避免点“关注/登录”被带走，只触发页面自己的展开逻辑 */
      btn.removeAttribute('href');
      btn.removeAttribute('target');
      try { btn.click(); } catch (e) { /* 忽略 */ }
    }
    removeBySelector(MASK_SELECTOR);
    unclipBody();
  }

  function injectStyle() {
    if (document.getElementById('csdn-cleaner-style')) return;
    var st = document.createElement('style');
    st.id = 'csdn-cleaner-style';
    st.textContent = [
      /* 广告槽位直接隐藏，避免短暂闪现 */
      '.simple-ad-slot,#blogColumnPayAdvert,.recommend-ad-box,.adsbox,[id^="kp_box"],[id^="dmp_ad"]{display:none !important;}',
      /* 折叠遮罩隐藏，正文解除裁剪 */
      '.hide-article-box{display:none !important;}',
      '#article_content,.article_content,.htmledit_views,.markdown_views{height:auto !important;max-height:none !important;overflow:visible !important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  var timer = null;
  function scheduleRun() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  }

  function run() {
    cleanAds();
    expandArticle();
  }

  function init() {
    injectStyle();
    run();

    /* 页面延迟加载的广告和折叠按钮，靠观察 DOM 变化兜底 */
    var mo = new MutationObserver(function () { scheduleRun(); });
    mo.observe(document.body, { childList: true, subtree: true });

    /* 再补几次轮询，处理异步插入的推广位 */
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
