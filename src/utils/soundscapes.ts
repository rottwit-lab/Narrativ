import { SoundscapeType, FoleyEffectType } from '../types';

/**
 * Procedural Web Audio Soundscape & Foley Synthesis Engine
 * Zero external audio files required — generates rich organic ambient beds in real-time.
 */
class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop: () => void }[] = [];
  private currentType: SoundscapeType = 'none';
  private currentVolume = 0.25;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(this.currentVolume, this.ctx.currentTime + 0.05);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public getCurrentType(): SoundscapeType {
    return this.currentType;
  }

  public setSoundscape(type: SoundscapeType) {
    this.stopSoundscape();
    this.currentType = type;

    if (type === 'none') return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    switch (type) {
      case 'rain':
        this.startRain();
        break;
      case 'fireplace':
        this.startFireplace();
        break;
      case 'cosmic_drone':
        this.startCosmicDrone();
        break;
      case 'forest_wind':
        this.startForestWind();
        break;
      case 'victorian_library':
        this.startLibrary();
        break;
      case 'starship_hum':
        this.startStarshipHum();
        break;
    }
  }

  public stopSoundscape() {
    this.activeNodes.forEach(n => {
      try {
        n.stop();
      } catch (e) {
        // Ignore stopped nodes
      }
    });
    this.activeNodes = [];
    this.currentType = 'none';
  }

  // --- Ambient Generators ---

  private startRain() {
    if (!this.ctx || !this.masterGain) return;
    // Pink noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to simulate soft raindrops hitting foliage/pavement
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(this.masterGain);
    whiteNoise.start();

    this.activeNodes.push({
      stop: () => {
        whiteNoise.stop();
        whiteNoise.disconnect();
      },
    });
  }

  private startFireplace() {
    if (!this.ctx || !this.masterGain) return;
    // Warm low-frequency roar
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(58, this.ctx.currentTime);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start();

    // Noise buffer for crackles
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.985 ? 1.0 : 0.05);
    }

    const crackle = this.ctx.createBufferSource();
    crackle.buffer = noiseBuffer;
    crackle.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    filter.Q.setValueAtTime(3, this.ctx.currentTime);

    const crackleGain = this.ctx.createGain();
    crackleGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    crackle.connect(filter);
    filter.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    crackle.start();

    this.activeNodes.push({
      stop: () => {
        osc.stop();
        osc.disconnect();
        crackle.stop();
        crackle.disconnect();
      },
    });
  }

  private startCosmicDrone() {
    if (!this.ctx || !this.masterGain) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const oscSub = this.ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(73.4, this.ctx.currentTime); // D2

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(73.9, this.ctx.currentTime); // Beating detune

    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(36.7, this.ctx.currentTime); // Deep Sub

    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    const gainSub = this.ctx.createGain();

    gain1.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain2.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gainSub.gain.setValueAtTime(0.35, this.ctx.currentTime);

    osc1.connect(gain1);
    osc2.connect(gain2);
    oscSub.connect(gainSub);

    gain1.connect(this.masterGain);
    gain2.connect(this.masterGain);
    gainSub.connect(this.masterGain);

    osc1.start();
    osc2.start();
    oscSub.start();

    this.activeNodes.push({
      stop: () => {
        osc1.stop();
        osc2.stop();
        oscSub.stop();
        osc1.disconnect();
        osc2.disconnect();
        oscSub.disconnect();
      },
    });
  }

  private startForestWind() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    // LFO to modulate wind gust intensity
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime); // Slow cycle
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(250, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    windSource.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);

    windSource.start();
    lfo.start();

    this.activeNodes.push({
      stop: () => {
        windSource.stop();
        lfo.stop();
        windSource.disconnect();
        lfo.disconnect();
      },
    });
  }

  private startLibrary() {
    if (!this.ctx || !this.masterGain) return;
    // Warm quiet room tone
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(42, this.ctx.currentTime);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start();

    // Rhythmic pendulum tick (1 Hz)
    const tickOsc = this.ctx.createOscillator();
    tickOsc.type = 'triangle';
    tickOsc.frequency.setValueAtTime(800, this.ctx.currentTime);
    const tickGain = this.ctx.createGain();
    tickGain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Pulse tick every second
    const interval = setInterval(() => {
      if (!this.ctx || !tickGain) return;
      const t = this.ctx.currentTime;
      tickGain.gain.setValueAtTime(0.15, t);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    }, 1000);

    tickOsc.connect(tickGain);
    tickGain.connect(this.masterGain);
    tickOsc.start();

    this.activeNodes.push({
      stop: () => {
        clearInterval(interval);
        osc.stop();
        tickOsc.stop();
        osc.disconnect();
        tickOsc.disconnect();
      },
    });
  }

  private startStarshipHum() {
    if (!this.ctx || !this.masterGain) return;
    const osc60 = this.ctx.createOscillator();
    osc60.type = 'sawtooth';
    osc60.frequency.setValueAtTime(60, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    osc60.connect(filter);
    filter.connect(humGain);
    humGain.connect(this.masterGain);
    osc60.start();

    this.activeNodes.push({
      stop: () => {
        osc60.stop();
        osc60.disconnect();
      },
    });
  }

  // --- Sound Effects & Foley Generator ---

  public triggerFoley(effect: FoleyEffectType) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    switch (effect) {
      case 'page_turn': {
        // Soft rustle noise burst
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3200, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(t);
        break;
      }

      case 'chime': {
        // Pure bell harmonic decay
        const freqs = [1046.5, 2093, 3135.9]; // C6 harmonics
        freqs.forEach((freq, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.25 / (idx + 1), t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 2);
        });
        break;
      }

      case 'distant_thunder': {
        // Low rumble
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(48, t);
        osc.frequency.exponentialRampToValueAtTime(28, t + 1.5);

        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 2.3);
        break;
      }

      case 'footsteps': {
        // Two subtle wood steps
        [0, 0.35].forEach(offset => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(140, t + offset);
          osc.frequency.exponentialRampToValueAtTime(60, t + offset + 0.09);

          gain.gain.setValueAtTime(0.4, t + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1);

          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t + offset);
          osc.stop(t + offset + 0.12);
        });
        break;
      }

      case 'magic_shimmer': {
        // Ascending pentatonic sparkle
        const notes = [587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
        notes.forEach((note, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const noteTime = t + idx * 0.07;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note, noteTime);

          gain.gain.setValueAtTime(0.2, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.5);

          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(noteTime);
          osc.stop(noteTime + 0.6);
        });
        break;
      }
    }
  }
}

export const soundscapeEngine = new SoundscapeEngine();
