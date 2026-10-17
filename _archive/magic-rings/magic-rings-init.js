/* ==========================================================================
   Hero 背景环形效果 —— 接入点
   实现在 magic-rings.js（原生移植，不含任何配置）；这里只放接入逻辑和
   下面这份配置。参数名和 React Bits 文档一一对应：
   https://reactbits.dev/animations/magic-rings
   ========================================================================== */

import { createMagicRings } from './magic-rings.js';

const MAGIC_RINGS_CONFIG = {
  color: '#F97316',
  colorTwo: '#F97316',
  ringCount: 6,
  speed: 1,
  attenuation: 10,
  lineThickness: 2,
  baseRadius: 0.35,
  radiusStep: 0.1,
  scaleRate: 0.1,
  opacity: 1,
  blur: 0,
  noiseAmount: 0.1,
  rotation: 0,
  ringGap: 1.5,
  fadeIn: 0.7,
  fadeOut: 0.5,
  followMouse: false,
  mouseInfluence: 0.2,
  hoverScale: 1.2,
  parallax: 0.05,
  clickBurst: false,
};

function init() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const container = document.querySelector('.site-header__rings');

  /* 减少动态效果：整个 renderer 都不初始化，不是初始化后暂停 */
  if (!header || !container || prefersReducedMotion) return;

  const rings = createMagicRings(container, MAGIC_RINGS_CONFIG);

  /* 容器本身铺满 header，这层 IntersectionObserver 和 magic-rings.js
     内部盯着同一个容器的那个是重复的，但显式盯 header 更贴合“hero 滚出
     视口就停”这条要求本身，留着做双重保险，成本几乎为零。 */
  const headerVisibility = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? rings.resume() : rings.pause()),
    { threshold: 0 }
  );
  headerVisibility.observe(header);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
