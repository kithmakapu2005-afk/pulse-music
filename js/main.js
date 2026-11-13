// Pulse Music landing page — interactions.
// The Three.js hero is loaded lazily (js/scene.js) so text and layout paint first.

import { BeatEngine } from './beat.js';

const root = document.documentElement;
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let reducedMotion = motionQuery.matches;
let motionPaused = false;
let heroScene = null;

/* ---------- header ---------- */
const header = document.querySelector('[data-header]');
const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
onScrollHeader();

/* ---------- mobile navigation ---------- */
const navToggle = document.querySelector('[data-nav-toggle]');
const navMenu = document.querySelector('[data-nav-menu]');

function setNav(open) {
  navMenu.classList.toggle('is-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  navToggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
}
navToggle.addEventListener('click', () => setNav(navToggle.getAttribute('aria-expanded') !== 'true'));
navMenu.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
    setNav(false);
    navToggle.focus();
  }
});
document.addEventListener('click', (e) => {
  if (navToggle.getAttribute('aria-expanded') === 'true' && !e.target.closest('[data-header]')) setNav(false);
});

/* ---------- scrollspy ---------- */
const navLinks = [...document.querySelectorAll('[data-nav-link]')];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => spy.observe(s));

/* ---------- scroll reveal ---------- */
document.querySelectorAll('.bento [data-reveal], .phones [data-reveal]').forEach((el, i, list) => {
  const index = [...el.parentElement.children].indexOf(el);
  el.style.setProperty('--reveal-delay', `${Math.min(index, 4) * 0.08}s`);
});
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealer.unobserve(entry.target);
    }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
document.querySelectorAll('[data-reveal]').forEach((el) => revealer.observe(el));

/* ---------- card spotlight ---------- */
if (finePointer.matches) {
  document.querySelectorAll('[data-spotlight]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ---------- showcase: tilt + centre the carousel on small screens ---------- */
const phones = document.querySelector('[data-phones]');
if (phones) {
  const showcase = phones.closest('section');
  let tiltFrame = 0;
  showcase.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || reducedMotion || motionPaused || window.innerWidth < 960) return;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      const r = phones.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      phones.style.setProperty('--tilt-y', `${(x * 10).toFixed(2)}deg`);
      phones.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
    });
  });
  showcase.addEventListener('pointerleave', () => {
    phones.style.setProperty('--tilt-y', '0deg');
    phones.style.setProperty('--tilt-x', '0deg');
  });

  const centrePhones = () => {
    if (window.innerWidth >= 960) return;
    const centre = phones.querySelector('.phone-center');
    phones.scrollLeft = centre.offsetLeft - (phones.clientWidth - centre.offsetWidth) / 2;
  };
  centrePhones();
  window.addEventListener('load', centrePhones, { once: true });
}

