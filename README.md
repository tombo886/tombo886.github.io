# 作品集 Demo — 字体规范 + 语义化结构 + JSON-LD

基于 Codrops "Rotating On-Scroll Animations"（MIT）改写。原版是 `div` + `background-image` 的纯视觉 demo，这一版把它改成了机器能读懂的结构。

## 跑起来

需要 Node.js ≥ 20.12。

```bash
npm install
cp .env.example .env   # 填 CONTACT_PHONE（可选）
npm start              # 或 ./serve.sh / ./serve.sh 3000
```

然后开 `http://localhost:8080`。开发时可以用 `npm run dev`（`node --watch`，改 server.js 自动重启）。

**必须走 http，不能直接双击 `public/index.html`。** `file://` 协议下字体会被 CORS 拦掉，API 也调不到。

### 后端

`server.js`（Express 5）负责 serve `public/` 下的静态站点，外加几个接口：

| 接口 | 作用 |
|---|---|
| `GET /api/health` | 健康检查，部署平台用 |
| `GET /api/projects` | 第三屏 MagicBento 的卡片数据，来自 `data/projects.json`——改作品内容只改这个文件，不用碰 JS |
| `GET /api/contact` | 告诉前端有没有配置电话号码 |
| `POST /api/contact/phone` | 点 "Show phone / WeChat" 时取号码（每 IP 10 分钟 10 次） |

电话号码只放在环境变量 `CONTACT_PHONE` 里（本地是 `.env`，已被 `.gitignore` 排除），**源码里一位都没有**，所以仓库可以放心公开。没配号码时页面上不显示电话按钮。

前端在接口不可用时会退回内置的占位卡片，电话按钮则不渲染。

### 部署

**线上地址：https://tombo886.github.io/**（GitHub Pages，静态版）

推送到 `main` 后，`.github/workflows/pages.yml` 会自动把 `public/` 发布到 Pages。Pages 只能托管静态文件，`server.js` 不在那里运行，所以：

- `data/projects.json` 在发布时被复制成 `/api/projects`，作品卡片跟本地后端版一样从这个地址取数据——改作品只改 `data/projects.json`，推送即生效
- `/api/contact` 不存在，电话按钮不显示，邮箱照常可点

第一次使用前要在仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

想要带后端的完整版（含电话按钮），把同一个仓库接到 Render / Railway / Fly.io 等能跑 Node 的平台：

- 构建命令 `npm ci`，启动命令 `npm start`
- 环境变量：`NODE_ENV=production`、`CONTACT_PHONE=你的号码`；`PORT` 平台一般会自动注入
- 也可以用 `Dockerfile`：`docker build -t portfolio . && docker run -p 8080:8080 -e CONTACT_PHONE=... portfolio`

## 一、字体规范

### 字体栈

```css
--font-sans: "InterVariable", "Inter", "HarmonyOS Sans SC", ...
```

Inter 放在前面，所以**拉丁字母和数字永远走 Inter**；Inter 没有汉字字形，浏览器自动落到 HarmonyOS Sans SC。中英混排时不需要写任何额外代码，混排位置的数字也会正确地用 Inter 而不是中文字体里那套偏宽的数字。

HarmonyOS 的三个 `@font-face` 都加了 `unicode-range`，限制在中日韩区间。这不是可有可无的优化——不加的话，浏览器在某些情况下会为了拉丁字符去下载 8MB 的中文字体。

### 三档字重

| Token | 值 | 用在哪 |
|---|---|---|
| `--weight-body` | 400 | 正文、说明、列表 |
| `--weight-title` | 500 | 所有标题 h1–h6 |
| `--weight-numeric` | 600 | 年份、序号、指标 |

数字那档用 `.num` / `<time>` / `<data>` 触发，同时开了 `font-variant-numeric: tabular-nums`，所以列表和表格里的数字是竖向对齐的。行内跑在句子中间的数字用 `.num--inline`，切回比例数字。

**一个要知道的坑：HarmonyOS Sans 没有 SemiBold(600)。** 字重只有 Thin 250 / Light 300 / Regular 400 / Medium 500 / Bold 700 / Black 900。中文文本如果设成 600，CSS 字体匹配算法会向上取 700 Bold —— 我在 `tokens.css` 里显式声明了 Bold 的 `@font-face` 来接住这个情况，这是刻意的映射不是遗漏。

实际影响不大：600 这档是给数字用的，而数字走 Inter，Inter 有真正的 600。只有当你把整段中文设成 600 时才会看到它变 Bold。

### 字体文件

