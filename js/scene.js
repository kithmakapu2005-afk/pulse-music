// Hero scene: a glossy vinyl record on a floating neon turntable, with a ring of light bars,
// sound-wave rings, beat ripples and drifting particles. Three.js r170.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TAU = Math.PI * 2;
const BG = 0x05050a;
const NEON = ['#f472b6', '#a855f7', '#3b82f6', '#22d3ee', '#a855f7', '#f472b6'].map((c) => new THREE.Color(c));

const RECORD_R = 2.05;
const BAR_RADIUS = 2.62;
const BASE_TILT = 0.52;
const CAM_ELEVATION = 0.2;
const ARM_PLAY = 1.0;
const ARM_REST = 1.36;
const PITCH_DOWN = 0.105;
const PITCH_UP = 0.05;

function neonAt(t, out = new THREE.Color()) {
  t = ((t % 1) + 1) % 1;
  const x = t * (NEON.length - 1);
  const i = Math.min(Math.floor(x), NEON.length - 2);
  return out.copy(NEON[i]).lerp(NEON[i + 1], x - i);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function curvedText(g, text, cx, cy, radius, centerAngle, { font, color, spacing = 0, bottom = false }) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  const dir = bottom ? -1 : 1;
  let angle = centerAngle - (dir * total) / radius / 2;
  chars.forEach((ch, i) => {
    angle += (dir * widths[i]) / 2 / radius;
    g.save();
    g.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    g.rotate(angle + (bottom ? -Math.PI / 2 : Math.PI / 2));
    g.fillText(ch, 0, 0);
    g.restore();
    angle += (dir * widths[i]) / 2 / radius;
  });
  g.restore();
}

