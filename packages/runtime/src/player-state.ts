import { z } from "zod";
import type { GameManifest } from "../../format/src/index";

export const SAVE_BYTES = 32 * 1024;
export const runtimeActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("progress.load") }).strict(),
  z
    .object({
      action: z.literal("progress.save"),
      data: z.record(z.unknown()),
      schemaVersion: z.number().int().min(1).max(65535),
      revision: z
        .number()
        .int()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER - 1),
    })
    .strict(),
  z.object({ action: z.literal("achievements.list") }).strict(),
  z
    .object({
      action: z.literal("achievements.unlock"),
      id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("achievements.setProgress"),
      id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
      value: z.number().int().min(0).max(1_000_000_000),
    })
    .strict(),
]);
export type RuntimeAction = z.infer<typeof runtimeActionSchema>;
export type Save = {
  data: Record<string, unknown> | null;
  schemaVersion: number;
  revision: number;
};
export type AchievementProgress = { value: number; unlockedAt: string | null };
export type PlayerState = {
  progress: Save;
  achievements: Record<string, AchievementProgress>;
};
export type StorageMode = "cloud" | "device" | "preview";
export type RuntimeResult = ReturnType<typeof applyRuntimeAction>;
export function emptyPlayerState(): PlayerState {
  return {
    progress: { data: null, schemaVersion: 1, revision: 0 },
    achievements: {},
  };
}
export class RuntimeError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function applyRuntimeAction(
  state: PlayerState,
  action: RuntimeAction,
  manifest: GameManifest,
  storage: StorageMode,
) {
  const capability = action.action.startsWith("progress.")
    ? "progress"
    : "achievements";
  if (!manifest.capabilities.includes(capability))
    throw new RuntimeError(
      "capability_disabled",
      `Enable ${capability} in hugame.json.`,
    );
  if (action.action === "progress.load") return { ...state.progress, storage };
  if (action.action === "progress.save") {
    let serialized: string;
    try {
      serialized = JSON.stringify(action.data);
    } catch {
      throw new RuntimeError("invalid_save", "Save data must be JSON.");
    }
    if (new TextEncoder().encode(serialized).length > SAVE_BYTES)
      throw new RuntimeError(
        "save_too_large",
        "Save data must be at most 32 KiB.",
      );
    if (action.revision !== state.progress.revision)
      throw new RuntimeError(
        "save_conflict",
        "A newer save exists. Load it before saving again.",
      );
    state.progress = {
      data: JSON.parse(serialized),
      schemaVersion: action.schemaVersion,
      revision: state.progress.revision + 1,
    };
    return { ...state.progress, storage };
  }
  const definitions = manifest.achievements ?? [];
  if (action.action === "achievements.list")
    return {
      storage,
      achievements: definitions.map((a) => ({
        ...a,
        ...(Object.hasOwn(state.achievements, a.id)
          ? state.achievements[a.id]
          : { value: 0, unlockedAt: null }),
      })),
    };
  const definition = definitions.find((a) => a.id === action.id);
  if (!definition)
    throw new RuntimeError(
      "unknown_achievement",
      "This achievement is not declared in hugame.json.",
    );
  const previous = Object.hasOwn(state.achievements, action.id)
    ? state.achievements[action.id]
    : undefined;
  if (!previous && Object.keys(state.achievements).length >= 1000)
    throw new RuntimeError(
      "achievement_limit",
      "This game has reached its lifetime achievement limit.",
    );
  const value = Math.max(
    previous?.value ?? 0,
    Math.min(
      definition.target,
      action.action === "achievements.unlock"
        ? definition.target
        : action.value,
    ),
  );
  const unlockedAt =
    previous?.unlockedAt ??
    (value >= definition.target ? new Date().toISOString() : null);
  state.achievements[action.id] = { value, unlockedAt };
  return {
    ...definition,
    value,
    unlockedAt,
    newlyUnlocked: !previous?.unlockedAt && !!unlockedAt,
    storage,
  };
}
