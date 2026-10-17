/* ==========================================================================
   ParticleText — 移植自 React Bits（许可证见 licenses/）
   https://reactbits.dev/text-animations/particle-text

   原组件的 React 外壳只是一层 useEffect：effect body 变成下面的 init 逻辑，
   cleanup 变成 destroy()。采样算法、缓动、粒子分布逻辑逐字照搬。

   与原组件的行为差异（刻意的，不是遗漏）：
   - pointer 监听直接挂在 canvas 上（跟原组件一样），用 canvas 自己的
     getBoundingClientRect() 换算坐标。早期版本因为 hero 里还有导航链接，
     把 canvas 设成 pointer-events: none、监听挪到外层容器——那三个链接
     后来整个删了，hero 里已经没有别的可点元素，这条限制没有意义了，
     所以挪回原组件的做法：canvas 恢复接收 pointer 事件。
   - 所有 pointer 监听加了 { passive: true }，且不再有 touch-action: none
     （那条规则在 demo 的小盒子里没事，铺满 hero 之后会让手机没法滚动页面）。
   - prefers-reduced-motion 下，原组件仍然会无限循环 rAF 画同一张静态帧；
     这里画完那一帧就不再重新排队，循环真正停下来。
   - 新增 pause()/resume()，供外部（IntersectionObserver）在 hero 滚出/
     滚入视口时挂起、恢复渲染循环——原组件没有这个需求，因为它假设组件
     一直在视口里。
   - 新增返回值：canvas 或 2d context 不可用时返回 null（不是一个空的
     controller），调用方据此决定要不要把 h1 恢复成正常可见文字。
   ========================================================================== */

const hexToRgb = hex => {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
};

const mixRgb = (from, to, amount) => ({
  r: Math.round(from.r + (to.r - from.r) * amount),
  g: Math.round(from.g + (to.g - from.g) * amount),
  b: Math.round(from.b + (to.b - from.b) * amount)
});

const rgbToCss = rgb => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

const resolveFontSize = (value, container, fontWeight, fontFamily) => {
  if (typeof value === 'number') return value;

  const probe = document.createElement('span');
  probe.textContent = 'M';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.fontSize = value;
  probe.style.fontWeight = String(fontWeight);
  probe.style.fontFamily = fontFamily;
  container.appendChild(probe);
  const size = parseFloat(window.getComputedStyle(probe).fontSize) || 96;
  probe.remove();
  return size;
};

const waitForFonts = async font => {
  if (!('fonts' in document)) return;

  try {
    await document.fonts.load(font);
  } catch {}

  await document.fonts.ready;
};

const DEFAULTS = {
  text: 'React Bits',
  particleSize: 2,
  density: 4,
  color: '#ffffff',
  highlightColor: '#8b5cf6',
  scatter: 180,
  gatherDuration: 1600,
  stagger: 420,
  pointerRepel: 40,
  repelRadius: 120,
  idleDrift: 0.7,
  trigger: 'mount',
  fontSize: 'clamp(3rem, 12vw, 8rem)',
  fontWeight: 800,
  fontFamily: 'inherit',
  glow: true,
};