function makeRecordTexture(size, logo, maxAniso, version) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2;
  const R = size / 2;
  const px = size / 2048;

  // vinyl body
  g.fillStyle = '#09090c';
  g.beginPath();
  g.arc(cx, cx, R, 0, TAU);
  g.fill();

  // grooves
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = R * 0.355; r < R * 0.975; r += 2.1 * px) {
    g.strokeStyle = `rgba(255,255,255,${0.018 + rand() * 0.04})`;
    g.lineWidth = 0.9 * px;
    g.beginPath();
    g.arc(cx, cx, r, 0, TAU);
    g.stroke();
  }
  // gaps between tracks
  [0.47, 0.6, 0.72, 0.85].forEach((f) => {
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = 9 * px;
    g.beginPath();
    g.arc(cx, cx, R * f, 0, TAU);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1 * px;
    g.beginPath();
    g.arc(cx, cx, R * f + 5 * px, 0, TAU);
    g.stroke();
  });
  // smooth lead-in and outer lip
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.lineWidth = 18 * px;
  g.beginPath();
  g.arc(cx, cx, R * 0.982, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 3 * px;
  g.beginPath();
  g.arc(cx, cx, R * 0.995, 0, TAU);
  g.stroke();

  // label
  const LR = R * 0.34;
  const grad = g.createRadialGradient(cx - LR * 0.35, cx - LR * 0.4, LR * 0.05, cx, cx, LR);
  grad.addColorStop(0, '#9d6bff');
  grad.addColorStop(0.5, '#6d28d9');
  grad.addColorStop(1, '#22095a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, LR, 0, TAU);
  g.fill();

  const ring = g.createLinearGradient(cx - LR, cx - LR, cx + LR, cx + LR);
  ring.addColorStop(0, '#f472b6');
  ring.addColorStop(0.5, '#a855f7');
  ring.addColorStop(1, '#22d3ee');
  g.strokeStyle = ring;
  g.lineWidth = LR * 0.035;
  g.beginPath();
  g.arc(cx, cx, LR * 0.95, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = LR * 0.008;
  g.beginPath();
  g.arc(cx, cx, LR * 0.66, 0, TAU);
  g.stroke();

  if (logo) {
    g.save();
    g.beginPath();
    g.arc(cx, cx, LR * 0.64, 0, TAU);
    g.clip();
    g.globalCompositeOperation = 'screen';
    const s = LR * 1.5;
    g.drawImage(logo, cx - s / 2, cx - s / 2 - LR * 0.06, s, s);
    g.restore();
  }

  curvedText(g, 'PULSE MUSIC', cx, cx, LR * 0.8, -Math.PI / 2, {
    font: `600 ${Math.round(LR * 0.13)}px Unbounded, Inter, sans-serif`,
    color: '#ffffff',
    spacing: LR * 0.035,
  });
  curvedText(g, `FEEL EVERY BEAT  ·  OFFLINE${version ? `  ·  ${version}` : ''}`, cx, cx, LR * 0.8, Math.PI / 2, {
    font: `500 ${Math.round(LR * 0.072)}px "JetBrains Mono", monospace`,
    color: 'rgba(255,255,255,0.78)',
    spacing: LR * 0.02,
    bottom: true,
  });

  // spindle hole
  g.fillStyle = '#020204';
  g.beginPath();
  g.arc(cx, cx, R * 0.02, 0, TAU);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso);
  return tex;
}

export async function createHeroScene({ canvas, container, reducedMotion = false, paused = false, getSpectrum = () => null, logoSrc, version = '' }) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || coarse;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, stencil: false, powerPreference: 'high-performance' });
  const quality = { dpr: Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75), bloom: true };
  renderer.setPixelRatio(quality.dpr);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  // Reflections come from a dark room lit by neon strips, so gloss reads as coloured light.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x050510, side: THREE.BackSide })));
  // Flat panels facing the centre: their reflections read as streaks, never as square hotspots.
  const strip = (color, pos, size, rotY = 0, rotZ = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    m.rotateZ(rotZ + rotY * 0.3);
    envScene.add(m);
  };
  strip(new THREE.Color(3.2, 1.0, 6), [-7, 5, -4], [12, 0.3, 0.3], 0.5, 0.15);
  strip(new THREE.Color(0.5, 3.2, 4.5), [7, 3.5, 3], [11, 0.25, 0.25], -0.6, -0.1);
  strip(new THREE.Color(0.6, 1.0, 3.2), [0, 9, 6], [14, 0.2, 0.2]);
  strip(new THREE.Color(0.8, 0.8, 1.1), [2, 8, -6], [5, 0.15, 0.15], 0.9);
  const envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 140);
  const root = new THREE.Group();
  scene.add(root);
  const deck = new THREE.Group();
  deck.rotation.x = BASE_TILT;
  root.add(deck);

  /* ---------- background glow (in-scene, so bloom and the clear colour agree) ---------- */
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vPos;
      uniform float uLevel;
      uniform float uTime;
      vec3 blob(vec2 p, vec2 c, float r, vec3 col) { float d = length(p - c) / r; return col * exp(-d * d * 2.4); }
      void main() {
        vec2 p = vPos;
        vec3 col = blob(p, vec2(0.0, 0.8), 7.0, vec3(0.22, 0.06, 0.55)) * (0.2 + 0.18 * uLevel)
                 + blob(p, vec2(-12.0, 5.5), 9.0, vec3(0.04, 0.12, 0.42)) * 0.14
                 + blob(p, vec2(7.0, -5.0), 7.0, vec3(0.02, 0.3, 0.42)) * (0.1 + 0.04 * sin(uTime * 0.4));
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), glowMat);
  glow.position.set(0, 0, -12);
  root.add(glow);

  /* ---------- lights ---------- */
  scene.add(new THREE.AmbientLight(0x6a5acd, 0.12));
  const key = new THREE.DirectionalLight(0xbfc8ff, 0.45);
  key.position.set(-4, 8, 6);
  scene.add(key);
  const purple = new THREE.PointLight(0xa855f7, 60, 16, 2);
  const cyan = new THREE.PointLight(0x22d3ee, 45, 16, 2);
  const blue = new THREE.PointLight(0x3b82f6, 30, 14, 2);
  deck.add(purple, cyan, blue);
  blue.position.set(0, 3, 3.5);

  /* ---------- turntable ---------- */
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdedeea, metalness: 1, roughness: 0.16 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x15151d, metalness: 0.85, roughness: 0.32 });

  const platter = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.36, 0.16, 160), darkMetal);
  platter.position.y = -0.1;
  deck.add(platter);

  const mat = new THREE.Mesh(new THREE.CircleGeometry(2.14, 128), new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 1, metalness: 0 }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = -0.015;
  deck.add(mat);

  // neon rim ring
  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uC: { value: NEON.slice(0, 5) },
    },
    vertexShader: /* glsl */ `
      varying float vT;
      void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying float vT;
      uniform float uTime;
      uniform float uLevel;
      uniform vec3 uC[5];
      vec3 neon(float t) {
        t = fract(t) * 4.0;
        if (t < 1.0) return mix(uC[0], uC[1], t);
        if (t < 2.0) return mix(uC[1], uC[2], t - 1.0);
        if (t < 3.0) return mix(uC[2], uC[3], t - 2.0);
        return mix(uC[3], uC[4], t - 3.0);
      }
      void main() {
        float t = vT + uTime * 0.03;
        float comet = pow(max(0.0, cos((vT - fract(uTime * 0.12)) * 6.2831853)), 40.0);
        vec3 col = neon(t) * (1.7 + 1.6 * uLevel) + vec3(1.0) * comet * 2.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.39, 0.02, 10, 400), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.02;
  deck.add(ring);

  const outerLine = new THREE.Mesh(
    new THREE.RingGeometry(2.86, 2.875, 200),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  outerLine.rotation.x = -Math.PI / 2;
  outerLine.position.y = -0.18;
  deck.add(outerLine);

  // the record
  const logo = logoSrc ? await loadImage(logoSrc).catch(() => null) : null;
  if (document.fonts) {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('600 40px Unbounded'), document.fonts.load('500 20px "JetBrains Mono"')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch { /* fonts are optional */ }
  }
  const recordTex = makeRecordTexture(small ? 1024 : 2048, logo, renderer.capabilities.getMaxAnisotropy(), version);
  const recordTop = new THREE.MeshPhysicalMaterial({
    map: recordTex,
    roughness: 0.6,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
  });
  const recordSide = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.28, metalness: 0.2 });
  const record = new THREE.Mesh(new THREE.CylinderGeometry(RECORD_R, RECORD_R, 0.035, 180, 1), [recordSide, recordTop, recordSide]);
  record.position.y = 0.0175;
  deck.add(record);

  // stationary light falling on the grooves (the record turns underneath it)
  const sheenMat = new THREE.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uAngle: { value: 0.9 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy / ${RECORD_R.toFixed(2)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      uniform float uLevel;
      uniform float uAngle;
      uniform float uTime;
      void main() {
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float grooveZone = smoothstep(0.35, 0.38, r) * (1.0 - smoothstep(0.96, 0.985, r));
        float w1 = pow(max(cos(a - uAngle), 0.0), 26.0);
        float w2 = pow(max(cos(a - uAngle - 3.14159265), 0.0), 26.0);
        float fine = 0.65 + 0.35 * sin(r * 900.0);
        vec3 col = vec3(0.75, 0.45, 1.0) * w1 + vec3(0.35, 0.85, 1.0) * w2;
        float strength = grooveZone * fine * (0.32 + 0.3 * uLevel);
        gl_FragColor = vec4(col * strength, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(RECORD_R, 160), sheenMat);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.037;
  deck.add(sheen);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 24), chrome);
  spindle.position.y = 0.09;
  deck.add(spindle);

  /* ---------- tonearm ---------- */
  const armBase = new THREE.Group();
  armBase.position.set(2.75, 0, -1.4);
  deck.add(armBase);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 48), darkMetal);
  plinth.position.y = -0.06;
  armBase.add(plinth);
  const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 2.4) }));
  plinthRing.rotation.x = -Math.PI / 2;
  plinthRing.position.y = 0.045;
  armBase.add(plinthRing);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 24), chrome);
  post.position.y = 0.19;
  armBase.add(post);

  const armYaw = new THREE.Group();
  armYaw.position.y = 0.36;
  armYaw.rotation.y = paused ? ARM_REST : ARM_PLAY;
  armBase.add(armYaw);
  const armPitch = new THREE.Group();
  armPitch.rotation.z = paused ? PITCH_UP : PITCH_DOWN;
  armYaw.add(armPitch);

  const ARM_LEN = 3.0;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ARM_LEN, 16), chrome);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = -ARM_LEN / 2;
  armPitch.add(tube);
  const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), chrome);
  armPitch.add(hinge);
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 32), darkMetal);
  weight.rotation.z = Math.PI / 2;
  weight.position.x = 0.42;
  armPitch.add(weight);
  const weightRim = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 32), chrome);
  weightRim.rotation.z = Math.PI / 2;
  weightRim.position.x = 0.3;
  armPitch.add(weightRim);
  const shell = new THREE.Group();
  shell.position.x = -ARM_LEN;
  shell.rotation.y = -0.38;
  armPitch.add(shell);
  const shellBody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.16), darkMetal);
  shellBody.position.x = -0.12;
  shell.add(shellBody);
  const shellTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.03), chrome);
  shellTop.position.set(-0.12, 0.031, 0);
  shell.add(shellTop);
  const stylusLight = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.2) }));
  stylusLight.position.set(-0.22, -0.035, 0);
  shell.add(stylusLight);

  /* ---------- light-bar visualiser ---------- */
  const BAR_COUNT = small ? 72 : 112;
  const barGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
  barGeo.translate(0, 0.5, 0);
  const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.9, 1.9) });
  const bars = new THREE.InstancedMesh(barGeo, barMat, BAR_COUNT);
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < BAR_COUNT; i++) bars.setColorAt(i, neonAt(i / BAR_COUNT, tmpColor));
  bars.instanceColor.needsUpdate = true;
  bars.position.y = -0.18;
  deck.add(bars);
  const heights = new Float32Array(BAR_COUNT).fill(0.05);
  const dummy = new THREE.Object3D();

  /* ---------- sound-wave rings ---------- */
  const WAVE_SEG = 240;
  const waves = [
    { r: 3.05, amp: 0.1, k1: 6, k2: 11, s1: 1.4, s2: 0.9, color: new THREE.Color(1.3, 0.6, 2.4), opacity: 0.55 },
    { r: 3.4, amp: 0.13, k1: 4, k2: 9, s1: -1.0, s2: 1.6, color: new THREE.Color(0.5, 0.9, 2.4), opacity: 0.38 },
    { r: 3.85, amp: 0.16, k1: 3, k2: 7, s1: 0.7, s2: -1.2, color: new THREE.Color(0.3, 1.6, 2.0), opacity: 0.22 },
  ].map((w) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WAVE_SEG * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: w.color, transparent: true, opacity: w.opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.position.y = -0.16;
    deck.add(line);
    return { ...w, line, geo };
  });

  /* ---------- beat ripples ---------- */
  const rippleGeo = new THREE.RingGeometry(0.985, 1, 180);
  const ripples = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.17;
    m.visible = false;
    deck.add(m);
    return { mesh: m, age: 0, life: 1, active: false };
  });
  let rippleHue = 0;
  function spawnRipple(strength = 1) {
    const r = ripples.find((x) => !x.active) || ripples[0];
    r.active = true;
    r.age = 0;
    r.life = 1.8 + Math.random() * 0.4;
    r.strength = strength;
    neonAt((rippleHue += 0.17), r.mesh.material.color).multiplyScalar(2.2);
    r.mesh.visible = true;
  }

  /* ---------- particles ---------- */
  const P_COUNT = small ? 650 : 1500;
  const pGeo = new THREE.BufferGeometry();
  const aRadius = new Float32Array(P_COUNT);
  const aAngle = new Float32Array(P_COUNT);
  const aY = new Float32Array(P_COUNT);
  const aSpeed = new Float32Array(P_COUNT);
  const aSize = new Float32Array(P_COUNT);
  const aHue = new Float32Array(P_COUNT);
  for (let i = 0; i < P_COUNT; i++) {
    const r = 2.9 + Math.pow(Math.random(), 0.8) * 10;
    aRadius[i] = r;
    aAngle[i] = Math.random() * TAU;
    const spread = 0.25 + (r - 2.9) * 0.28;
    aY[i] = (Math.random() + Math.random() + Math.random() - 1.5) * spread;
    aSpeed[i] = -(0.04 + Math.random() * 0.07) * Math.sqrt(3 / r);
    aSize[i] = 0.6 + Math.pow(Math.random(), 3) * 2.6;
    aHue[i] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P_COUNT * 3), 3));
  pGeo.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
  pGeo.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1));
  pGeo.setAttribute('aY', new THREE.BufferAttribute(aY, 1));
  pGeo.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  pGeo.setAttribute('aHue', new THREE.BufferAttribute(aHue, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uPixelRatio: { value: quality.dpr },
      uC: { value: [NEON[0], NEON[1], NEON[2], NEON[3]] },
    },
    vertexShader: /* glsl */ `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aY;
      attribute float aSpeed;
      attribute float aSize;
      attribute float aHue;
      uniform float uTime;
      uniform float uLevel;
      uniform float uPixelRatio;
      uniform vec3 uC[4];
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float ang = aAngle + uTime * aSpeed * (1.0 + uLevel * 1.5);
        float r = aRadius * (1.0 + 0.025 * sin(uTime * 0.7 + aAngle * 5.0)) + uLevel * 0.35;
        vec3 pos = vec3(cos(ang) * r, aY + sin(uTime * 0.6 + aAngle * 3.0) * 0.16, sin(ang) * r);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (1.0 + uLevel * 0.9) * (40.0 / -mv.z);
        float h = aHue * 3.0;
        vColor = h < 1.0 ? mix(uC[0], uC[1], h) : (h < 2.0 ? mix(uC[1], uC[2], h - 1.0) : mix(uC[2], uC[3], h - 2.0));
        vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.6 + aAngle * 13.0 + aRadius * 2.0));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * 1.8, a * a * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  deck.add(particles);

  /* ---------- floor grid ---------- */
  const grid = new THREE.PolarGridHelper(8, 24, 8, 128, 0x7c3aed, 0x2a2350);
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.material.depthWrite = false;
  grid.position.y = -0.62;
  deck.add(grid);

  /* ---------- post-processing ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- layout ---------- */
  const view = { dist: 13, shiftX: 0, targetY: 0 };
  function layout() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const R = 3.2;
    const wide = w >= 900 && w / h > 1.1;
    if (wide) {
      // Keep the deck to the right of the headline column (container left edge + ~520px).
      const copyRight = Math.max(40, (w - 1200) / 2) + 520;
      const left = (copyRight / w) * 2 - 1;
      const right = 0.97;
      let e = Math.min((right - left) / 2, 0.56); // deck half-width in NDC
      const minDist = (R * 1.12) / tanHalf; // vertical breathing room
      view.dist = Math.max(R / (e * tanHalf * camera.aspect), minDist);
      const halfW = tanHalf * view.dist * camera.aspect;
      e = R / halfW;
      view.shiftX = (right - e) * halfW;
      view.targetY = 0.15;
    } else {
      view.dist = Math.max((R * 1.02) / (tanHalf * camera.aspect), (R * 0.95) / tanHalf);
      view.shiftX = 0;
      view.targetY = 0.35;
    }
    root.position.x = view.shiftX;
    camera.updateProjectionMatrix();
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  layout();
  const ro = new ResizeObserver(() => {
    layout();
    if (!running) renderFrame(0);
  });
  ro.observe(container);

  /* ---------- interaction state ---------- */
  const state = {
    paused,
    reduced: reducedMotion,
    visible: true,
    scroll: 0,
    pointer: { x: 0, y: 0 },
    smooth: { x: 0, y: 0 },
  };
  let spin = 0;
  let spinVel = paused ? 0 : 0.55;
  let energy = paused ? 0 : 1;
  let time = 3.2;
  let level = 0;
  let lastKick = 0;
  let prevLow = 0;
  let idleRippleTimer = 0;
  let wasPlaying = false;

  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    spinVel = THREE.MathUtils.clamp(spinVel - dx * 0.018, -9, 9);
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- per-frame updates ---------- */
  function updateSpectrum(data, dt) {
    const playing = Boolean(data);
    let sum = 0;
    if (playing) {
      const half = BAR_COUNT / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const k = i < half ? i : BAR_COUNT - 1 - i;
        const f = k / half;
        const bin = 1 + Math.floor(Math.pow(f, 1.55) * 110);
        const v = data[bin] / 255;
        const target = 0.06 + Math.pow(v, 1.6) * (1.0 + f * 0.6) * 1.35;
        const rate = target > heights[i] ? 0.5 : 0.12;
        heights[i] += (target - heights[i]) * rate;
      }
      let low = 0;
      for (let b = 1; b <= 4; b++) low += data[b];
      low /= 4 * 255;
      for (let b = 1; b < 48; b++) sum += data[b];
      level += ((sum / (47 * 255)) * 1.4 - level) * 0.2;
      if (low > 0.82 && low > prevLow + 0.02 && time - lastKick > 0.28) {
        lastKick = time;
        spawnRipple(1);
      }
      prevLow = low;
    } else {
      const beatPhase = (time * 1.5) % 1;
      const pulse = Math.exp(-beatPhase * 7) * energy;
      for (let i = 0; i < BAR_COUNT; i++) {
        const a = (i / BAR_COUNT) * TAU;
        const v = 0.1
          + 0.07 * Math.sin(a * 3 + time * 1.2)
          + 0.06 * Math.sin(a * 7 - time * 2.0)
          + 0.05 * Math.sin(a * 13 + time * 3.3)
          + pulse * 0.22 * (0.6 + 0.4 * Math.cos(a * 2 - time * 0.5));
        const target = 0.035 + Math.max(0, v) * energy;
        heights[i] += (target - heights[i]) * Math.min(1, dt * 8);
      }
      level += (pulse * 0.25 - level) * 0.1;
      if (energy > 0.5) {
        idleRippleTimer += dt;
        if (idleRippleTimer > 2.6) {
          idleRippleTimer = 0;
          spawnRipple(0.6);
        }
      }
    }
    for (let i = 0; i < BAR_COUNT; i++) {
      const a = (i / BAR_COUNT) * TAU;
      dummy.position.set(Math.cos(a) * BAR_RADIUS, 0, Math.sin(a) * BAR_RADIUS);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1, heights[i], 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;
    return playing;
  }

  function updateWaves() {
    waves.forEach((w, wi) => {
      const pos = w.geo.attributes.position.array;
      const amp = w.amp * (0.35 + level * 2.6) * (0.25 + 0.75 * energy);
      for (let j = 0; j < WAVE_SEG; j++) {
        const a = (j / WAVE_SEG) * TAU;
        const barIdx = Math.floor((j / WAVE_SEG) * BAR_COUNT);
        const local = heights[barIdx] * 0.5;
        const r = w.r
          + amp * (Math.sin(a * w.k1 + time * w.s1) * 0.6 + Math.sin(a * w.k2 + time * w.s2) * 0.4)
          + local * (0.12 + wi * 0.04);
        pos[j * 3] = Math.cos(a) * r;
        pos[j * 3 + 1] = 0;
        pos[j * 3 + 2] = Math.sin(a) * r;
      }
      w.geo.attributes.position.needsUpdate = true;
    });
  }

  function updateRipples(dt) {
    ripples.forEach((r) => {
      if (!r.active) return;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        return;
      }
      const s = 2.5 + t * 4.2;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - t) * (1 - t) * 0.9 * r.strength;
    });
  }

  function renderFrame(dt) {
    const data = getSpectrum();
    const playing = Boolean(data);
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      if (playing) spawnRipple(1);
    }

    const active = !state.paused;
    energy += ((active ? 1 : 0) - energy) * Math.min(1, dt * 1.6);
    time += dt * energy;

    const targetVel = state.paused ? 0 : playing ? 2.1 : 0.55;
    const ease = dragging ? 0 : Math.min(1, dt * (state.paused ? 0.9 : 1.4));
    spinVel += (targetVel - spinVel) * ease;
    spin += spinVel * dt;
    record.rotation.y = -spin;

    const armTarget = state.paused ? ARM_REST : ARM_PLAY;
    armYaw.rotation.y += (armTarget - armYaw.rotation.y) * Math.min(1, dt * 2.2);
    armPitch.rotation.z += ((state.paused ? PITCH_UP : PITCH_DOWN) - armPitch.rotation.z) * Math.min(1, dt * 3);

    updateSpectrum(data, dt);
    updateWaves();
    updateRipples(dt);

    ringMat.uniforms.uTime.value = time;
    ringMat.uniforms.uLevel.value = level;
    sheenMat.uniforms.uLevel.value = level;
    pMat.uniforms.uTime.value = time;
    pMat.uniforms.uLevel.value = level;
    glowMat.uniforms.uLevel.value = level;
    glowMat.uniforms.uTime.value = time;
    stylusLight.visible = !state.paused;

    // orbiting coloured lights
    purple.position.set(Math.cos(time * 0.35) * 4.6, 3.2, Math.sin(time * 0.35) * 4.6);
    cyan.position.set(Math.cos(time * 0.35 + Math.PI) * 4.6, 2.6, Math.sin(time * 0.35 + Math.PI) * 4.6);
    purple.intensity = 34 + level * 60;
    cyan.intensity = 18 + level * 40;
    bloom.strength = quality.bloom ? 0.65 + level * 0.45 : 0;

    // pointer parallax and scroll
    const follow = state.reduced ? 0 : Math.min(1, dt * 3);
    state.smooth.x += (state.pointer.x - state.smooth.x) * follow;
    state.smooth.y += (state.pointer.y - state.smooth.y) * follow;
    deck.rotation.x = BASE_TILT + state.smooth.y * 0.1 - state.scroll * 0.3;
    deck.rotation.z = -state.smooth.x * 0.09;
    deck.position.y = state.scroll * 1.4;

    const kick = playing ? Math.max(0, 1 - (time - lastKick) * 5) * 0.04 : 0;
    camera.position.set(
      state.smooth.x * 0.6,
      view.targetY + Math.sin(CAM_ELEVATION) * view.dist + state.smooth.y * -0.35,
      Math.cos(CAM_ELEVATION) * view.dist * (1 - kick),
    );
    camera.lookAt(0, view.targetY, 0);

    if (quality.bloom) composer.render(dt);
    else renderer.render(scene, camera);
  }

  /* ---------- loop control ---------- */
  const clock = new THREE.Clock(false);
  let running = false;
  let perfFrames = 0;
  let perfTime = 0;

  function shouldRun() {
    if (!state.visible || document.hidden) return false;
    if (getSpectrum()) return true;
    if (state.reduced) return false;
    if (state.paused && energy < 0.01 && Math.abs(spinVel) < 0.01) return false;
    return true;
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    renderFrame(dt);

    // drop to a cheaper path on slow devices
    if (perfFrames < 150) {
      perfFrames++;
      perfTime += dt;
      if (perfFrames === 150 && perfTime / 150 > 1 / 34) {
        quality.bloom = false;
        renderer.setPixelRatio(1);
        layout();
      }
    }
    if (!shouldRun()) stop();
  }

  function start() {
    if (running || !shouldRun()) return;
    running = true;
    clock.start();
    clock.getDelta();
    renderer.setAnimationLoop(tick);
  }
  function stop() {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
    clock.stop();
  }
  function wake() {
    start();
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // first frame: settle the idle state, then start the loop if motion is allowed
  for (let i = 0; i < 30; i++) renderFrame(1 / 60);
  start();

  return {
    setPaused(v) {
      state.paused = v;
      start();
    },
    setReducedMotion(v) {
      state.reduced = v;
      if (v) {
        state.pointer.x = state.pointer.y = 0;
        if (!getSpectrum()) {
          stop();
          renderFrame(0);
        }
      } else start();
    },
    setVisible(v) {
      state.visible = v;
      if (v) start();
      else stop();
    },
    setScroll(p) {
      state.scroll = p;
      if (!running && state.visible) renderFrame(0);
    },
    setPointer(x, y) {
      if (state.reduced) return;
      state.pointer.x = x;
      state.pointer.y = y;
    },
    wake,
    dispose() {
      stop();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
