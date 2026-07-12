export type Cue = "shoot" | "hit" | "miss" | "combo" | "breach" | "countdown" | "start" | "finish" | "defeat";

let context: AudioContext | null = null;
let muted = localStorage.getItem("rift-muted") === "true";

function audio(): AudioContext | null {
  if (muted) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(frequency: number, duration: number, gain = 0.08, delay = 0, type: OscillatorType = "sine"): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function play(cue: Cue): void {
  if (cue === "shoot") {
    tone(180, 0.08, 0.05, 0, "sawtooth");
    tone(90, 0.12, 0.04, 0.02, "square");
  } else if (cue === "hit") {
    tone(620, 0.09, 0.06, 0, "triangle");
    tone(940, 0.12, 0.04, 0.05, "triangle");
  } else if (cue === "miss") {
    tone(110, 0.16, 0.05, 0, "square");
  } else if (cue === "combo") {
    [440, 660, 880, 1320].forEach((frequency, index) => tone(frequency, 0.24, 0.06, index * 0.06, "triangle"));
  } else if (cue === "breach") {
    tone(130, 0.5, 0.09, 0, "sawtooth");
    tone(65, 0.65, 0.08, 0.08, "square");
  } else if (cue === "countdown") {
    tone(330, 0.12, 0.05, 0, "square");
  } else if (cue === "start") {
    tone(440, 0.18, 0.06, 0, "triangle");
    tone(880, 0.3, 0.06, 0.12, "triangle");
  } else if (cue === "defeat") {
    [220, 165, 110].forEach((frequency, index) => tone(frequency, 0.55, 0.07, index * 0.14, "sawtooth"));
  } else {
    [523, 659, 784].forEach((frequency, index) => tone(frequency, 0.5, 0.05, index * 0.12, "sine"));
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem("rift-muted", String(value));
}

export function isMuted(): boolean {
  return muted;
}

export function unlockAudio(): void {
  const ctx = audio();
  if (ctx?.state === "suspended") void ctx.resume();
}
