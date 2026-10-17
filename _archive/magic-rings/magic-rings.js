/* ==========================================================================
   MagicRings — 移植自 React Bits（MIT + Commons Clause，见 licenses/）
   https://reactbits.dev/animations/magic-rings

   原组件是 React 外壳（ref + useEffect）包一个 Three.js 自定义 shader；
   外壳换成显式的 destroy()/pause()/resume() 生命周期，shader 逐字未改。

   与原组件的行为差异（刻意的，不是遗漏）：
   - 只保留 ResizeObserver 监听容器尺寸，去掉了原组件里那条冗余的
     window resize 监听（容器尺寸变化本身就会触发 ResizeObserver）。
   - destroy() 里补了 geometry.dispose()，原组件没释放这个。
   - pause()/resume() 是外部可调的手动开关，和组件内置的
     IntersectionObserver + visibilitychange 可见性判断分开维护：
     两者任一条件不满足都不会启动渲染循环。
   ========================================================================== */

import * as THREE from 'three';

const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
uniform float uCoverageAlpha;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  p -= uMouse * uMouseInfluence;
  float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.3;
  p /= sc;
  vec3 c = vec3(0.0);
  float coverage = 0.0;
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    float ringAmount = ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px);
    c = mix(c, rc, vec3(ringAmount));
    coverage = max(coverage, ringAmount);
  }
  c *= 1.0 + uBurst * 2.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  float intensity = max(c.r, max(c.g, c.b));
  vec3 emissiveColor = intensity > 0.0001 ? clamp(c / intensity, 0.0, 1.0) : vec3(0.0);
  vec3 outputColor = mix(emissiveColor, clamp(c, 0.0, 1.0), uCoverageAlpha);
  float outputAlpha = mix(intensity, coverage, uCoverageAlpha);
  gl_FragColor = vec4(outputColor, clamp(outputAlpha * uOpacity, 0.0, 1.0));
}
`;

const DEFAULTS = {
  color: '#fc42ff',
  colorTwo: '#42fcff',
  speed: 1,
  ringCount: 6,
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
  alphaMode: 'luminance',
};

const NOOP_CONTROLLER = { destroy() {}, pause() {}, resume() {} };

export function createMagicRings(container, options = {}) {
  if (!container) return NOOP_CONTROLLER;

  const props = { ...DEFAULTS, ...options };

  if (props.blur > 0) {
    container.style.filter = `blur(${props.blur}px)`;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true });
  } catch {
    return NOOP_CONTROLLER;
  }

  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return NOOP_CONTROLLER;
  }

  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
  camera.position.z = 1;

  const uniforms = {
    uTime: { value: 0 },
    uAttenuation: { value: 0 },
    uResolution: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color() },
    uColorTwo: { value: new THREE.Color() },
    uLineThickness: { value: 0 },
    uBaseRadius: { value: 0 },
    uRadiusStep: { value: 0 },
    uScaleRate: { value: 0 },
    uRingCount: { value: 0 },
    uOpacity: { value: 1 },
    uNoiseAmount: { value: 0 },
    uRotation: { value: 0 },
    uRingGap: { value: 1.6 },
    uFadeIn: { value: 0.5 },
    uFadeOut: { value: 0.75 },
    uMouse: { value: new THREE.Vector2() },
    uMouseInfluence: { value: 0 },
    uHoverAmount: { value: 0 },
    uHoverScale: { value: 1 },
    uParallax: { value: 0 },
    uBurst: { value: 0 },
    uCoverageAlpha: { value: 0 },
  };

  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
  const quad = new THREE.Mesh(geometry, material);
  scene.add(quad);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    uniforms.uResolution.value.set(w * dpr, h * dpr);
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const mouse = [0, 0];
  const smoothMouse = [0, 0];
  let hoverAmount = 0;
  let isHovered = false;
  let burst = 0;

  const onMouseMove = (e) => {
    const rect = container.getBoundingClientRect();
    mouse[0] = (e.clientX - rect.left) / rect.width - 0.5;
    mouse[1] = -((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onMouseEnter = () => { isHovered = true; };
  const onMouseLeave = () => {
    isHovered = false;
    mouse[0] = 0;
    mouse[1] = 0;
  };
  const onClick = () => { burst = 1; };

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseenter', onMouseEnter);
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('click', onClick);

  let frameId = 0;
  let isVisible = false;
  let isPageVisible = !document.hidden;
  let isManuallyPaused = false;
  let elapsed = 0;
  let lastT = 0;

  const animate = (t) => {
    frameId = requestAnimationFrame(animate);

    const dt = lastT === 0 ? 0 : Math.min(t - lastT, 100);
    lastT = t;
    elapsed += dt * 0.001 * props.speed;

    smoothMouse[0] += (mouse[0] - smoothMouse[0]) * 0.08;
    smoothMouse[1] += (mouse[1] - smoothMouse[1]) * 0.08;
    hoverAmount += ((isHovered ? 1 : 0) - hoverAmount) * 0.08;
    burst *= 0.95;
    if (burst < 0.001) burst = 0;

    uniforms.uTime.value = elapsed;
    uniforms.uAttenuation.value = props.attenuation;
    uniforms.uColor.value.set(props.color);
    uniforms.uColorTwo.value.set(props.colorTwo);
    uniforms.uLineThickness.value = props.lineThickness;
    uniforms.uBaseRadius.value = props.baseRadius;
    uniforms.uRadiusStep.value = props.radiusStep;
    uniforms.uScaleRate.value = props.scaleRate;
    uniforms.uRingCount.value = props.ringCount;
    uniforms.uOpacity.value = props.opacity;
    uniforms.uNoiseAmount.value = props.noiseAmount;
    uniforms.uRotation.value = (props.rotation * Math.PI) / 180;
    uniforms.uRingGap.value = props.ringGap;
    uniforms.uFadeIn.value = props.fadeIn;
    uniforms.uFadeOut.value = props.fadeOut;
    uniforms.uMouse.value.set(smoothMouse[0], smoothMouse[1]);
    uniforms.uMouseInfluence.value = props.followMouse ? props.mouseInfluence : 0;
    uniforms.uHoverAmount.value = hoverAmount;
    uniforms.uHoverScale.value = props.hoverScale;
    uniforms.uParallax.value = props.parallax;
    uniforms.uBurst.value = props.clickBurst ? burst : 0;
    uniforms.uCoverageAlpha.value = props.alphaMode === 'coverage' ? 1 : 0;

    renderer.render(scene, camera);
  };

  const tryStart = () => {
    if (isVisible && isPageVisible && !isManuallyPaused && frameId === 0) {
      lastT = 0;
      frameId = requestAnimationFrame(animate);
    }
  };
  const tryStop = () => {
    if (frameId !== 0) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      isVisible ? tryStart() : tryStop();
    },
    { threshold: 0 }
  );
  io.observe(container);

  const onVisibility = () => {
    isPageVisible = !document.hidden;
    isPageVisible ? tryStart() : tryStop();
  };
  document.addEventListener('visibilitychange', onVisibility);

  tryStart();

  function destroy() {
    tryStop();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    ro.disconnect();
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('mouseenter', onMouseEnter);
    container.removeEventListener('mouseleave', onMouseLeave);
    container.removeEventListener('click', onClick);
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }

  function pause() {
    isManuallyPaused = true;
    tryStop();
  }

  function resume() {
    isManuallyPaused = false;
    tryStart();
  }

  return { destroy, pause, resume };
}
