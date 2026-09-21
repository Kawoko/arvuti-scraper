/** Raised when a database read fails. Never contains credentials or stack traces. */
export class DataAccessError extends Error {
  readonly detail: unknown;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "DataAccessError";
    this.detail = detail;
  }
}

export function toUserSafeMessage(error: unknown): string {
  if (error instanceof DataAccessError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected data error";
}
