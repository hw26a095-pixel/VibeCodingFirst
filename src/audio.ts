/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer for Retro Game Sound Effects
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    } catch (e) {
      console.warn('AudioContext is not supported on this browser:', e);
    }
  }

  private resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Helper to play a short sine wave beep for button clicks
  public playClick() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Sword sweep whoosh
  public playSlash() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Bow shooting pluck
  public playShootBow() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Magic beam casting sizzle
  public playMagicSpell() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.2);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 0.25);
    osc2.stop(this.ctx.currentTime + 0.25);
  }

  // Dash whoosh sound
  public playDash() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    // Filtered noise swoosh with high pass
    const bufferSize = this.ctx.sampleRate * 0.15; // 0.15 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.15);
  }

  // Enemy hit impact
  public playHitEnemy() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Player hurt impact
  public playHitPlayer() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Level Up chord!
  public playLevelUp() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const majorScale = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major tones
    const time = this.ctx.currentTime;

    majorScale.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + idx * 0.06);

      gain.gain.setValueAtTime(0, time + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.06, time + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time + idx * 0.06);
      osc.stop(time + idx * 0.06 + 0.25);
    });
  }

  // Wave / Boss spawn alert!
  public playBossSpawn() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, time + delay);
      osc.frequency.setValueAtTime(180, time + delay + 0.08);

      gain.gain.setValueAtTime(0.12, time + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, time + delay + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time + delay);
      osc.stop(time + delay + 0.22);
    });
  }

  // Game over ditty
  public playGameOver() {
    if (!this.enabled) return;
    this.resume();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const sadNotes = [392.00, 369.99, 349.23, 293.66, 220.00]; // G4, F#4, F4, D4, A3 (melancholic downscale)

    sadNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time + idx * 0.15);

      gain.gain.setValueAtTime(0, time + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.08, time + idx * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time + idx * 0.15);
      osc.stop(time + idx * 0.15 + 0.45);
    });
  }
}

export const gameAudio = new AudioSynthesizer();