```
fonts/inter/InterVariable.woff2                    344 KB   ← 一个文件覆盖 100–900
fonts/harmonyos/HarmonyOS_Sans_SC_Regular.ttf      7.9 MB
fonts/harmonyos/HarmonyOS_Sans_SC_Medium.ttf       7.9 MB
fonts/harmonyos/HarmonyOS_Sans_SC_Bold.ttf         7.8 MB
```

---

## 二、字体许可 —— 这里有个要你自己决定的事

**Inter：SIL Open Font License 1.1。** 真正的开源字体，可以自由子集化、转 woff2、打包分发，唯一要求是保留许可证文件。这里用的是可变字体版本，一个 344KB 的文件覆盖全部字重，还带 `opsz` 光学尺寸轴。

**HarmonyOS Sans：不是开源许可证。** 它用的是华为自己的 *HarmonyOS Sans Fonts License Agreement*。协议允许免费商用、允许随软件一起分发，但是有两条硬约束：

> 2) YOU may not make any modifications to HarmonyOS Sans Fonts or any of their individual components.
>
> 3) Neither HarmonyOS Sans Fonts nor any of their individual components may be redistributed or sold in a stand-alone base.

第 2 条的意思是**不能做任何修改**。按字面读，子集化算修改，`ttf → woff2` 转换也算修改。所以这个包里放的是原封不动的 `.ttf`，没转 woff2，没做子集化。

这带来一个很现实的问题：**8MB/字重的中文字体，放到真实网站上是不可接受的。** 三个字重就是 24MB。你有几个选择：

1. **只用一个字重**（Regular 400），中文标题靠字号和颜色拉层级，不靠字重。8MB 仍然偏大，但配合 `font-display: swap` 和 HTTP 缓存，回头客是能接受的。
2. **中文不用 HarmonyOS**，换一个允许子集化的：思源黑体 / Noto Sans SC（OFL）、HarmonyOS Sans 之外的开源中文字体。子集化到常用 3500 字后 woff2 大约 800KB–1.5MB。
3. **自己判断第 2 条的边界**，做子集化并承担风险。很多人这么干，但这是你的法务判断，不是我的。

顺带一提：GitHub 上那个 `huawei-fonts/HarmonyOS-Sans` 仓库的 `LICENSE` 文件写的是 GPL-3.0，那是打包者自己加的，**不是华为的授权条款**。真正生效的是字体包里那份 `LICENSE.txt`，也就是 `fonts/harmonyos/LICENSE.txt` 和 `licenses/harmonyos-sans-LICENSE.txt`。

协议第 1 条还要求"在软件中显著位置声明使用了 HarmonyOS Sans"——页脚的 colophon 就是干这个的，别删。

（我不是律师，上面是对协议原文的直读。正式发布前建议你自己再确认一遍。）

**Stretch Pro（主视觉标题 "DESIGN" / "PORTFOLIO" 两个词）：不是开源字体，
声明的授权是 "Free For Personal Use"（作者 Jetsmax / Ril Anwar，2020）。**
项目里没有这个字体的 `.ttf`/`.woff2` 文件，也没有对应的 `@font-face`——
这两个词在设计稿阶段已经转成矢量路径，存成
`assets/headline-design.svg` / `assets/headline-portfolio.svg`，页面上
加载的是路径，不是字体软件本身。详细说明见
`licenses/stretch-pro-NOTICE.md`。

**GSAP（MagicBento 板块用的动画依赖）：不是字体，是 `js/vendor/gsap.min.js`
（3.15.0，UMD 构建）。** GreenSock 在 2024 年被 Webflow 收购后把 GSAP 全部免费
开放，包括商业用途；这里不是律师，具体条款以 https://gsap.com/standard-license
当时的原文为准。文件从 `_archive/vendor-scripts/gsap.min.js` 挪回来的，版本满足
MagicBento 要求的 `gsap@^3.13.0`，没有重新下载。详细说明见
`licenses/gsap-NOTICE.md`。

---

## 三、语义化结构 + JSON-LD

这部分对应那篇《What AI Actually Reads》。原版 demo 的问题是视觉信息量很大、语义信息量接近零，20 个 `div.gallery__item` 加背景图，机器读过去什么都拿不到。改了这些：

### 1. 结构反映内容，不只是反映排版

```html
<ol class="projects">            ← ol 而不是 div，顺序本身是信息（时间倒序）
  <li>
    <article aria-labelledby="project-01-title">
      <figure class="project__media">
        <img alt="……具体描述画面内容……">   ← 真 img，不是 background-image
      </figure>
      <h3 id="project-01-title">项目名</h3>
      <p class="project__summary">一句话说清做了什么</p>
      <dl class="project__facts">            ← 角色/年份/领域是结构化的键值对
        <div><dt>Role</dt><dd>Lead product designer</dd></div>
        <div><dt>Year</dt><dd><time class="num" datetime="2026">2026</time></dd></div>
      </dl>
    </article>
  </li>
```

