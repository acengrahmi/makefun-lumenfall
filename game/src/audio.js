// audio.js — Lumenfall's generative WebAudio soundscape.
// No audio files: a slow lantern-pad chord drift and a sparse pluck melody
// are synthesised while you play, and every effect is a small oscillator or
// noise gesture. The context is created lazily on the first user gesture so
// the game never trips a browser autoplay policy.

const CHORDS = [
  // A minor lantern drift: Am — F — C — G, frequencies in Hz.
  [110.0, 164.81, 261.63, 329.63],
  [87.31, 174.61, 220.0, 261.63],
  [130.81, 164.81, 196.0, 329.63],
  [98.0, 146.83, 246.94, 293.66],
];
const PLUCK_NOTES = [440, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440];

export function makeAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let chordIndex = 0;
  let chordTimer = null;
  let pluckTimer = null;
  let pluckStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return true;
  }

  function padChord(freqs) {
    const now = ctx.currentTime;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 2.4);
      g.gain.setValueAtTime(0.05, now + 5.6);
      g.gain.linearRampToValueAtTime(0, now + 8.2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 720;
      osc.connect(filter).connect(g).connect(musicGain);
      osc.start(now);
      osc.stop(now + 8.4);
    }
  }

  function pluck() {
    const f = PLUCK_NOTES[pluckStep % PLUCK_NOTES.length];
    pluckStep++;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc.connect(g).connect(musicGain);
    osc.start(now);
    osc.stop(now + 1);
  }

  function tone(freqFrom, freqTo, dur, type, vol, dest) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(dest || master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(master);
    src.start(now);
  }

  return {
    // Call from any pointer/key handler; safe to call repeatedly.
    unlock() {
      if (!ensure()) return;
      if (chordTimer) return;
      padChord(CHORDS[0]);
      chordTimer = window.setInterval(() => {
        chordIndex = (chordIndex + 1) % CHORDS.length;
        padChord(CHORDS[chordIndex]);
      }, 8000);
      pluckTimer = window.setInterval(() => {
        if (Math.random() < 0.72) pluck();
      }, 1250);
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() { tone(880, 320, 0.09, 'square', 0.05); },
    hit() { tone(220, 140, 0.05, 'sawtooth', 0.04); },
    enemyDie() { noise(0.18, 0.12, 900); tone(320, 60, 0.2, 'triangle', 0.08); },
    orb() { tone(660 + Math.random() * 120, 990, 0.08, 'sine', 0.06); },
    hurt() { tone(160, 70, 0.25, 'sawtooth', 0.14); },
    lanternHurt() { tone(98, 55, 0.4, 'sawtooth', 0.16); noise(0.3, 0.08, 300); },
    dash() { noise(0.16, 0.07, 1800); },
    buy() { tone(523.25, 523.25, 0.09, 'sine', 0.09); setTimeout(() => tone(783.99, 783.99, 0.14, 'sine', 0.09), 70); },
    denied() { tone(180, 120, 0.15, 'square', 0.07); },
    waveHorn() { tone(196, 196, 0.5, 'triangle', 0.12); tone(294, 294, 0.5, 'triangle', 0.08); },
    bossRoar() { tone(65, 40, 1.1, 'sawtooth', 0.2); noise(1.0, 0.1, 200); },
    victory() {
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        setTimeout(() => tone(f, f, 0.5, 'triangle', 0.12), i * 140));
    },
    defeat() {
      if (!ctx) return;
      [392, 329.63, 261.63, 196].forEach((f, i) =>
        setTimeout(() => tone(f, f * 0.94, 0.5, 'triangle', 0.11), i * 180));
    },
  };
}
