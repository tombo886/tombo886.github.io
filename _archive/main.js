/* ==========================================================================
   滚动动画
   改编自 Codrops "Rotating On-Scroll Animations"（MIT，见 licenses/）

   与原版的区别：
   - 原版给每个 .gallery__item 用 JS 动态插入一层 wrapper；这里 wrapper
     （.project__stage）直接写在 HTML 里，DOM 结构对机器可见、可预测。
   - 3D 旋转只作用在 <figure class="project__media"> 上，文字说明不跟着转。
   - 尊重 prefers-reduced-motion：用户系统开了"减少动态效果"就完全不跑动画。
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const reveal = () => document.body.classList.remove('is-loading');

  /* 等图片解码完成再揭开遮罩，避免滚动时才加载导致位置跳动 */
  function preloadImages() {
    return new Promise((resolve) => {
      if (typeof imagesLoaded !== 'function') return resolve();
      imagesLoaded(document.querySelectorAll('.project__media img'), resolve);
    });
  }

  /* -------------------------------------------------- 平滑滚动 */
  function initSmoothScrolling() {
    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* -------------------------------------------------- 卡片左右错位排布 */
  function positionCards(cards) {
    const viewport = window.innerWidth;
    const cardWidth = cards[0] ? cards[0].getBoundingClientRect().width : 0;
    /* 位移幅度不能超过"视口剩余空间的一半"，否则窄屏上卡片会被推出画面、
       撑出横向滚动条。手机上这个值自然收敛到接近 0，卡片就是居中的。 */
    const headroom = Math.max((viewport - cardWidth) / 2, 0);
    const amplitude = Math.min(viewport * 0.18, headroom);

    cards.forEach((card, i) => {
      gsap.set(card, { x: Math.sin(i * 0.45) * amplitude });
    });
  }

  /* -------------------------------------------------- 滚动驱动的 3D 旋转 */
  function initMediaRotation(medias) {
    medias.forEach((media) => {
      const rotationX = gsap.utils.random(70, 120);
      const rotationY = gsap.utils.random(-20, 20);
      const rotationZ = gsap.utils.random(-20, 20);
      const setZ = gsap.quickSetter(media, 'z', 'px');

      gsap.fromTo(
        media,
        { rotationX, rotationY, rotationZ },
        {
          rotationX: -rotationX,
          rotationY: -rotationY,
          rotationZ: -rotationZ,
          ease: 'none',
          scrollTrigger: {
            trigger: media,
            start: 'top bottom+=20%',
            end: 'bottom top-=20%',
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate(self) {
              setZ(Math.sin(self.progress * Math.PI) * -50);
            },
          },
        }
      );
    });
  }

  /* -------------------------------------------------- 背景跑马灯 */
  function initMarquee() {
    const inner = document.querySelector('.marquee__inner');
    const work = document.querySelector('.projects');
    if (!inner || !work) return;

    gsap
      .timeline({
        scrollTrigger: {
          trigger: work,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })
      .fromTo(inner, { x: '100vw' }, { x: '-100%', ease: 'none' });
  }

  /* -------------------------------------------------- 启动 */
  function init() {
    const cards = gsap.utils.toArray('.project');
    const medias = gsap.utils.toArray('.project__media');

    gsap.registerPlugin(ScrollTrigger);
    initSmoothScrolling();
    positionCards(cards);
    initMediaRotation(medias);
    initMarquee();

    window.addEventListener('resize', () => {
      positionCards(cards);
      ScrollTrigger.refresh();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await preloadImages();
    reveal();
    if (!prefersReducedMotion) init();
  });
})();