标题层级是干净的 h1 → h2 → h3，没有为了字号大小跳级。

### 2. 装饰性元素标 `aria-hidden`

每个项目左边那个金色的 `ART. 01` 是纯装饰，所以：

```html
<span class="project__ornament" aria-hidden="true">Art. 01</span>
```

背景那条跑马灯整块也标了 `aria-hidden="true"`。

**这正是文章里那个案例的修法。** Modularte 站上一个装饰性标签 `Art. 49fk` 被 AI 当成了产品型号写进回答，就是因为它在 DOM 里看起来和真实内容没有区别。人能从排版看出它是装饰，机器不能——除非你明说。

### 3. JSON-LD 把视觉表达的关系显式写一遍

`index.html` 的 `<head>` 里有一段 `@graph`，包含：

- `Person` — 你是谁，`jobTitle`、`knowsAbout`、`knowsLanguage`、`sameAs` 指向你的各个主页
- `WebSite` + `ProfilePage` — 这个页面是什么
- `ItemList` — 十个项目的顺序
- 十个 `CreativeWork` — 每个项目的 `name`、`abstract`、`dateCreated`、`creator`（用 `@id` 指回 Person）、`keywords`、`creditText`（你的真实角色）

用 `@id` 互相引用，而不是把 Person 的信息在每个项目里复制一遍，这样机器能明确知道"这十个东西是同一个人做的"。

### 4. title / description / og / h1 说法一致

页面里这四处对"你是谁、你做什么"的描述是逐字对齐的。不一致的时候，AI 会挑一个来用，而且通常挑错那个。

### 自查方法

```bash
# 看机器读到的标题大纲
curl -s http://localhost:8080/ | grep -oE '<h[1-3][^>]*>[^<]*'

# 校验 JSON-LD
curl -s http://localhost:8080/ | python3 -c "import sys,re,json; print(json.dumps(json.loads(re.search(r'application/ld\+json\">(.*?)</script>',sys.stdin.read(),re.S).group(1)),indent=2,ensure_ascii=False)[:800])"
```

线上之后用 Google Rich Results Test 和 Schema.org Validator 再验一遍。

---

## 四、你要替换的东西

全文搜索这几个字符串：

| 搜什么 | 换成 |
|---|---|
| `example.com` | 你的真实域名（`canonical`、`og:url`、JSON-LD 的所有 `@id`） |
| `Feiping Liu` / `刘飞平` | 你的名字 |
| `hello@example.com` | 你的邮箱 |
| `your-handle` | GitHub / LinkedIn / Dribbble 用户名 |
| `Product Designer — industrial…` | 你真实的角色描述（四处要一起改） |

然后是十个项目本身：`index.html` 里每个 `<article class="project">` 和 `<head>` 里对应的 `CreativeWork` 节点要同步改。**两处都要改**——只改 HTML 不改 JSON-LD 的话，机器读到的是旧的。

### 图片

`assets/` 里 20 张 `.webp` 是 Codrops demo 自带的 Midjourney 生成占位图，随 MIT 仓库一起分发，**但 MIT 覆盖的是代码不是这些图**。发布前必须换成你自己的作品截图。

换的时候记得：

- `<img>` 的 `width` / `height` 要写真实像素尺寸，否则加载时会跳版
- `alt` 要描述**画面里有什么**，不是重复项目名。现在每条 alt 都是具体的界面描述，照这个写法来
- 首屏第一张保持 `loading="eager"`，其余 `loading="lazy"`

---

## 五、文件结构

**2026-09-22 是"拆掉旧首页、接 AeroShards"这次改动的当前状态**：作品墙、字体样张、导航、跑马灯、
MagicRings、ParticleText 全部移出到了 `_archive/`（不是删掉，之后要恢复内容时能直接找回来），
首页现在是 AeroShards 全屏 WebGPU 背景 + 居中的问候语标题 + 底部字体署名。下面这份目录树是当前
状态；`_archive/README.md` 里记了每样东西是从哪儿挪出来的、怎么贴回去。

