// Solara Bay — all sound is synthesised with WebAudio: engine hum, crash,
// gunshot, punch, coin/mission chimes and a simple bass-and-hat music loop.
// No audio files, no network. Everything is guarded so the game still runs
// when audio is unavailable (headless tests, muted tabs).
export function createAudio() {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null;
  let engineOsc = null, engineGain = null;
  const notes = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49]; // A1 A1 C2 G1 A1 D2 C2 G1
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    } catch { return false; }
    return true;
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function tone(freq, dur, type, vol, when = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const f = notes[step % notes.length];
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.5, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + 0.45);
      if (step % 2 === 0) tone(880, 0.05, 'square', 0.05);
      step += 1;
    }, 240);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  function setEngine(speed01) {
    if (!ensure() || muted) { if (engineOsc) engineGain.gain.value = 0; return; }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speed01 * 130;
    engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
  }

  return {
    unlock, startMusic, stopMusic, setEngine,
    shot() { noise(0.12, 0.5, 1800); tone(160, 0.08, 'square', 0.25); },
    punch() { noise(0.08, 0.4, 700); },
    crash() { noise(0.3, 0.6, 500); tone(70, 0.25, 'sine', 0.4); },
    crime() { tone(220, 0.15, 'square', 0.2); tone(180, 0.2, 'square', 0.2, 0.12); },
    pickup() { tone(660, 0.12, 'sine', 0.3); tone(880, 0.18, 'sine', 0.3, 0.1); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.12)); },
    missionFail() { [400, 320, 240].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.2, i * 0.15)); },
    busted() { [330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.25, i * 0.25)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
