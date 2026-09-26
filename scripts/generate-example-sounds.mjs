import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sampleRate = 22_050;
const staticGames = ["flappy-finch", "gold-miner", "minesweeper", "pong", "sudoku"];
const patterns = {
  start: { wave: "sine", notes: [[330, 0, 0.07], [495, 0.08, 0.12]] },
  move: { wave: "triangle", notes: [[300, 0, 0.045]] },
  action: { wave: "sine", notes: [[520, 0, 0.07]] },
  collect: { wave: "sine", notes: [[660, 0, 0.07], [880, 0.06, 0.11]] },
  success: {
    wave: "sine",
    notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  },
  failure: { wave: "sawtooth", notes: [[220, 0, 0.12], [165, 0.1, 0.22]] },
};

function waveform(kind, phase) {
  if (kind === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (kind === "sawtooth") return 2 * ((phase / (Math.PI * 2)) % 1) - 1;
  return Math.sin(phase);
}

function makeWav({ wave, notes }) {
  const duration = Math.max(...notes.map(([, delay, length]) => delay + length)) + 0.03;
  const samples = Math.ceil(duration * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);

  for (let sample = 0; sample < samples; sample++) {
    const time = sample / sampleRate;
    let value = 0;
    for (const [frequency, delay, length] of notes) {
      const local = time - delay;
      if (local < 0 || local > length) continue;
      const attack = Math.min(1, local / 0.01);
      const release = Math.min(1, (length - local) / 0.025);
      value += waveform(wave, Math.PI * 2 * frequency * local) * attack * release;
    }
    const scaled = Math.max(-1, Math.min(1, value * (0.42 / notes.length)));
    buffer.writeInt16LE(Math.round(scaled * 32_767), 44 + sample * 2);
  }
  return buffer;
}

for (const game of staticGames) {
  const folder = join("examples", game, "assets", "sounds");
  await mkdir(folder, { recursive: true });
  for (const [name, pattern] of Object.entries(patterns))
    await writeFile(join(folder, `${name}.wav`), makeWav(pattern));
}

console.log(`Generated ${Object.keys(patterns).length} WAV effects for ${staticGames.length} games.`);