/* ---------- Now Playing mock: radial spectrum around the play button ---------- */
const NEON = [[244, 114, 182], [168, 85, 247], [59, 130, 246], [168, 85, 247], [244, 114, 182]];
function neonAt(t) {
  const x = t * (NEON.length - 1);
  const i = Math.min(Math.floor(x), NEON.length - 2);
  const f = x - i;
  const c = NEON[i].map((v, k) => Math.round(v + (NEON[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}
document.querySelectorAll('[data-spectrum]').forEach((el) => {
  const bars = 56;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < bars; i++) {
    const bar = document.createElement('i');
    const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    bar.style.setProperty('--a', `${(i / bars) * 360 + 180}deg`);
    bar.style.setProperty('--c', neonAt(i / bars));
    bar.style.setProperty('--d', `${(0.35 + seed * 0.5).toFixed(2)}s`);
    bar.style.setProperty('--delay', `${(-seed * 1.2).toFixed(2)}s`);
    frag.appendChild(bar);
  }
  el.appendChild(frag);
});

/* ---------- Now Playing mock: song name scrolling along the rim ---------- */
const rimSvgs = [];
document.querySelectorAll('[data-rim-text]').forEach((text) => {
  const svg = text.ownerSVGElement;
  const path = text.querySelector('textPath');
  const unit = 'Midnight Signal  —  Aria Vale     •     ';
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  probe.setAttribute('style', 'font: 700 3.8px Inter, sans-serif; letter-spacing: .38px; white-space: pre; visibility: hidden');
  probe.textContent = unit;
  svg.appendChild(probe);
  const setup = () => {
    const len = probe.getComputedTextLength();
    if (!len) return;
    path.textContent = unit.repeat(4);
    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'startOffset');
    anim.setAttribute('from', '0');
    anim.setAttribute('to', String(-len));
    anim.setAttribute('dur', `${(len / 6).toFixed(2)}s`);
    anim.setAttribute('repeatCount', 'indefinite');
    path.appendChild(anim);
    probe.remove();
    rimSvgs.push(svg);
    if (reducedMotion || motionPaused) svg.pauseAnimations();
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(setup);
});

/* ---------- About: live waveform line ---------- */
const wavePath = document.querySelector('[data-spec-wave]');
let waveVisible = false;
let waveFrame = 0;
function drawWave(time) {
  const t = time / 1000;
  let d = '';
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * 400;
    const env = Math.sin((i / 80) * Math.PI);
    const y = 30 + env * (Math.sin(i * 0.45 + t * 3) * 11 + Math.sin(i * 0.17 - t * 1.7) * 7 + Math.sin(i * 1.3 + t * 5) * 3);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  wavePath.setAttribute('d', d);
}
function waveLoop(time) {
  drawWave(time);
  if (waveVisible && !reducedMotion && !motionPaused) waveFrame = requestAnimationFrame(waveLoop);
}
if (wavePath) {
  drawWave(1200);
  new IntersectionObserver(([entry]) => {
    waveVisible = entry.isIntersecting;
    cancelAnimationFrame(waveFrame);
    if (waveVisible && !reducedMotion && !motionPaused) waveFrame = requestAnimationFrame(waveLoop);
  }).observe(wavePath);
}

/* ---------- copy checksum ---------- */
const copyBtn = document.querySelector('[data-copy-hash]');
const copyStatus = document.querySelector('[data-copy-status]');
if (copyBtn) {
  copyBtn.setAttribute('data-copied', 'false');
  copyBtn.addEventListener('click', async () => {
    const hash = document.querySelector('[data-hash]').textContent.trim();
    let ok = false;
    try {
      await navigator.clipboard.writeText(hash);
      ok = true;
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('[data-hash]'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = document.execCommand && document.execCommand('copy');
      sel.removeAllRanges();
    }
    copyBtn.setAttribute('data-copied', String(ok));
    copyBtn.querySelector('.copy-label').textContent = ok ? 'Copied' : 'Copy';
    copyStatus.textContent = ok ? 'SHA-256 checksum copied to the clipboard.' : 'Copy failed. Select the checksum to copy it.';
    setTimeout(() => {
      copyBtn.setAttribute('data-copied', 'false');
      copyBtn.querySelector('.copy-label').textContent = 'Copy';
    }, 2200);
  });
}

/* ---------- motion controls ---------- */
const motionBtn = document.querySelector('[data-motion-toggle]');
function applyMotion() {
  root.classList.toggle('motion-paused', motionPaused);
  motionBtn.setAttribute('aria-pressed', String(motionPaused));
  rimSvgs.forEach((svg) => (reducedMotion || motionPaused ? svg.pauseAnimations() : svg.unpauseAnimations()));
  if (heroScene) heroScene.setPaused(motionPaused);
  cancelAnimationFrame(waveFrame);
  if (waveVisible && !reducedMotion && !motionPaused) waveFrame = requestAnimationFrame(waveLoop);
}
motionBtn.addEventListener('click', () => {
  motionPaused = !motionPaused;
  applyMotion();
});
motionQuery.addEventListener('change', (e) => {
  reducedMotion = e.matches;
  if (heroScene) heroScene.setReducedMotion(reducedMotion);
  applyMotion();
});

/* ---------- visualiser demo beat ---------- */
const beat = new BeatEngine();
const beatBtn = document.querySelector('[data-beat-toggle]');
if (!beat.supported) {
  beatBtn.hidden = true;
} else {
  beatBtn.addEventListener('click', async () => {
    if (beat.playing) {
      beat.stop();
      beatBtn.setAttribute('aria-pressed', 'false');
    } else {
      try {
        await beat.start();
        beatBtn.setAttribute('aria-pressed', 'true');
        if (motionPaused) {
          motionPaused = false;
          applyMotion();
        }
        if (heroScene) heroScene.wake();
      } catch {
        beatBtn.setAttribute('aria-pressed', 'false');
      }
    }
  });
}

/* ---------- hero: scroll + pointer feed for the 3D scene ---------- */
const heroSection = document.getElementById('home');
const heroStage = document.querySelector('[data-hero-stage]');
let heroVisible = true;

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  if (heroScene) heroScene.setVisible(heroVisible);
}, { threshold: 0 }).observe(heroSection);

let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    onScrollHeader();
    if (heroScene && heroVisible) {
      const p = Math.min(1, Math.max(0, window.scrollY / heroSection.offsetHeight));
      heroScene.setScroll(p);
    }
  });
}, { passive: true });

window.addEventListener('pointermove', (e) => {
  if (!heroScene || !heroVisible || e.pointerType === 'touch') return;
  heroScene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

/* ---------- lazy-load the WebGL scene ---------- */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function startHero() {
  if (!webglAvailable()) return;
  try {
    const { createHeroScene } = await import('./scene.js');
    heroScene = await createHeroScene({
      canvas: document.getElementById('hero-canvas'),
      container: heroStage,
      reducedMotion,
      paused: motionPaused,
      getSpectrum: () => beat.getFrequencyData(),
      logoSrc: 'assets/pulse-logo.png',
      version: document.body.dataset.version || '',
    });
    heroScene.setVisible(heroVisible);
    heroScene.setScroll(Math.min(1, window.scrollY / heroSection.offsetHeight));
    heroStage.classList.add('is-ready');
  } catch (err) {
    // The CSS record stays in place if WebGL or the CDN is unavailable.
    console.warn('Hero scene unavailable:', err);
  }
}

const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
if (document.readyState === 'complete') idle(startHero, { timeout: 1500 });
else window.addEventListener('load', () => idle(startHero, { timeout: 1500 }), { once: true });
