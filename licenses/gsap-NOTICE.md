# GSAP — 用于 MagicBento 的动画依赖

`js/vendor/gsap.min.js` 是 GSAP 3.15.0 的 UMD 构建，逐字节从 `_archive/vendor-scripts/gsap.min.js`
挪回来的（第一轮精简项目时移出去的那份），版本满足 MagicBento 组件要求的 `gsap@^3.13.0`，
没有重新下载。

文件头部自带的版权声明：

```
Copyright 2026, GreenSock. All rights reserved.
Subject to the terms at https://gsap.com/standard-license.
```

GreenSock 在 2024 年被 Webflow 收购后，把 GSAP（包括原本 Club GreenSock 专属的插件）
全部免费开放，包括商业用途。**这里不是律师**，具体条款以 https://gsap.com/standard-license
页面当时的原文为准，正式发布前建议自己再确认一遍——上面这段是对协议现状的直读，不是法律意见。

## 这个项目怎么用的

- 只用了核心 `gsap.min.js`（UMD 构建），没有引入任何付费插件（MorphSVG、SplitText 等）。
- 通过普通 `<script src="js/vendor/gsap.min.js"></script>`（非 module）加载，挂在
  `window.gsap` 上；`js/magic-bento.js` 里直接读这个全局变量，不走 npm/打包工具。
- 文件本身未做任何修改，压缩产物原样保留。
