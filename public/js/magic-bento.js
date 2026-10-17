/* ==========================================================================
   MagicBento — 移植自 React Bits（许可证见 licenses/react-bits-LICENSE.txt）
   https://reactbits.dev/components/magic-bento

   跟 particle-text.js 一样的移植方式：不引入 React、不引入打包工具。原组件
   两棵子树（GlobalSpotlight / 每张卡的 ParticleCard 或降级 div）的 useEffect
   body 变成下面的 init 逻辑，cleanup 变成 detach()。缓动曲线、公式、DOM
   结构、CSS 自定义属性名（--glow-x/--glow-y/--glow-intensity/--glow-radius）
   逐字照搬，参数名跟原组件 props 一一对应，没有改名。

   GSAP 走 js/vendor/gsap.min.js（UMD 构建），用普通 <script> 标签加载、
   挂在 window.gsap 上——这个项目全程不用打包工具，UMD 在浏览器原生 ESM
   下不会导出具名 import，所以不能像 aero-shards 那样用 importmap 走
   `import { gsap } from 'gsap'`，只能读全局变量。见 index.html 里
   gsap.min.js 那个 <script> 标签紧跟着的注释。

   跟原组件的行为差异（刻意的，不是遗漏）：
   - React 版本用 isMobile 这个 state 触发整棵子树重新跑 useEffect（因为
     shouldDisableAnimations 在每个 useEffect 的依赖数组里）；这里没有
     state/重渲染机制，用 mountInteractions()/unmountInteractions() 显式
     模拟同样的效果——resize 跨过 768px 断点时，先整个拆掉再按新的
     shouldDisableAnimations 重新挂一遍，跟 React 重跑 effect 是等价的。
   - enableStars 为 true（ParticleCard）和为 false（原组件里退化成一个
     带 ref 回调的普通 div）两条分支，原组件里 tilt/magnetism/click 的
     公式完全一样，只有"要不要顺带跑粒子"这一件事不同——这里合并成一个
     attachCardInteractions()，用 enableStars 分支内部判断要不要跑粒子，
     不是把公式抄两遍。particle-container 这个类名是否加到卡片上，仍然
     严格跟着原组件的 enableStars 条件走（会影响 CSS 里
     .particle-container:hover 那条 box-shadow 规则，跟
     .magic-bento-card--border-glow:hover 那条会不会叠加，是原组件自带的
     行为，这里没有改）。
   - 新增 pause()/resume()：跟 destroy() 共用同一套 unmountInteractions，
     供外部（IntersectionObserver）在这一屏滚出/滚入视口时挂起/恢复——
     原组件没有这个需求，假设自己一直在视口里。pause 不清空卡片 DOM，
     resume 之后不用重新拉数据、不丢焦点位置。
   - disableAnimations 这个 prop 的值本身（对应 prefers-reduced-motion）
     只在创建时读一次，运行期不监听系统设置变化——跟这个项目里
     aero-shards-init.js 的做法一致（那边也只在 init() 时查一次），
     不是这个文件单独的决定。
   ========================================================================== */

const { gsap } = window;

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '132, 0, 255';
const MOBILE_BREAKPOINT = 768;

const DEFAULTS = {
  textAutoHide: true,
  enableStars: true,
  enableSpotlight: true,
  enableBorderGlow: true,
  disableAnimations: false,
  spotlightRadius: DEFAULT_SPOTLIGHT_RADIUS,
  particleCount: DEFAULT_PARTICLE_COUNT,
  enableTilt: false,
  glowColor: DEFAULT_GLOW_COLOR,
  clickEffect: true,
  enableMagnetism: true,
};

/* ----------------------------------------------------------------------
   六张占位卡：结构和字段复用 _archive/removed-sections.html 里第一轮
   归档的十个项目卡（项目名 / 角色 / 领域 / 一句话说明），挑了六个搬过来
   当占位，比凭空编的更接近最终形态。title/description 全部标了 TODO——
   这不是最终文案，用户会自己填真实内容。label 用的是原卡片的"角色"
   字段，不是 TODO（没被要求标，且太短不适合加前缀）。
   ---------------------------------------------------------------------- */
