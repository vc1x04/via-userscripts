# via脚本库

Via 浏览器（[viayoo.com](https://viayoo.com)）用的用户脚本合集。全部脚本均为 `@grant none`、无外部依赖，除脚本自身功能外不发起额外网络请求。

## 脚本列表

| 脚本 | 版本 | 文件 | 作用 |
| --- | --- | --- | --- |
| GOG 购物车一键清空 | 1.5.1 | [`gog-clear-cart.user.js`](gog-clear-cart.user.js) | 在 GOG 购物车 / 结算页加一个「清空购物车」按钮 |
| CSDN 去广告并自动展开全文 | 1.0.0 | [`csdn-cleaner.user.js`](csdn-cleaner.user.js) | 洗掉 CSDN 博客的广告与登录弹窗，自动展开被折叠的全文 |
| 夸克网盘去广告直达 | 1.1.0 | [`quark-share-cleaner.user.js`](quark-share-cleaner.user.js) | 洗掉夸克网盘分享页 / 文件主页的推广与客户端引导，挡住自动弹出的登录窗 |

## 每个脚本做什么

### GOG 购物车一键清空 1.5.1

- 在 `/cart` 与 `/checkout` 页右下角加一个浮动按钮，按钮上带当前购物车件数角标；
- 点击后弹自定义确认框（不依赖 `window.confirm`，兼容部分 WebView），确认后 6 路并发逐件调用 `/cart/remove/<id>`；
- 最多跑三轮，每轮结束回读购物车校验，把被并发写入带回来的漏项再删一次；
- 主通道清不干净时，走结算接口返回的 `removeLink` 兜底；
- 清空后跳回不带订单号的购物车页并刷新，避免旧页面看着像没清掉。

### CSDN 去广告并自动展开全文 1.0.0

- 移除 33 个选择器命中的广告位、推广卡片、登录 / 注册弹窗、侧边栏推荐等节点；
- 隐藏 `.hide-article-box` 折叠遮罩，并解除正文容器的高度裁剪；
- 触发页面自己的「展开全文」按钮，同时去掉跳转链接，避免被带向登录页；
- 用 `MutationObserver` 加多次轮询处理异步插入的推广位。

### 夸克网盘去广告直达 1.1.0

- 移除分享页右侧横幅、会员中心入口、打开客户端 / 去客户端查看等引导；
- 自动关闭页面加载时弹出的登录窗；用户自己点过下载 / 保存 / 登录后，本会话不再自动关窗；
- 保留网页下载入口，直达文件列表。

## 安装

在 Via 里打开对应脚本的 raw 地址即可安装：

- GOG：https://raw.githubusercontent.com/vc1x04/via-userscripts/main/gog-clear-cart.user.js
- CSDN：https://raw.githubusercontent.com/vc1x04/via-userscripts/main/csdn-cleaner.user.js
- 夸克：https://raw.githubusercontent.com/vc1x04/via-userscripts/main/quark-share-cleaner.user.js

## 约定

- 脚本名和版本号必须写在文件头部的 `@name` / `@version` 元数据里；
- 作用域用 `@match` 限定，而不是 `@include`；
- 统一 `@grant none`，不使用 `GM_*` API；
- 只做页面清理和交互增强，不读取、不上传任何账号数据。
