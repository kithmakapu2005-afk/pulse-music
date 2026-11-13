// A small synthwave loop generated with the Web Audio API.
// No audio files: kick, clap, hats, bass, pad and arpeggio are all synthesised in the browser.
// Its analyser drives the hero visualiser.

const BPM = 110;
const STEP = 60 / BPM / 4; // a sixteenth note
const LOOKAHEAD = 0.12;

// A minor, F, C, G — one chord per bar.
const CHORDS = [
  { bass: 55.0, notes: [220.0, 261.63, 329.63] },
  { bass: 43.65, notes: [174.61, 220.0, 261.63] },
  { bass: 65.41, notes: [196.0, 261.63, 329.63] },
  { bass: 49.0, notes: [196.0, 246.94, 293.66] },
];
const BASS_STEPS = new Set([0, 3, 6, 8, 10, 11, 14]);
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

export class BeatEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.timer = 0;
  }

  get supported() {
    return Boolean(window.AudioContext || window.webkitAudioContext);
  }

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    // Echo bus for the pad and arpeggio.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2400;
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.5;
    this.echoSend.connect(this.echo);
    this.echo.connect(echoTone);
    echoTone.connect(feedback);
    feedback.connect(this.echo);
    echoTone.connect(this.master);

    this.master.connect(comp);
    comp.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  async start() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.62, now + 0.5);
    this.step = 0;
    this.nextTime = now + 0.06;
    this.playing = true;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (!this.ctx || !this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.35);
    setTimeout(() => {
      if (!this.playing && this.ctx) this.ctx.suspend();
    }, 600);
  }

  /** Frequency data while playing, otherwise null. */
  getFrequencyData() {
    if (!this.playing || !this.analyser) return null;
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  schedule() {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    const inBar = step % 16;
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];

    if (inBar % 4 === 0) this.kick(t);
    if (inBar === 4 || inBar === 12) this.clap(t);
    if (inBar % 2 === 1) this.hat(t, inBar % 4 === 2 ? 0.16 : 0.09);
    else this.hat(t, 0.05);
    if (BASS_STEPS.has(inBar)) this.bass(t, chord.bass * (inBar === 10 ? 2 : 1));
    if (inBar === 0) this.pad(t, chord.notes, STEP * 16);
    if (inBar % 2 === 0) {
      const n = chord.notes[ARP[(inBar / 2) % ARP.length]] * 2;
      this.arp(t, n);
    }
  }

  kick(t) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1.0, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  clap(t) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.42, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(bp).connect(gain).connect(this.master);
    gain.connect(this.echoSend);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.25);
  }

  hat(t, level) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }

  bass(t, freq) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(1100, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.2);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.9);
    osc.connect(lp).connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + STEP * 2);
  }

  pad(t, notes, dur) {
    const { ctx } = this;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(800, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.5);
    gain.gain.setValueAtTime(0.05, t + dur - 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
    lp.connect(gain);
    gain.connect(this.master);
    gain.connect(this.echoSend);
    notes.forEach((f) => {
      [-6, 6].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = detune;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.3);
      });
    });
  }

  arp(t, freq) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.6);
    osc.connect(gain);
    gain.connect(this.master);
    gain.connect(this.echoSend);
    osc.start(t);
    osc.stop(t + STEP * 1.7);
  }
}
