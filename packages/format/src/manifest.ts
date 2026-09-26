import { z } from "zod";

export const PACKAGE_LIMITS = {
  archiveBytes: 50 * 1024 * 1024,
  extractedBytes: 100 * 1024 * 1024,
  fileBytes: 25 * 1024 * 1024,
  coverBytes: 2 * 1024 * 1024,
  files: 500,
} as const;

export const GAME_TAGS = [
  "arcade",
  "puzzle",
  "platformer",
  "racing",
  "sports",
  "strategy",
  "adventure",
  "educational",
  "kids",
] as const;

export const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    license: z.string().trim().min(1).max(100).default("MIT"),
    homepage: z
      .string()
      .trim()
      .max(2048)
      .url()
      .regex(/^https?:\/\//, "Use an http:// or https:// URL.")
      .optional(),
    instructions: z.string().trim().min(1).max(2000),
    orientation: z.enum(["portrait", "landscape", "any"]),
    controls: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
    tags: z.array(z.enum(GAME_TAGS)).min(1).max(5),
    capabilities: z
      .array(z.enum(["scores", "progress", "achievements"]))
      .max(3)
      .default([]),
    display: z
      .discriminatedUnion("mode", [
        z
          .object({
            mode: z.literal("fixed"),
            width: z.number().int().min(160).max(4096),
            height: z.number().int().min(160).max(4096),
          })
          .strict(),
        z.object({ mode: z.literal("responsive") }).strict(),
      ])
      .optional(),
    achievements: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
            title: z.string().trim().min(1).max(80),
            description: z.string().trim().min(1).max(300),
            target: z.number().int().min(1).max(1_000_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .optional(),
    score: z
      .object({
        label: z.string().trim().min(1).max(40),
        order: z.enum(["higher", "lower"]),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.capabilities).size !== value.capabilities.length)
      context.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: "Choose each capability only once.",
      });
    if (
      value.capabilities.includes("achievements") !==
      Boolean(value.achievements)
    )
      context.addIssue({
        code: "custom",
        path: ["achievements"],
        message: "Declare achievements only with the achievements capability.",
      });
    if (
      value.achievements &&
      new Set(value.achievements.map((a) => a.id)).size !==
        value.achievements.length
    )
      context.addIssue({
        code: "custom",
        path: ["achievements"],
        message: "Achievement IDs must be unique.",
      });
    if (value.capabilities.includes("scores") !== Boolean(value.score)) {
      context.addIssue({
        code: "custom",
        path: ["score"],
        message:
          "Add score settings only when the scores capability is enabled.",
      });
    }
    if (new Set(value.tags).size !== value.tags.length) {
      context.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Choose each tag only once.",
      });
    }
  });

export type GameManifest = z.infer<typeof manifestSchema>;

export type PackageIssue = { file: string; code: string; message: string };

export class PackageError extends Error {
  constructor(public readonly issues: PackageIssue[]) {
    super(issues.map((issue) => `${issue.file}: ${issue.message}`).join("\n"));
    this.name = "PackageError";
  }
}

export function packageError(
  file: string,
  code: string,
  message: string,
): never {
  throw new PackageError([{ file, code, message }]);
}