/* 卡片数据现在由后端 GET /api/projects 提供（data/projects.json），
   createMagicBento(container, { cards }) 传进来；没传或接口失败时退回
   下面这份内置占位，保证纯静态打开时第三屏也不是空的。 */
const PLACEHOLDER_CARDS = [
  {
    label: 'Lead product designer',
    title: 'TODO — Aperture: Defect Review Console',
    description:
      'TODO — A review console that lets quality engineers confirm or reject machine-vision defect calls in under three seconds.',
  },
  {
    label: 'Lead product designer',
    title: 'TODO — Halide: Camera Calibration Flow',
    description:
      'TODO — A guided calibration flow that cut average setup time for a six-camera inspection cell from 40 minutes to 11.',
  },
  {
    label: 'Product designer',
    title: 'TODO — Signal: Alert Triage for Night Shift',
    description:
      'TODO — An alert model that groups correlated machine faults so a single operator can cover 4 cells overnight.',
  },
  {
    label: 'Design system lead',
    title: 'TODO — Basis: Interface Design System',
    description:
      'TODO — A design system for control-room software: dense data tables, colour that survives a factory floor, and a three-weight type scale.',
  },
  {
    label: 'Product designer',
    title: 'TODO — Bench: Annotation Tooling',
    description:
      'TODO — An annotation tool designed around the reality that the people labelling defects are the people who make the parts.',
  },
  {
    label: 'Sole designer',
    title: 'TODO — Origin: First Operator Interface',
    description:
      'TODO — The first shipped operator interface for a vision inspection station, built with 2 engineers in 11 weeks.',
  },
];

function createParticleElement(x, y, color = DEFAULT_GLOW_COLOR) {
  const el = document.createElement('div');
  el.className = 'particle';
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none;
    z-index: 100;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
}

function calculateSpotlightValues(radius) {
  return { proximity: radius * 0.5, fadeDistance: radius * 0.75 };
}

function updateCardGlowProperties(card, mouseX, mouseY, glow, radius) {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;

  card.style.setProperty('--glow-x', `${relativeX}%`);
  card.style.setProperty('--glow-y', `${relativeY}%`);
  card.style.setProperty('--glow-intensity', glow.toString());
  card.style.setProperty('--glow-radius', `${radius}px`);
}

function buildCard(data, opts) {
  const classes = ['magic-bento-card'];
  if (opts.textAutoHide) classes.push('magic-bento-card--text-autohide');
  if (opts.enableBorderGlow) classes.push('magic-bento-card--border-glow');
  if (opts.enableStars) classes.push('particle-container');

  const card = document.createElement('div');
  card.className = classes.join(' ');
  /* 原组件的卡片是纯 div，没有 tabindex，键盘完全够不到——这是这一版
     跟原组件的一处刻意偏离，不是疏忽：这个项目全程要求"键盘 Tab 能走完
     所有交互元素、焦点样式清晰可见"，卡片以后是要链接到真实作品的，
     现在只是内容没定，不是"不该被 Tab 到"。焦点样式见 site.css 里
     .magic-bento-card:focus-visible。 */
  card.tabIndex = 0;
  card.style.backgroundColor = '#120F17';
  card.style.setProperty('--glow-color', opts.glowColor);

  const header = document.createElement('div');
  header.className = 'magic-bento-card__header';
  const label = document.createElement('div');
  label.className = 'magic-bento-card__label';
  label.textContent = data.label;
  header.appendChild(label);

  const content = document.createElement('div');
  content.className = 'magic-bento-card__content';
  const title = document.createElement('h3');
  title.className = 'magic-bento-card__title';
  title.textContent = data.title;
  const description = document.createElement('p');
  description.className = 'magic-bento-card__description';
  description.textContent = data.description;
  content.appendChild(title);
  content.appendChild(description);

  card.appendChild(header);
  card.appendChild(content);
  return card;
}

/* 单张卡的 hover/tilt/magnetism/click 交互，对应原组件 ParticleCard 的
   useEffect body + 降级 div 分支里那份完全相同的公式。返回 detach()。 */
