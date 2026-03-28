type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  const audioWindow = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
}

function playRingPulse(
  context: AudioContext,
  startTime: number,
  frequency: number,
  duration: number,
  peakGain: number
): void {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.frequency.linearRampToValueAtTime(frequency * 1.08, startTime + duration * 0.35);
  oscillator.frequency.linearRampToValueAtTime(frequency, startTime + duration);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playTimerRing(): void {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const startTime = context.currentTime;
  const bellPattern = [
    { offset: 0, frequency: 1318.51, duration: 0.34, gain: 0.055 },
    { offset: 0.18, frequency: 1567.98, duration: 0.28, gain: 0.04 },
    { offset: 0.62, frequency: 1318.51, duration: 0.34, gain: 0.055 },
    { offset: 0.8, frequency: 1760, duration: 0.28, gain: 0.038 },
    { offset: 1.25, frequency: 1318.51, duration: 0.34, gain: 0.055 },
    { offset: 1.43, frequency: 1567.98, duration: 0.28, gain: 0.04 },
    { offset: 1.88, frequency: 1318.51, duration: 0.34, gain: 0.055 },
    { offset: 2.06, frequency: 1975.53, duration: 0.32, gain: 0.036 },
    { offset: 2.48, frequency: 1567.98, duration: 0.42, gain: 0.032 }
  ];

  for (const tone of bellPattern) {
    playRingPulse(context, startTime + tone.offset, tone.frequency, tone.duration, tone.gain);
  }

  window.setTimeout(() => {
    void context.close();
  }, 3200);
}

export function playTimerStart(): void {
  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const startTime = context.currentTime;
  const sampleRate = context.sampleRate;
  const noiseDuration = 0.028;
  const noiseBuffer = context.createBuffer(1, Math.floor(sampleRate * noiseDuration), sampleRate);
  const channelData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < channelData.length; index += 1) {
    channelData[index] = (Math.random() * 2 - 1) * (1 - index / channelData.length);
  }

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(1400, startTime);

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(4200, startTime);
  lowpass.Q.setValueAtTime(0.7, startTime);

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.11, startTime + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noiseDuration);

  const clickOscillator = context.createOscillator();
  clickOscillator.type = "square";
  clickOscillator.frequency.setValueAtTime(2200, startTime);
  clickOscillator.frequency.exponentialRampToValueAtTime(1200, startTime + 0.01);

  const clickGain = context.createGain();
  clickGain.gain.setValueAtTime(0.0001, startTime);
  clickGain.gain.exponentialRampToValueAtTime(0.018, startTime + 0.001);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.014);

  noiseSource.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(noiseGain);
  noiseGain.connect(context.destination);

  clickOscillator.connect(clickGain);
  clickGain.connect(context.destination);

  noiseSource.start(startTime);
  noiseSource.stop(startTime + noiseDuration);
  clickOscillator.start(startTime);
  clickOscillator.stop(startTime + 0.016);

  window.setTimeout(() => {
    void context.close();
  }, 120);
}
