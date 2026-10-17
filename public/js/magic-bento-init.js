/* ==========================================================================
   MagicBento 接入点 —— 只放这一轮要求的配置和挂载逻辑，实现在
   js/magic-bento.js。参数跟 React Bits 文档一一对应：
   https://reactbits.dev/components/magic-bento
   ========================================================================== */

import { createMagicBento } from './magic-bento.js';

const MAGIC_BENTO_CONFIG = {
  textAutoHide: true,
  enableStars: true,
  enableSpotlight: true,
  enableBorderGlow: true,
  enableTilt: true,
  enableMagnetism: true,
  clickEffect: true,
  spotlightRadius: 300,
  particleCount: 12,
  glowColor: '132, 0, 255',
};

async function loadCards() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

async function init() {
  const mount = document.querySelector('.magic-bento-mount');
  if (!mount) return;

  const cards = await loadCards();

  /* disableAnimations 只在创建时查一次 prefers-reduced-motion，运行期不
     监听变化——跟 aero-shards-init.js 的做法一致，见 magic-bento.js
     顶部注释。 */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bento = createMagicBento(mount, {
    ...MAGIC_BENTO_CONFIG,
    cards,
    disableAnimations: reducedMotion,
  });
  if (!bento) return;

  /* 第三屏滚出视口时暂停：全局 spotlight 挂在 document 上的 mousemove
     监听、每张卡的 hover/tilt/magnetism 监听，在看不见的时候完全没有
     存在的必要，滚回来再重新挂上。跟 aero-shards 暂停 WebGPU 渲染循环
     是同一个道理，用的也是同一套 IntersectionObserver 模式（见
     aero-shards-init.js）。 */
  const section = mount.closest('.screen');
  if (section && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) bento.resume();
          else bento.pause();
        });
      },
      { threshold: 0 }
    );
    observer.observe(section);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
