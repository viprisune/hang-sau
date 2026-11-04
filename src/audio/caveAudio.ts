import { CONFIG } from '../config';

export interface CaveAudioEngine {
  startIfNeeded: () => void;
  update: (
    deltaSeconds: number,
    isMoving: boolean,
    isRunning: boolean,
    stamina?: number,
    darknessTimerSec?: number,
    isLit?: boolean,
    tideWarningIntensity?: number,
    inWater?: boolean
  ) => void;
  playMatchStrike: () => void;
  playMatchBurnout: () => void;
  playPickup: () => void;
  playRopeTie: () => void;
  playArtifactPickup: () => void;
  playConsume: () => void;
  playDrop: () => void;
  setVolume: (masterVolume: number, muted: boolean) => void;
  setSuspended: (suspended: boolean) => void;
  dispose: () => void;
}

/**
 * Procedural Web Audio synthesizer for HANG SÂU:
 * - Continuous low cave wind (filtered noise + slow LFO)
 * - Distant subterranean tide rumble (filtered low noise + sub-bass drone) that swells during the 20 s pre-flood warning
 * - Random resonant water drips (faster and louder during tide warning)
 * - Stone footsteps + water splash steps when wading in flooded tiles
 * - Match/candle strike and burnout fizzle
 * - Subtle breathing that grows heavier as stamina drops
 * - Faint heartbeat starting after 10 s in darkness and fading out when light returns
 */