```
portfolio-demo/
├── server.js               Express 后端：静态文件 + /api/*
├── package.json
├── .env.example            环境变量模板（.env 不进 git）
├── Dockerfile
├── .github/workflows/pages.yml   推送 main 时发布 public/ 到 GitHub Pages
├── data/
│   └── projects.json       第三屏作品卡片数据（/api/projects）
├── public/                 浏览器能访问到的全部内容
│   ├── index.html          结构 + JSON-LD（Person/WebSite/ProfilePage）+ importmap
│   ├── css/
│   │   ├── tokens.css      ★ 字体规范：@font-face、字重 token、字号阶梯
│   │   └── site.css        布局 + AeroShards 挂载点/降级样式
│   ├── js/
│   │   ├── aero-shards.js       全屏背景：AeroShards，原生移植自 React Bits
│   │   ├── aero-shards-init.js  接入逻辑 + 配置常量 + WebGPU 探测/降级
│   │   ├── magic-bento.js       第三屏卡片网格，移植自 React Bits
│   │   ├── magic-bento-init.js  接入逻辑，从 /api/projects 取数据
│   │   ├── phone-reveal.js      电话点击显示，从 /api/contact/phone 取号码
│   │   └── vendor/              gsap + vgpu 家族
│   ├── fonts/
│   │   ├── inter/          InterVariable.woff2（OFL）
│   │   └── harmonyos/      三个未经修改的 .ttf + 华为授权原文
│   ├── img/  assets/
├── licenses/               各依赖的授权原文
├── _archive/               移出页面的旧内容——见 _archive/README.md
├── serve.sh
└── README.md
```

## 已验证（多 section 版，2026-09-21 之前）

下面这几条说的是作品墙还在页面上时的状态——那部分现在在 `_archive/`，恢复之后这几条才重新适用。
单屏版自己的验证结果在改动记录/对话里，没有重复写进这份 README。

- Chromium 实机渲染：四个 `@font-face` 全部 `loaded`，正文 400 / h1 500 / `.num` 600 + tabular-nums
- 无 console 报错、无失败请求
- 390px 窄屏无横向溢出（卡片位移幅度会按视口收敛）
- JSON-LD 语法正确、14 个节点无悬空 `@id` 引用
- 标题层级 h1 → h2 → h3 无跳级；10 张图 alt 全部非空，最短 112 字符
- `prefers-reduced-motion: reduce` 下动画完全关闭

## 许可

- 滚动动画改编自 [Codrops RotatingOnScrollAnimations](https://github.com/codrops/RotatingOnScrollAnimations)，MIT
- Inter — SIL Open Font License 1.1
- HarmonyOS Sans — HarmonyOS Sans Fonts License Agreement, © Huawei Device Co., Ltd.
- 占位图 — Midjourney 生成，随原 Codrops demo 分发
- Hero 背景环形效果（原 `js/magic-rings.js`，现在在 `_archive/magic-rings/`，见该目录的 README）移植自 [React Bits MagicRings](https://reactbits.dev/animations/magic-rings) — MIT + Commons Clause License Condition v1.0（© David Haz）。这份协议允许免费商用、允许随网站分发，唯一的限制是**不能把组件本身单独售卖、转售或再分发**，跟随站点一起用不受影响
- Hero 主视觉粒子汇聚文字（原 `js/particle-text.js`，现在在 `_archive/particle-text/`，见该目录的 README）同样移植自 [React Bits ParticleText](https://reactbits.dev/text-animations/particle-text)，同一份 MIT + Commons Clause 授权
- 全屏背景 AeroShards（`js/aero-shards.js`）同样移植自 [React Bits AeroShards](https://reactbits.dev/backgrounds/aero-shards)，同一份 MIT + Commons Clause 授权（三个组件共用 `licenses/react-bits-LICENSE.txt`，来源仓库相同）
- three.js（`js/vendor/three.module.js`，0.180.0，minified ESM 构建，MagicRings 的依赖，现在跟 MagicRings 一起在 `_archive/magic-rings/vendor/`）— MIT
- vgpu 家族（`js/vendor/vgpu*/`，AeroShards 的依赖：`vgpu@0.3.1`、`@vgpu/core@0.3.1`、`@vgpu/wgsl@0.3.1`，Vercel Labs）— MIT（`licenses/vgpu-MIT-LICENSE.txt`，三个包共用同一份授权文本）。这三个包发布到 npm 的 `dist/` 是普通 ESM，vendor 进来的只是从 `vgpu` 的浏览器入口开始顺着 import 图追出来的 81 个文件（472KB），不是三个包的全部内容——`vgpu` 本身 `dist/` 有 154 个文件，很多是 `./node`、`./mock`、`./cli` 这几个非浏览器入口专用的，没有被追踪到就没有 vendor 进来；`@vgpu/wgsl-std`（WGSL 代码片段库，`resolveShader()` 的 import-graph 加载器专用）整个没被用到，也没有 vendor 进来——AeroShards 用的是 `reflectSource()`，明确拒绝处理带 import 的 WGSL

`licenses/` 里六份许可证原文别删。
