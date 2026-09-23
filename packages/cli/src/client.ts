import { randomUUID } from "node:crypto";

export class ApiFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class Client {
  constructor(
    public readonly site: string,
    private readonly token?: string,
  ) {}

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      anonymous?: boolean;
      retries?: number;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    if (
      !path.startsWith("/api/") ||
      new URL(path, this.site).origin !== this.site
    )
      throw new Error("Invalid Hugame API path.");
    const method = options.method ?? "GET";
    const key = options.idempotencyKey ?? randomUUID();
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined)
      headers["content-type"] = "application/json";
    if (method !== "GET") headers["idempotency-key"] = key;
    if (!options.anonymous) {
      if (!this.token) throw new Error("Sign in with hugame login first.");
      headers.authorization = `Bearer ${this.token}`;
    }
    const attempts = (options.retries ?? 2) + 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(new URL(path, this.site), {
          method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          redirect: "error",
          signal: AbortSignal.timeout(120000),
        });
        const body = (await response.json()) as {
          data?: T;
          error?: {
            code?: string;
            message?: string;
            details?: Array<{ file?: string; path?: string; message?: string }>;
          };
        };
        if (!response.ok) {
          const details = Array.isArray(body.error?.details)
            ? body
                .error!.details!.map(
                  (issue) =>
                    `${issue.file ?? issue.path ?? ""}: ${issue.message ?? "Invalid field"}`,
                )
                .join("\n")
            : "";
          throw new ApiFailure(
            body.error?.code ?? "request_failed",
            `${body.error?.message ?? "The request failed."}${details ? "\n" + details : ""}`,
            response.status,
          );
        }
        return body.data as T;
      } catch (error) {
        const retryable =
          error instanceof ApiFailure
            ? [502, 503, 504].includes(error.status) ||
              ["request_in_progress", "operation_in_progress"].includes(
                error.code,
              )
            : true;
        if (!retryable || attempt + 1 === attempts) {
          if (error instanceof ApiFailure) throw error;
          throw new Error(
            "Could not reach Hugame. Check your connection and try again.",
          );
        }
        await delay(500 * (attempt + 1));
      }
    }
    throw new Error("The request failed.");
  }
}