export function createCaveAudioEngine(
  initialVolume: number,
  initialMuted: boolean
): CaveAudioEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let windSource: AudioBufferSourceNode | null = null;
  let windLfo: OscillatorNode | null = null;
  let rumbleSource: AudioBufferSourceNode | null = null;
  let rumbleSubOsc: OscillatorNode | null = null;
  let rumbleGain: GainNode | null = null;

  let masterVolume = initialVolume;
  let isMuted = initialMuted;
  let isSuspended = false;
  let disposed = false;

  let dripTimer =
    CONFIG.DRIP_MIN_INTERVAL_SEC +
    Math.random() *
      (CONFIG.DRIP_MAX_INTERVAL_SEC - CONFIG.DRIP_MIN_INTERVAL_SEC);
  let footstepTimer = 0.12;
  let breathTimer = 0.6;
  let heartbeatTimer = 0.3;
  let heartbeatEnvelope = 0;

  function createNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * 3;
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Brownian/pinkish shaping for natural wind & stone texture
      data[i] = (lastOut + 0.08 * white) / 1.08;
      lastOut = data[i];
    }
    return buffer;
  }

  function applyMasterGain() {
    if (!ctx || !masterGain) return;
    const target =
      isMuted || isSuspended ? 0 : Math.max(0, Math.min(1, masterVolume));
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.025);
  }

  function startIfNeeded() {
    if (disposed) return;
    if (!ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = isMuted || isSuspended ? 0 : masterVolume;
      masterGain.connect(ctx.destination);

      noiseBuffer = createNoiseBuffer(ctx);

      // Start continuous low cave wind
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = CONFIG.WIND_FILTER_FREQ_HZ;
      windFilter.Q.value = 2.4;

      const windGain = ctx.createGain();
      windGain.gain.value = CONFIG.WIND_BASE_GAIN;

      windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.value = CONFIG.WIND_LFO_FREQ_HZ;

      const windLfoGain = ctx.createGain();
      windLfoGain.gain.value = CONFIG.WIND_LFO_DEPTH_HZ;

      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);

      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      windSource.start();
      windLfo.start();

      // Start distant subterranean tide rumble chain (gain controlled by warningIntensity)
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 82;
      rumbleFilter.Q.value = 3.2;

      rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.0001;

      rumbleSource = ctx.createBufferSource();
      rumbleSource.buffer = noiseBuffer;
      rumbleSource.loop = true;

      rumbleSubOsc = ctx.createOscillator();
      rumbleSubOsc.type = 'triangle';
      rumbleSubOsc.frequency.value = 46;

      const subOscGain = ctx.createGain();
      subOscGain.gain.value = 0.42;

      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleSubOsc.connect(subOscGain);
      subOscGain.connect(rumbleGain);
      rumbleGain.connect(masterGain);

      rumbleSource.start();
      rumbleSubOsc.start();
    }

    if (ctx && ctx.state === 'suspended' && !isSuspended) {
      ctx.resume().catch(() => {});
    }
    applyMasterGain();
  }

  function playWaterDrip(warningIntensity = 0) {
    if (!ctx || !masterGain || isSuspended || isMuted) return;
    const now = ctx.currentTime;
    const baseFreq =
      CONFIG.DRIP_MIN_FREQ_HZ +
      Math.random() * (CONFIG.DRIP_MAX_FREQ_HZ - CONFIG.DRIP_MIN_FREQ_HZ);

    // Primary droplet ping (louder when tide warning is active)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, now + 0.065);

    const warningBoost = 1 + warningIntensity * 0.55;
    const panGain =
      CONFIG.DRIP_GAIN * warningBoost * (0.55 + Math.random() * 0.45);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(panGain, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Subtle cave echo reflection 110ms later
    const echoOsc = ctx.createOscillator();
    const echoGain = ctx.createGain();
    echoOsc.type = 'sine';
    echoOsc.frequency.setValueAtTime(baseFreq * 0.85, now + 0.11);
    echoOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.17);

    echoGain.gain.setValueAtTime(0.0001, now + 0.11);
    echoGain.gain.linearRampToValueAtTime(panGain * 0.28, now + 0.12);
    echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    echoOsc.connect(echoGain);
    echoGain.connect(masterGain);
    echoOsc.start(now + 0.11);
    echoOsc.stop(now + 0.27);
  }

  function playFootstep(isRunning: boolean, inWater = false) {
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;
    const stepGainLevel = isRunning
      ? CONFIG.FOOTSTEP_GAIN_RUN
      : CONFIG.FOOTSTEP_GAIN_WALK;

    // 1. Stone grit noise burst
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420 + (Math.random() - 0.5) * 140;
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(
      inWater ? stepGainLevel * 0.55 : stepGainLevel,
      now + 0.008
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(now, Math.random() * 2.0, 0.09);

    // 2. Low sole thud on rock
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'triangle';
    const startFreq = 95 + (Math.random() - 0.5) * 18;
    thud.frequency.setValueAtTime(startFreq, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.065);

    thudGain.gain.setValueAtTime(stepGainLevel * 0.65, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    thud.connect(thudGain);
    thudGain.connect(masterGain);
    thud.start(now);
    thud.stop(now + 0.075);

    // 3. Water splash burst when wading through shallow/deep water
    if (inWater) {
      const splashSrc = ctx.createBufferSource();
      splashSrc.buffer = noiseBuffer;
      const splashFilter = ctx.createBiquadFilter();
      splashFilter.type = 'bandpass';
      splashFilter.frequency.setValueAtTime(
        680 + Math.random() * 260,
        now + 0.01
      );
      splashFilter.frequency.exponentialRampToValueAtTime(
        1350 + Math.random() * 300,
        now + 0.14
      );
      splashFilter.Q.value = 1.6;

      const splashPeak =
        CONFIG.WATER_SPLASH_STEP_GAIN * (isRunning ? 1.25 : 0.9);
      const splashGain = ctx.createGain();
      splashGain.gain.setValueAtTime(0.0001, now + 0.01);
      splashGain.gain.linearRampToValueAtTime(splashPeak, now + 0.03);
      splashGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

      splashSrc.connect(splashFilter);
      splashFilter.connect(splashGain);
      splashGain.connect(masterGain);
      splashSrc.start(now + 0.01, Math.random() * 1.5, 0.18);
    }
  }

  /**
   * Subtle procedural breath cycle (inhale + exhale) whose intensity scales
   * smoothly with exhaustion (`0..1` as stamina drops below threshold).
   */
  function playBreathCycle(exhaustionRatio: number) {
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const peakGain = CONFIG.BREATH_MAX_GAIN * exhaustionRatio;
    if (peakGain < 0.004) return;

    const now = ctx.currentTime;
    const inhaleDur = Math.max(0.22, 0.36 - exhaustionRatio * 0.1);
    const exhaleStart = now + inhaleDur + 0.05;
    const exhaleDur = Math.max(0.28, 0.48 - exhaustionRatio * 0.14);

    // Soft filtered air for inhale
    const inSrc = ctx.createBufferSource();
    inSrc.buffer = noiseBuffer;
    const inFilter = ctx.createBiquadFilter();
    inFilter.type = 'bandpass';
    inFilter.frequency.setValueAtTime(480 + exhaustionRatio * 140, now);
    inFilter.Q.value = 2.6;

    const inGain = ctx.createGain();
    inGain.gain.setValueAtTime(0.0001, now);
    inGain.gain.linearRampToValueAtTime(peakGain * 0.72, now + inhaleDur * 0.5);
    inGain.gain.exponentialRampToValueAtTime(0.0001, now + inhaleDur);

    inSrc.connect(inFilter);
    inFilter.connect(inGain);
    inGain.connect(masterGain);
    inSrc.start(now, Math.random() * 1.4, inhaleDur + 0.02);

    // Deeper filtered air for exhale
    const exSrc = ctx.createBufferSource();
    exSrc.buffer = noiseBuffer;
    const exFilter = ctx.createBiquadFilter();
    exFilter.type = 'bandpass';
    exFilter.frequency.setValueAtTime(360 + exhaustionRatio * 90, exhaleStart);
    exFilter.frequency.linearRampToValueAtTime(270, exhaleStart + exhaleDur);
    exFilter.Q.value = 2.2;

    const exGain = ctx.createGain();
    exGain.gain.setValueAtTime(0.0001, exhaleStart);
    exGain.gain.linearRampToValueAtTime(peakGain, exhaleStart + 0.06);
    exGain.gain.exponentialRampToValueAtTime(0.0001, exhaleStart + exhaleDur);

    exSrc.connect(exFilter);
    exFilter.connect(exGain);
    exGain.connect(masterGain);
    exSrc.start(exhaleStart, Math.random() * 1.4, exhaleDur + 0.02);
  }

  /**
   * Subtle double-thump heartbeat (`lub-dub`) that starts after 10 s in darkness
   * and fades away when light returns.
   */
  function playHeartbeatPulse(envelope: number) {
    if (!ctx || !masterGain || isSuspended || isMuted) return;
    const peak = CONFIG.HEARTBEAT_MAX_GAIN * envelope;
    if (peak < 0.004) return;

    const now = ctx.currentTime;

    // Primary "lub" beat
    const lub = ctx.createOscillator();
    const lubGain = ctx.createGain();
    lub.type = 'sine';
    lub.frequency.setValueAtTime(60, now);
    lub.frequency.exponentialRampToValueAtTime(34, now + 0.11);

    lubGain.gain.setValueAtTime(0.0001, now);
    lubGain.gain.linearRampToValueAtTime(peak, now + 0.018);
    lubGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    lub.connect(lubGain);
    lubGain.connect(masterGain);
    lub.start(now);
    lub.stop(now + 0.14);

    // Secondary "dub" beat 185ms later
    const dubStart = now + 0.185;
    const dub = ctx.createOscillator();
    const dubGain = ctx.createGain();
    dub.type = 'sine';
    dub.frequency.setValueAtTime(50, dubStart);
    dub.frequency.exponentialRampToValueAtTime(30, dubStart + 0.1);

    dubGain.gain.setValueAtTime(0.0001, dubStart);
    dubGain.gain.linearRampToValueAtTime(peak * 0.72, dubStart + 0.015);
    dubGain.gain.exponentialRampToValueAtTime(0.0001, dubStart + 0.12);

    dub.connect(dubGain);
    dubGain.connect(masterGain);
    dub.start(dubStart);
    dub.stop(dubStart + 0.13);
  }

  function playMatchStrike() {
    startIfNeeded();
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    // 1. High-frequency phosphorus scratch
    const scratch = ctx.createBufferSource();
    scratch.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1600, now);
    hp.frequency.linearRampToValueAtTime(2800, now + 0.07);
    hp.Q.value = 2.2;

    const scratchGain = ctx.createGain();
    scratchGain.gain.setValueAtTime(0.001, now);
    scratchGain.gain.linearRampToValueAtTime(
      CONFIG.MATCH_STRIKE_GAIN,
      now + 0.015
    );
    scratchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    scratch.connect(hp);
    hp.connect(scratchGain);
    scratchGain.connect(masterGain);
    scratch.start(now, Math.random() * 1.5, 0.09);

    // 2. Warm ignition flare whoosh
    const flare = ctx.createBufferSource();
    flare.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now + 0.05);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.28);

    const flareGain = ctx.createGain();
    flareGain.gain.setValueAtTime(0.0001, now + 0.05);
    flareGain.gain.linearRampToValueAtTime(
      CONFIG.MATCH_STRIKE_GAIN * 0.9,
      now + 0.09
    );
    flareGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    flare.connect(lp);
    lp.connect(flareGain);
    flareGain.connect(masterGain);
    flare.start(now + 0.05, Math.random() * 1.5, 0.26);
  }

  function playMatchBurnout() {
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    const fizz = ctx.createBufferSource();
    fizz.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(260, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(CONFIG.MATCH_BURNOUT_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

    fizz.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    fizz.start(now, Math.random() * 1.5, 0.2);
  }

  function playPickup() {
    startIfNeeded();
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    // Cloth/pack rustle + subtle stone tap
    const rustle = ctx.createBufferSource();
    rustle.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.frequency.linearRampToValueAtTime(1150, now + 0.09);
    bp.Q.value = 1.6;

    const rGain = ctx.createGain();
    rGain.gain.setValueAtTime(0.0001, now);
    rGain.gain.linearRampToValueAtTime(CONFIG.PICKUP_SOUND_GAIN, now + 0.015);
    rGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    rustle.connect(bp);
    bp.connect(rGain);
    rGain.connect(masterGain);
    rustle.start(now, Math.random() * 1.2, 0.12);

    const tone = ctx.createOscillator();
    const tGain = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(240, now);
    tone.frequency.exponentialRampToValueAtTime(340, now + 0.08);
    tGain.gain.setValueAtTime(CONFIG.PICKUP_SOUND_GAIN * 0.55, now);
    tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    tone.connect(tGain);
    tGain.connect(masterGain);
    tone.start(now);
    tone.stop(now + 0.095);
  }

  function playRopeTie() {
    startIfNeeded();
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    // 1. Iron anchor ring clink
    const clink = ctx.createOscillator();
    const cGain = ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(1120, now);
    clink.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    cGain.gain.setValueAtTime(CONFIG.ROPE_TIE_SOUND_GAIN * 0.65, now);
    cGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    clink.connect(cGain);
    cGain.connect(masterGain);
    clink.start(now);
    clink.stop(now + 0.095);

    // 2. Taut hemp rope tension creak
    const creak = ctx.createBufferSource();
    creak.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(360, now + 0.04);
    filter.frequency.linearRampToValueAtTime(580, now + 0.28);
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + 0.04);
    gain.gain.linearRampToValueAtTime(CONFIG.ROPE_TIE_SOUND_GAIN, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    creak.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    creak.start(now + 0.04, Math.random() * 1.0, 0.32);
  }

  function playArtifactPickup() {
    startIfNeeded();
    if (!ctx || !masterGain || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    // Resonant low bronze-and-stone harmonic chord
    const freqs = [220, 330, 528];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freqs[i], now);
      osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.985, now + 0.65);

      const peak = CONFIG.PICKUP_SOUND_GAIN * (i === 0 ? 0.65 : 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.7);
    }
  }

  function playConsume() {
    startIfNeeded();
    if (!ctx || !masterGain || !noiseBuffer || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    // Soft swallow / ration wrapper sound
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(480, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(CONFIG.CONSUME_SOUND_GAIN, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(masterGain);
    src.start(now, Math.random() * 1.2, 0.2);
  }

  function playDrop() {
    startIfNeeded();
    if (!ctx || !masterGain || isSuspended || isMuted) return;
    const now = ctx.currentTime;

    const thud = ctx.createOscillator();
    const gain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(135, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.09);

    gain.gain.setValueAtTime(CONFIG.DROP_SOUND_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    thud.connect(gain);
    gain.connect(masterGain);
    thud.start(now);
    thud.stop(now + 0.11);
  }

  return {
    startIfNeeded,
    update(
      deltaSeconds: number,
      isMoving: boolean,
      isRunning: boolean,
      stamina = CONFIG.STAMINA_MAX,
      darknessTimerSec = 0,
      isLit = false,
      tideWarningIntensity = 0,
      inWater = false
    ) {
      if (disposed || isSuspended || !ctx) return;
      const dt = Math.min(Math.max(deltaSeconds, 0), CONFIG.MAX_DELTA_SEC);
      const clampedWarning = Math.max(0, Math.min(1, tideWarningIntensity));

      // 0. Distant subterranean tide rumble (grows louder during the 20 s pre-flood warning)
      if (rumbleGain) {
        const targetRumble = clampedWarning * CONFIG.TIDE_RUMBLE_MAX_GAIN;
        rumbleGain.gain.setTargetAtTime(targetRumble, ctx.currentTime, 0.18);
      }

      // 1. Schedule random cave water drips (faster and louder during pre-flood warning)
      const dripRateMult =
        1 + clampedWarning * (CONFIG.TIDE_WARNING_DRIP_RATE_MULT - 1);
      dripTimer -= dt * dripRateMult;
      if (dripTimer <= 0) {
        playWaterDrip(clampedWarning);
        dripTimer =
          CONFIG.DRIP_MIN_INTERVAL_SEC +
          Math.random() *
            (CONFIG.DRIP_MAX_INTERVAL_SEC - CONFIG.DRIP_MIN_INTERVAL_SEC);
      }

      // 2. Schedule footsteps on stone (with water splash when wading)
      if (isMoving) {
        footstepTimer -= dt;
        if (footstepTimer <= 0) {
          playFootstep(isRunning, inWater);
          footstepTimer = isRunning
            ? CONFIG.FOOTSTEP_RUN_INTERVAL_SEC
            : CONFIG.FOOTSTEP_WALK_INTERVAL_SEC;
        }
      } else {
        footstepTimer = 0.08;
      }

      // 3. Subtle breathing that grows heavier as stamina drops below threshold
      if (stamina < CONFIG.BREATH_STAMINA_THRESHOLD) {
        const exhaustion = Math.max(
          0,
          Math.min(
            1,
            (CONFIG.BREATH_STAMINA_THRESHOLD - stamina) /
              CONFIG.BREATH_STAMINA_THRESHOLD
          )
        );
        breathTimer -= dt;
        if (breathTimer <= 0) {
          playBreathCycle(exhaustion);
          breathTimer =
            CONFIG.BREATH_MAX_INTERVAL_SEC -
            (CONFIG.BREATH_MAX_INTERVAL_SEC - CONFIG.BREATH_MIN_INTERVAL_SEC) *
              exhaustion;
        }
      } else {
        breathTimer = 0.35;
      }

      // 4. Faint heartbeat after 10 s in darkness, fading out when light returns
      if (!isLit && darknessTimerSec >= CONFIG.HEARTBEAT_DARKNESS_DELAY_SEC) {
        heartbeatEnvelope = Math.min(
          1,
          heartbeatEnvelope + dt / CONFIG.HEARTBEAT_FADE_IN_SEC
        );
      } else {
        heartbeatEnvelope = Math.max(
          0,
          heartbeatEnvelope - dt / CONFIG.HEARTBEAT_FADE_OUT_SEC
        );
      }

      if (heartbeatEnvelope > 0.02) {
        heartbeatTimer -= dt;
        if (heartbeatTimer <= 0) {
          playHeartbeatPulse(heartbeatEnvelope);
          heartbeatTimer =
            CONFIG.HEARTBEAT_INTERVAL_SEC * (1 - heartbeatEnvelope * 0.14);
        }
      } else {
        heartbeatTimer = 0.25;
      }
    },
    playMatchStrike,
    playMatchBurnout,
    playPickup,
    playRopeTie,
    playArtifactPickup,
    playConsume,
    playDrop,
    setVolume(nextVolume: number, nextMuted: boolean) {
      masterVolume = nextVolume;
      isMuted = nextMuted;
      applyMasterGain();
    },
    setSuspended(nextSuspended: boolean) {
      isSuspended = nextSuspended;
      applyMasterGain();
      if (!ctx) return;
      if (isSuspended && ctx.state === 'running') {
        ctx.suspend().catch(() => {});
      } else if (!isSuspended && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    },
    dispose() {
      disposed = true;
      try {
        windSource?.stop();
        windLfo?.stop();
        rumbleSource?.stop();
        rumbleSubOsc?.stop();
      } catch {
        // ignore if already stopped
      }
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}

