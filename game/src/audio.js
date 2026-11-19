// Sound, synthesized live with WebAudio: no audio files, no network. Every
// effect is a few oscillators or a burst of noise shaped by an envelope, and
// the street music is a slow bassline over a pad, scheduled a bar ahead.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  /** Start the audio graph. Call from a user gesture; safe to call twice. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      // The car engine: a sawtooth through a lowpass, pitched by speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // The police siren: a square wave wobbling between two notes.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const sirenLfoGain = context.createGain();
      sirenLfoGain.gain.value = 220;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenLfo.connect(sirenLfoGain);
      sirenLfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(type, from, to, seconds, volume, when = 0) {
    if (!context) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  function burst(seconds, volume, filterFreq, when = 0) {
    if (!context) return;
    const t = context.currentTime + when;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(seconds + 0.05);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
    source.stop(t + seconds + 0.05);
  }

  // A slow street groove: root notes of Am – F – C – G, one bar each, with a
  // soft pad chord over the top. Scheduled a step at a time from a timer.
  const BASS = [55, 43.65, 65.41, 49];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  function musicTick() {
    if (!context || muted) return;
    const bar = Math.floor(musicStep / 4) % 4;
    const beat = musicStep % 4;
    if (beat === 0) {
      blip('sine', BASS[bar], BASS[bar], 1.6, 0.16);
      for (const note of CHORDS[bar]) blip('triangle', note, note, 1.8, 0.045);
    } else if (beat === 2) {
      blip('sine', BASS[bar] * 2, BASS[bar] * 2, 0.5, 0.08);
    }
    musicStep += 1;
  }

  return {
    ensure,
    get ready() { return context !== null; },
    get isMuted() { return muted; },

    /** Engine pitch follows the car's speed (0..1); 0 when on foot. */
    setEngine(speedRatio, driving) {
      if (!context) return;
      const target = driving ? 0.05 + speedRatio * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, context.currentTime, 0.1);
    },

    /** The siren fades in while any police car is close, out when none is. */
    setSiren(on) {
      if (!context) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, context.currentTime, 0.4);
    },

    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    startMusic() {
      if (!context || musicTimer) return;
      musicTimer = window.setInterval(musicTick, 460);
    },

    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },

    shot() { burst(0.12, 0.5, 2400); blip('square', 180, 60, 0.09, 0.25); },
    punch() { burst(0.08, 0.3, 900); },
    crash() { burst(0.3, 0.5, 500); },
    pickup() { blip('sine', 660, 660, 0.09, 0.22); blip('sine', 990, 990, 0.14, 0.22, 0.08); },
    coin() { blip('sine', 880, 1320, 0.12, 0.2); blip('sine', 1320, 1760, 0.16, 0.18, 0.09); },
    phone() { blip('sine', 1250, 1250, 0.12, 0.16); blip('sine', 1250, 1250, 0.12, 0.16, 0.22); },
    missionDone() {
      blip('sine', 523, 523, 0.16, 0.22);
      blip('sine', 659, 659, 0.16, 0.22, 0.14);
      blip('sine', 784, 784, 0.3, 0.24, 0.28);
    },
    busted() { blip('sawtooth', 220, 110, 0.6, 0.2); blip('sawtooth', 165, 82, 0.8, 0.2, 0.3); },
    click() { blip('square', 800, 800, 0.05, 0.12); },
  };
}
