// This example loads generated WAV assets. Run scripts/generate-example-sounds.mjs to rebuild them.
const soundUrls = Object.fromEntries(
  ["start", "move", "action", "collect", "success", "failure"].map((name) => [
    name,
    new URL(`../assets/sounds/${name}.wav`, import.meta.url),
  ]),
);
const activeSounds = new Set();
let muted = false;

export function playSound(name) {
  if (muted || !soundUrls[name]) return;
  const audio = new Audio(soundUrls[name]);
  audio.volume = 0.55;
  activeSounds.add(audio);
  const release = () => activeSounds.delete(audio);
  audio.addEventListener("ended", release, { once: true });
  audio.addEventListener("error", release, { once: true });
  void audio.play().catch(release);
}

window.Hugame?.on?.("mute", ({ muted: nextMuted }) => {
  muted = Boolean(nextMuted);
  if (!muted) return;
  for (const audio of activeSounds) {
    audio.pause();
    audio.currentTime = 0;
  }
  activeSounds.clear();
});
