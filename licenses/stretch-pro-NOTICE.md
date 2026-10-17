# Stretch Pro — 未随站分发，只用了转轮廓后的路径

主视觉标题里 "DESIGN" / "PORTFOLIO" 两个词用的字体是 **Stretch Pro**
（作者：Jetsmax / Ril Anwar，2020）。字体文件自带的声明授权是
**"Free For Personal Use"**——非商业、个人用途免费，但没有开源许可证，
也没有明确允许把字体文件本身放上一个公开网站分发。

## 这个项目怎么处理的

- **不随站分发字体软件。** 项目目录里没有 `StretchPro.ttf`，也没有对应
  的 `@font-face` 规则，浏览器不会下载这个字体文件。
- **只使用转成矢量路径后的产出。** "DESIGN" 和 "PORTFOLIO" 在设计稿阶段
  已经用 Stretch Pro 排版好，导出为轮廓（outline），再存成
  `assets/headline-design.svg` / `assets/headline-portfolio.svg` 这两个
  文件——页面上加载的是这两份 SVG 里的 `<path>`，不是字体本身。
- 这两份路径本身没有再做任何编辑（不重新排版、不改字形），只是格式从
  "字体 + 文字" 变成了 "两条固定的矢量路径"。

## 为什么不干脆用 @font-face

字体文件目前的授权状态（Free For Personal Use，无开源许可证、未联系
作者取得商用/分发授权）不足以支持把 `.ttf`/`.woff2` 放进一个公开分发的
项目仓库或线上站点。转轮廓避免了这个问题：分发的是设计产出（两条路径），
不是字体软件本身。

如果之后需要英文展示字在其他地方复用（新增页面、新增词），同样应该走
"设计稿里转轮廓再导出 SVG" 这条路径，而不是把字体文件加进项目、加
`@font-face`。
