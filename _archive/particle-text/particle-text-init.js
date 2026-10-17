/* ==========================================================================
   Hero 主视觉 —— ParticleText 接入点
   实现在 particle-text.js（原生移植，不含任何配置）；这里只放接入逻辑和
   下面这份配置。参数名和 React Bits 文档一一对应：
   https://reactbits.dev/text-animations/particle-text
   ========================================================================== */

import { createParticleText } from './particle-text.js';

const PARTICLE_TEXT_CONFIG = {
  text: "Hi, I’m Tombo", // 双引号：字符串里有撇号。撇号本身是排版撇号 U+2019，
                          // 跟 index.html 里 h1 用的必须是同一个字符——canvas
                          // 采样直接读这个 JS 字符串，不会经过 HTML 实体解码。
  color: '#f2f0ec',          // 站点正文色
  highlightColor: '#beaf6e', // 站点强调色（暗金）
  fontWeight: 500,           // 站点标题字重，原组件默认 800，本站没有这一档
  fontFamily: 'inherit',
  fontSize: 'clamp(4rem, 16vw, 14rem)', // 整屏 hero 用得上更大的字号了
  particleSize: 2,
  density: 4,
  scatter: 180,
  gatherDuration: 1600,
  stagger: 420,
  pointerRepel: 70,          // 实测过 50/200、70/280、80/320——80/320 会把
  repelRadius: 280,          // 相邻字母也带偏，50/200 效果不够明显，70/280 是折中
  idleDrift: 0.7,
  trigger: 'hover',          // 官方 demo 用的值：鼠标划过重新触发散开→聚拢
  glow: true,
};

function init() {
  const header = document.querySelector('.site-header');
  const container = document.querySelector('.site-header__particle-text');
  const nameHeading = document.querySelector('.site-header__name');
  if (!header || !container || !nameHeading) return;

  const particleText = createParticleText(container, PARTICLE_TEXT_CONFIG);

  if (!particleText) {
    /* canvas 或 2d context 不可用：静默降级，h1 恢复正常可见文字，
       不留空白破洞 */
    nameHeading.classList.add('is-particle-fallback');
    return;
  }

  /* hero 滚出视口就停，回来再恢复——particle-text.js 本身没有内置这个，
     因为原组件假设自己一直在视口里 */
  const headerVisibility = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? particleText.resume() : particleText.pause()),
    { threshold: 0 }
  );
  headerVisibility.observe(header);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
