# _archive/particle-text

移出自 2026-09-22 的"拆除首页，接 AeroShards"改动第 1 步。不是删掉，先放这儿——按你的原话"我可能会想加回来"。

## 这里有什么

| 文件 | 从哪儿挪出来的 |
|---|---|
| `particle-text.js` | `js/particle-text.js` —— 原生移植的 ParticleText 实现，不含配置 |
| `particle-text-init.js` | `js/particle-text-init.js` —— 接入逻辑 + 配置常量（`text: "Hi, I’m Tombo"`、`fontWeight: 500`、`trigger: 'hover'`、`pointerRepel: 70`/`repelRadius: 280` 等，都是调好的最终值） |

对应的 CSS 规则（`.site-header__name-stage`、`.site-header__particle-text`、
`.is-particle-fallback` 等）**没有单独存档**——这次改动直接重写了 `css/site.css`，
旧规则没有保留副本。恢复时这部分需要重写，不是简单地把文件贴回去。

对应的 HTML 结构（挂载点 `<div class="site-header__particle-text">`、h1 上的
`color: transparent` 处理方式）也是一样，参考本文件下面的"恢复到什么样"一节手动重建。

## 怎么装回来

1. `particle-text.js` + `particle-text-init.js` 挪回 `js/`。
2. `index.html` 的 `<h1>` 外面包一层挂载容器（`<div class="site-header__particle-text" aria-hidden="true">`），h1 本身保留在原位、视觉上 `color: transparent`。
3. `index.html` 底部加回 `<script type="module" src="js/particle-text-init.js"></script>`。
4. `css/site.css` 需要重新写这几条规则（不是贴回去，因为这次的骨架版 CSS 结构不一样了）：
   - 挂载容器 `position: absolute; inset: 0`，铺满它所在的容器
   - h1 `color: transparent`，加 `.is-particle-fallback` 降级类（canvas/2d 不支持时变回 `var(--color-text)`）
   - canvas 子元素 `display: block; width: 100%; height: 100%`
5. 检查 `js/particle-text-init.js` 里的 `text` 参数和 `index.html` 里 h1 的文字是否一致——包括撇号，必须是同一个 U+2019 字符，不能一边是排版撇号一边是直引号。

## 恢复到什么样

装回来之后应该是：h1 的文字用粒子汇聚效果渲染，鼠标划过有斥力、hover 触发重新汇聚，
`prefers-reduced-motion: reduce` 下画一帧静态就停。这些行为的实现细节看
`particle-text.js` 顶部的注释块，里面记录了所有跟原始 React Bits 组件的差异
和原因。
