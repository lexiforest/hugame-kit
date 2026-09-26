// This example synthesizes effects at runtime with the Web Audio API.
const patterns = {
  start: [
    [330, 0, 0.07],
    [495, 0.08, 0.12],
  ],
  move: [[300, 0, 0.045]],
  action: [[520, 0, 0.07]],
  collect: [
    [660, 0, 0.07],
    [880, 0.06, 0.11],
  ],
  success: [
    [523, 0, 0.1],
    [659, 0.1, 0.1],
    [784, 0.2, 0.18],
  ],
  failure: [
    [220, 0, 0.12],
    [165, 0.1, 0.22],
  ],
};

let context;
let master;
let muted = false;
let hostPaused = false;
const activeOscillators = new Set();

function audioOutput() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!context || context.state === "closed") {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0.0001 : 0.7;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume().catch(() => {});
  return { context, master };
}

export function playSound(name) {
  if (muted || hostPaused || !patterns[name]) return;
  const output = audioOutput();
  if (!output) return;
  const start = output.context.currentTime + 0.01;
  const tone = name === "failure" ? "sawtooth" : name === "move" ? "triangle" : "sine";

  for (const [frequency, delay, duration] of patterns[name]) {
    const oscillator = output.context.createOscillator();
    const gain = output.context.createGain();
    const begins = start + delay;
    oscillator.type = tone;
    oscillator.frequency.setValueAtTime(frequency, begins);
    gain.gain.setValueAtTime(0.0001, begins);
    gain.gain.exponentialRampToValueAtTime(0.08, begins + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, begins + duration);
    oscillator.connect(gain);
    gain.connect(output.master);
    activeOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator), {
      once: true,
    });
    oscillator.start(begins);
    oscillator.stop(begins + duration + 0.02);
  }
}

window.Hugame?.on?.("mute", ({ muted: nextMuted }) => {
  muted = Boolean(nextMuted);
  if (!context || !master) return;
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setTargetAtTime(muted ? 0.0001 : 0.7, context.currentTime, 0.01);
});

window.Hugame?.on?.("pause", () => {
  if (hostPaused) return;
  hostPaused = true;
  for (const oscillator of activeOscillators) oscillator.stop();
  activeOscillators.clear();
});

window.Hugame?.on?.("resume", () => {
  if (!hostPaused) return;
  hostPaused = false;
});
