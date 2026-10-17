# _archive

内容都是 2026-09-21 那次"hero 改成整屏 ParticleText"的改动移出来的，不是删掉，是先放这儿。

| 路径 | 是什么 | 从哪儿挪出来的 |
|---|---|---|
| `removed-sections.html` | 除 `<h1>` 外，header 里的 role/bio/导航/数字块 + skip-link + 跑马灯 + Selected work/Typography 两个 section + 页脚 Contact 列表 | `index.html` |
| `removed-sections.css` | 上面这些元素对应的 CSS 规则 | `css/site.css` |
| `json-ld-removed.json` | `@graph` 里的 `ItemList` + 十个 `CreativeWork` | `index.html` `<head>` |
| `main.js` | GSAP ScrollTrigger + Lenis 的作品墙滚动动画 | `js/main.js` |
| `vendor-scripts/` | `gsap.min.js`、`ScrollTrigger.min.js`、`lenis.min.js`、`imagesloaded.pkgd.min.js`（`main.js` 的依赖） | `js/` |
| `assets/` | 20 张 `.webp` 占位图（十个项目每个两张：封面 + JSON-LD 的 og:image 引用） | `assets/` |
| `magic-rings/` | MagicRings 组件本体 + three.js vendor 构建——这是查出来的 hero 红色光晕的来源（`color: '#F97316'`），跟这次"清空 hero"没有直接关系，是顺带查出来的 bug，删除前先在这儿存一份 | `js/magic-rings.js`、`js/magic-rings-init.js`、`js/vendor/*` |

## 恢复顺序

1. **作品墙 + 字体样张 + 联系方式**：`removed-sections.html`/`.css` 贴回去，`json-ld-removed.json` 里的节点拼回 `@graph`，`assets/*.webp` 挪回 `assets/`，`main.js` + `vendor-scripts/*` 挪回 `js/`，`index.html` 补上对应的 `<script>` 标签。记得同步改 `index.html` 的 meta description / og:description（现在没提 "Selected projects" 了，恢复作品墙时要把这句加回去）。
2. **MagicRings**：`magic-rings/` 里的文件挪回 `js/`（`vendor/` 子目录也要挪回 `js/vendor/`），`index.html` 补上 importmap + 两个 `<script type="module">`。别忘了 `css/site.css` 也要补上 `.site-header__rings` 相关规则——这次改动前的版本在 git 历史 / 对话记录里，这里没单独存一份 CSS。

## 现在删了但没存底的东西

- 三.js license 文件的 README/说明性提及、`.claude/launch.json` 之类配置——没动，不受这次影响。
- `css/site.css` 里跟 MagicRings 相关的规则（`.site-header__rings`、`.site-header::before` 遮罩、reduced-motion 里那条 `.site-header__rings { display: none }`）没单独存档，直接删了，因为这次改动没要求存底 MagicRings 这部分（只要求"清掉"）。如果要恢复 MagicRings，这几条规则需要重写，不是简单地把文件贴回去。