export function createParticleText(container, options = {}) {
  if (!container) return null;

  const props = { ...DEFAULTS, ...options };
  const { text, particleSize, density, color, highlightColor, scatter, gatherDuration,
    stagger, pointerRepel, repelRadius, idleDrift, trigger, fontSize, fontWeight,
    fontFamily, glow } = props;

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return null;
  }

  let particles = [];
  let animationFrame = null;
  let resizeFrame = null;
  let buildId = 0;
  let gathering = false;
  let gatherStart = 0;
  let reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let destroyed = false;
  let manuallyPaused = false;

  const pointer = {
    active: false,
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0
  };

  const startGather = (fromScatter = true) => {
    if (!particles.length) return;

    const now = performance.now();
    const spread = reducedMotion ? 0 : scatter;

    particles.forEach(particle => {
      if (fromScatter) {
        const angle = particle.seed * Math.PI * 2;
        const distance = spread * (0.35 + particle.depth * 0.75);
        particle.x = particle.targetX + Math.cos(angle) * distance + (particle.depth - 0.5) * spread * 0.55;
        particle.y = particle.targetY + Math.sin(angle) * distance + (particle.seed - 0.5) * spread * 0.55;
      }

      particle.startX = particle.x;
      particle.startY = particle.y;
      particle.delay = reducedMotion ? 0 : particle.seed * stagger;
    });

    gatherStart = now;
    gathering = true;
  };

  const drawParticle = particle => {
    const size = particle.size;
    ctx.fillStyle = particle.color;

    if (size <= 2.1) {
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      return;
    }

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const render = now => {
    ctx.clearRect(0, 0, width, height);

    if (glow && !reducedMotion) {
      ctx.shadowBlur = particleSize * 3;
      ctx.shadowColor = highlightColor;
    } else {
      ctx.shadowBlur = 0;
    }

    pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
    pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

    let complete = true;

    particles.forEach(particle => {
      let baseX = particle.targetX;
      let baseY = particle.targetY;
      let progress = 1;

      if (gathering) {
        const local = (now - gatherStart - particle.delay) / Math.max(1, reducedMotion ? 1 : gatherDuration);
        progress = clamp(local, 0, 1);
        const eased = easeOutCubic(progress);
        baseX = particle.startX + (particle.targetX - particle.startX) * eased;
        baseY = particle.startY + (particle.targetY - particle.startY) * eased;
        if (progress < 1) complete = false;
      } else if (!reducedMotion && idleDrift > 0) {
        const driftTime = now * 0.001;
        baseX += Math.sin(driftTime * 0.9 + particle.seed * 10) * idleDrift * particle.depth;
        baseY += Math.cos(driftTime * 0.75 + particle.depth * 10) * idleDrift * particle.depth;
      }

      if (pointer.active && !reducedMotion && pointerRepel > 0 && repelRadius > 0) {
        const dx = baseX - pointer.smoothX;
        const dy = baseY - pointer.smoothY;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < repelRadius) {
          const force = Math.pow(1 - distance / repelRadius, 2) * pointerRepel;
          baseX += (dx / distance) * force;
          baseY += (dy / distance) * force;
        }
      }

      const follow = reducedMotion ? 1 : 0.22;
      particle.x += (baseX - particle.x) * follow;
      particle.y += (baseY - particle.y) * follow;

      ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
      drawParticle(particle);
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (gathering && complete) {
      gathering = false;
    }

    /* 原组件到这里会无条件再排一帧，永远转下去。这里加两道闸：手动暂停
       （hero 滚出视口）和 reduced-motion 静态帧画完之后都不再排下一帧。 */
    if (destroyed || manuallyPaused) return;
    if (reducedMotion && !gathering) {
      animationFrame = null;
      return;
    }
    animationFrame = window.requestAnimationFrame(render);
  };

  const ensureRenderLoop = () => {
    if (animationFrame === null && !manuallyPaused) {
      animationFrame = window.requestAnimationFrame(render);
    }
  };

  const sampleText = async () => {
    const currentBuild = ++buildId;
    const rect = container.getBoundingClientRect();
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const computed = window.getComputedStyle(container);
    const resolvedFamily = fontFamily === 'inherit' ? computed.fontFamily || 'sans-serif' : fontFamily;
    let resolvedSize = resolveFontSize(fontSize, container, fontWeight, resolvedFamily);
    let font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;

    await waitForFonts(font);
    if (currentBuild !== buildId) return;

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    const content = String(text || ' ');
    const maxTextWidth = width * 0.92;
    offCtx.font = font;
    let metrics = offCtx.measureText(content);
    const measuredWidth = Math.max(1, metrics.width);
    if (measuredWidth > maxTextWidth) {
      resolvedSize = Math.max(18, resolvedSize * (maxTextWidth / measuredWidth));
      font = `${fontWeight} ${resolvedSize}px ${resolvedFamily}`;
      await waitForFonts(font);
      if (currentBuild !== buildId) return;
      offCtx.font = font;
      metrics = offCtx.measureText(content);
    }

    const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
    const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
    const padding = Math.max(12, Math.ceil(resolvedSize * 0.08));
    const textWidth = Math.max(1, left + right);
    const textHeight = Math.max(1, ascent + descent);

    offscreen.width = textWidth + padding * 2;
    offscreen.height = textHeight + padding * 2;
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.font = font;
    offCtx.textAlign = 'left';
    offCtx.textBaseline = 'alphabetic';
    offCtx.fillStyle = '#ffffff';
    offCtx.fillText(content, padding - left, padding + ascent);

    const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const targets = [];
    const step = Math.max(2, Math.floor(density));

    for (let y = 0; y < offscreen.height; y += step) {
      for (let x = 0; x < offscreen.width; x += step) {
        const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
        if (alpha > 40) {
          targets.push({
            x: width / 2 - offscreen.width / 2 + x,
            y: height / 2 - offscreen.height / 2 + y,
            alpha: alpha / 255
          });
        }
      }
    }

    const maxParticles = Math.max(900, Math.min(5200, Math.floor((width * height) / 90)));
    const stride = Math.max(1, Math.ceil(targets.length / maxParticles));
    const baseRgb = hexToRgb(color);
    const highlightRgb = hexToRgb(highlightColor);
    const selected = targets.filter((_, index) => index % stride === 0);

    particles = selected.map((target, index) => {
      const seed = ((index * 9301 + 49297) % 233280) / 233280;
      const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
      const blend = baseRgb && highlightRgb ? clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
      const particleColor = baseRgb && highlightRgb ? rgbToCss(mixRgb(baseRgb, highlightRgb, blend)) : color;
      const angle = seed * Math.PI * 2;
      const distance = (reducedMotion ? 0 : scatter) * (0.35 + depth * 0.75);
      const startX = target.x + Math.cos(angle) * distance + (seed - 0.5) * scatter * 0.45;
      const startY = target.y + Math.sin(angle) * distance + (depth - 0.9) * scatter * 0.45;

      return {
        x: reducedMotion ? target.x : startX,
        y: reducedMotion ? target.y : startY,
        startX,
        startY,
        targetX: target.x,
        targetY: target.y,
        size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)),
        color: particleColor,
        seed,
        depth,
        delay: seed * stagger
      };
    });

    pointer.x = width / 2;
    pointer.y = height / 2;
    pointer.smoothX = pointer.x;
    pointer.smoothY = pointer.y;

    if (reducedMotion) {
      particles.forEach(particle => {
        particle.x = particle.targetX;
        particle.y = particle.targetY;
        particle.startX = particle.targetX;
        particle.startY = particle.targetY;
        particle.delay = 0;
      });
      gathering = false;
    } else {
      startGather(false);
    }

    ensureRenderLoop();
  };

  const queueSample = () => {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(sampleText);
  };

  const handlePointerMove = event => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  };

  const handlePointerLeave = () => {
    pointer.active = false;
  };

  const handlePointerEnter = event => {
    handlePointerMove(event);
    if (trigger === 'hover') startGather(true);
  };

  const handleClick = () => {
    if (trigger === 'click') startGather(true);
  };

  const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const handleReduceMotionChange = event => {
    reducedMotion = event.matches;
    sampleText();
  };

  reduceMotionQuery?.addEventListener('change', handleReduceMotionChange);
  canvas.addEventListener('pointerenter', handlePointerEnter, { passive: true });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
  canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  canvas.addEventListener('click', handleClick, { passive: true });

  const resizeObserver = new ResizeObserver(queueSample);
  resizeObserver.observe(container);
  sampleText();

  function destroy() {
    destroyed = true;
    buildId += 1;
    resizeObserver.disconnect();
    reduceMotionQuery?.removeEventListener('change', handleReduceMotionChange);
    canvas.removeEventListener('pointerenter', handlePointerEnter);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerleave', handlePointerLeave);
    canvas.removeEventListener('click', handleClick);

    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    canvas.remove();
  }

  function pause() {
    manuallyPaused = true;
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function resume() {
    if (destroyed) return;
    manuallyPaused = false;
    if (animationFrame === null) {
      animationFrame = window.requestAnimationFrame(render);
    }
  }

  return { destroy, pause, resume };
}
