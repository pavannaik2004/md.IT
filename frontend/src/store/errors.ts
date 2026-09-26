/** Base class; every message is written for the person using md.IT. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    // Prefixed: Dexie rewraps errors named like IndexedDB errors (e.g. "NotFoundError") inside transactions.
    this.name = `MdIt${new.target.name}`;
  }
}

export class NotFoundError extends StoreError {}

export class NameConflictError extends StoreError {
  readonly conflictingName: string;
  constructor(name: string) {
    super(`“${name}” already exists here.`);
    this.conflictingName = name;
  }
}

export class InvalidMoveError extends StoreError {}

export class ValidationError extends StoreError {}

export function userMessage(error: unknown): string {
  if (error instanceof StoreError) return error.message;
  console.error(error);
  return 'Something went wrong. Try again.';
}
