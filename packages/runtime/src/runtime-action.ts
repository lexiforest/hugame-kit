import { z } from "zod";

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
