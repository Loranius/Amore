// ============================================================
// Звук «Життя Лєни» (ADR-0239): короткі тони WebAudio, без файлів.
// Вимикається кнопкою в грі; вибір пам'ятає браузер.
// ============================================================
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem('amore:game:muted') === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem('amore:game:muted', next ? '1' : '0');
  } catch {
    // Приватне вікно: вибір живе до перезавантаження — і це чесно.
  }
}

/** Аудіо дозволено лише після дотику — викликати з обробника дотику. */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor) ctx = new Ctor();
}

function tone(freq: number, dur = 0.08, type: OscillatorType = 'triangle', vol = 0.05, when = 0): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const sfx = {
  blip: () => tone(760, 0.05, 'square', 0.025),
  good: () => [659, 880].forEach((f, i) => tone(f, 0.09, 'triangle', 0.05, i * 0.07)),
  bad: () => [220, 175].forEach((f, i) => tone(f, 0.12, 'sawtooth', 0.035, i * 0.08)),
  tada: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.055, i * 0.09)),
  love: () => [880, 1046, 1318].forEach((f, i) => tone(f, 0.12, 'sine', 0.05, i * 0.07)),
  coin: () => [988, 1319].forEach((f, i) => tone(f, 0.07, 'square', 0.03, i * 0.06)),
  step: () => tone(180, 0.03, 'triangle', 0.015),
  /** Нота гами для музичних ігор. */
  note: (i: number) => tone([523, 587, 659, 784, 880, 988][((i % 6) + 6) % 6]!, 0.22, 'sine', 0.06),
};
