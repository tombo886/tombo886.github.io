/* ==========================================================================
   全屏背景 —— AeroShards 接入点
   实现在 aero-shards.js（原生移植，不含任何配置）；这里只放接入逻辑和
   下面这份配置。参数名和 React Bits 文档一一对应：
   https://reactbits.dev/backgrounds/aero-shards
   ========================================================================== */

import { createAeroShards } from './aero-shards.js';

const AERO_SHARDS_CONFIG = {
  backgroundColor: '#120F17',
  shardColor: '#896ABD',
  accentColor: '#A855F7',
  placement: 'full',
  flow: 'stream',
  material: 'pearl',
  detail: 'balanced',
  effect: 'none',
  scale: 1,
  spread: 1,
  depth: 1,
  speed: 1,
  spin: 1,
  interaction: 'repel',
  density: 1.5,
  shardSize: 1.1,
  stretch: 1,
  turbulence: 1,
  glow: 1,
  edgeSoftness: 2,
  bloom: 0.5,
  grain: 0.05,
  chromaticAberration: 0.0075,
  transitionDuration: 1,
  interactionRadius: 1.5,
  interactionStrength: 0.5,
  rippleIntensity: 1,
  holdToGather: true,
};

/* 降级判定用的颜色跟 AERO_SHARDS_CONFIG 里的 backgroundColor/shardColor/
   accentColor 是同一套值，写死在 css/site.css 的 .no-webgpu 规则里——
   CSS 没法读 JS 常量，改配置颜色时记得同步改那边的注释里提到的三个值。 */
function enableFallback() {
  document.body.classList.add('no-webgpu');
}

async function supportsWebGPU() {
  if (!('gpu' in navigator)) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

async function init() {
  const mount = document.querySelector('.aero-shards-mount');
  if (!mount) return;

  /* prefers-reduced-motion：根本不碰 WebGPU，不是初始化后暂停 */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    enableFallback();
    return;
  }

  /* 启动前探测：navigator.gpu 存在 + requestAdapter() 真的能拿到 adapter。
     更深层的失败（requestDevice 失败、运行时 device lost）由下面
     createAeroShards 的 onError 回调兜底。 */
  if (!(await supportsWebGPU())) {
    enableFallback();
    return;
  }

  const aeroShards = createAeroShards(mount, {
    ...AERO_SHARDS_CONFIG,
    onError: () => {
      aeroShards?.destroy();
      enableFallback();
    },
  });

  if (!aeroShards) {
    enableFallback();
    return;
  }

  /* aero-shards.js 内部的 scheduleRaf/scheduleSleep 已经在检查
     document.hidden，页面切到后台时它本来就不会继续排 rAF——这里显式
     接 visibilitychange 调 pause()/resume() 是按你的要求做的双重保险，
     成本几乎为零，不是说组件自己不做这件事。 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) aeroShards.pause();
    else aeroShards.resume();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