function attachCardInteractions(card, opts) {
  if (opts.disableAnimations) return () => {};

  const { particleCount, glowColor, enableTilt, clickEffect, enableMagnetism, enableStars } = opts;

  let isHovered = false;
  let particlesInitialized = false;
  let memoizedParticles = [];
  let activeParticles = [];
  let timeouts = [];
  let magnetismTween = null;

  function initializeParticles() {
    if (particlesInitialized) return;
    const { width, height } = card.getBoundingClientRect();
    memoizedParticles = Array.from({ length: particleCount }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor)
    );
    particlesInitialized = true;
  }

  function clearAllParticles() {
    timeouts.forEach(clearTimeout);
    timeouts = [];
    magnetismTween?.kill();

    activeParticles.forEach(particle => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'back.in(1.7)',
        onComplete: () => particle.parentNode?.removeChild(particle),
      });
    });
    activeParticles = [];
  }

  function animateParticles() {
    if (!isHovered) return;
    if (!particlesInitialized) initializeParticles();

    memoizedParticles.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHovered) return;

        const clone = particle.cloneNode(true);
        card.appendChild(clone);
        activeParticles.push(clone);

        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' });

        gsap.to(clone, {
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });

        gsap.to(clone, {
          opacity: 0.3,
          duration: 1.5,
          ease: 'power2.inOut',
          repeat: -1,
          yoyo: true,
        });
      }, index * 100);

      timeouts.push(timeoutId);
    });
  }

  function handleMouseEnter() {
    isHovered = true;
    if (enableStars) animateParticles();

    if (enableTilt) {
      gsap.to(card, { rotateX: 5, rotateY: 5, duration: 0.3, ease: 'power2.out', transformPerspective: 1000 });
    }
  }

  function handleMouseLeave() {
    isHovered = false;
    if (enableStars) clearAllParticles();

    if (enableTilt) {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' });
    }
    if (enableMagnetism) {
      gsap.to(card, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
    }
  }

  function handleMouseMove(e) {
    if (!enableTilt && !enableMagnetism) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    if (enableTilt) {
      const rotateX = ((y - centerY) / centerY) * -10;
      const rotateY = ((x - centerX) / centerX) * 10;
      gsap.to(card, { rotateX, rotateY, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 });
    }

    if (enableMagnetism) {
      const magnetX = (x - centerX) * 0.05;
      const magnetY = (y - centerY) * 0.05;
      magnetismTween = gsap.to(card, { x: magnetX, y: magnetY, duration: 0.3, ease: 'power2.out' });
    }
  }

  function handleClick(e) {
    if (!clickEffect) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height)
    );

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      width: ${maxDistance * 2}px;
      height: ${maxDistance * 2}px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(${glowColor}, 0.4) 0%, rgba(${glowColor}, 0.2) 30%, transparent 70%);
      left: ${x - maxDistance}px;
      top: ${y - maxDistance}px;
      pointer-events: none;
      z-index: 1000;
    `;

    card.appendChild(ripple);

    gsap.fromTo(
      ripple,
      { scale: 0, opacity: 1 },
      { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() }
    );
  }

  card.addEventListener('mouseenter', handleMouseEnter);
  card.addEventListener('mouseleave', handleMouseLeave);
  card.addEventListener('mousemove', handleMouseMove);
  card.addEventListener('click', handleClick);

  return function detach() {
    isHovered = false;
    card.removeEventListener('mouseenter', handleMouseEnter);
    card.removeEventListener('mouseleave', handleMouseLeave);
    card.removeEventListener('mousemove', handleMouseMove);
    card.removeEventListener('click', handleClick);
    if (enableStars) clearAllParticles();
    gsap.killTweensOf(card);
  };
}

/* 全局聚光灯：跟着鼠标在整个 .bento-section 范围内移动，同时按每张卡到
   鼠标的距离算 --glow-intensity。对应原组件 GlobalSpotlight。 */
function createGlobalSpotlight(grid, opts) {
  if (opts.disableAnimations || !grid || !opts.enabled) return () => {};

  const { spotlightRadius, glowColor } = opts;

  const spotlight = document.createElement('div');
  spotlight.className = 'global-spotlight';
  spotlight.style.cssText = `
    position: fixed;
    width: 800px;
    height: 800px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle,
      rgba(${glowColor}, 0.15) 0%,
      rgba(${glowColor}, 0.08) 15%,
      rgba(${glowColor}, 0.04) 25%,
      rgba(${glowColor}, 0.02) 40%,
      rgba(${glowColor}, 0.01) 65%,
      transparent 70%
    );
    z-index: 200;
    opacity: 0;
    transform: translate(-50%, -50%);
    mix-blend-mode: screen;
  `;
  document.body.appendChild(spotlight);

  function handleMouseMove(e) {
    const section = grid.closest('.bento-section');
    const rect = section?.getBoundingClientRect();
    const mouseInside =
      rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

    const cards = grid.querySelectorAll('.magic-bento-card');

    if (!mouseInside) {
      gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: 'power2.out' });
      cards.forEach(card => card.style.setProperty('--glow-intensity', '0'));
      return;
    }

    const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius);
    let minDistance = Infinity;

    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const centerX = cardRect.left + cardRect.width / 2;
      const centerY = cardRect.top + cardRect.height / 2;
      const distance =
        Math.hypot(e.clientX - centerX, e.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2;
      const effectiveDistance = Math.max(0, distance);

      minDistance = Math.min(minDistance, effectiveDistance);

      let glowIntensity = 0;
      if (effectiveDistance <= proximity) {
        glowIntensity = 1;
      } else if (effectiveDistance <= fadeDistance) {
        glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
      }

      updateCardGlowProperties(card, e.clientX, e.clientY, glowIntensity, spotlightRadius);
    });

    gsap.to(spotlight, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' });

    const targetOpacity =
      minDistance <= proximity
        ? 0.8
        : minDistance <= fadeDistance
          ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8
          : 0;

    gsap.to(spotlight, { opacity: targetOpacity, duration: targetOpacity > 0 ? 0.2 : 0.5, ease: 'power2.out' });
  }

  function handleMouseLeaveDoc() {
    grid.querySelectorAll('.magic-bento-card').forEach(card => card.style.setProperty('--glow-intensity', '0'));
    gsap.to(spotlight, { opacity: 0, duration: 0.3, ease: 'power2.out' });
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseleave', handleMouseLeaveDoc);

  return function detach() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseleave', handleMouseLeaveDoc);
    gsap.killTweensOf(spotlight);
    spotlight.remove();
  };
}

export function createMagicBento(container, options = {}) {
  if (!container || !gsap) return null;

  const opts = { ...DEFAULTS, ...options };

  const grid = document.createElement('div');
  grid.className = 'card-grid bento-section';
  container.appendChild(grid);

  const cardData = Array.isArray(opts.cards) && opts.cards.length ? opts.cards : PLACEHOLDER_CARDS;
  const cards = cardData.map(data => {
    const card = buildCard(data, opts);
    grid.appendChild(card);
    return card;
  });

  let isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  let detachCards = [];
  let detachSpotlight = () => {};
  let mounted = false;

  function mountInteractions() {
    if (mounted) return;
    mounted = true;
    const shouldDisable = opts.disableAnimations || isMobile;
    detachCards = cards.map(card => attachCardInteractions(card, { ...opts, disableAnimations: shouldDisable }));
    if (opts.enableSpotlight) {
      detachSpotlight = createGlobalSpotlight(grid, { ...opts, disableAnimations: shouldDisable, enabled: true });
    }
  }

  function unmountInteractions() {
    if (!mounted) return;
    mounted = false;
    detachCards.forEach(detach => detach());
    detachCards = [];
    detachSpotlight();
    detachSpotlight = () => {};
  }

  mountInteractions();

  /* 原组件用 window.innerWidth 判断移动端断点；这里补上 resize 处理——
     只在真的跨过 768px 断点时才整个拆掉重挂，不是每次 resize 都重建。 */
  function handleResize() {
    const nowMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (nowMobile === isMobile) return;
    isMobile = nowMobile;
    unmountInteractions();
    mountInteractions();
  }
  window.addEventListener('resize', handleResize);

  function destroy() {
    window.removeEventListener('resize', handleResize);
    unmountInteractions();
    cards.forEach(card => gsap.killTweensOf(card));
    grid.remove();
  }

  function pause() {
    unmountInteractions();
  }

  function resume() {
    mountInteractions();
  }

  return { destroy, pause, resume };
}
