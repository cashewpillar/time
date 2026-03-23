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
