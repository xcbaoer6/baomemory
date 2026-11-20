export type ErrorCode = 'not_found' | 'rejected' | 'unauthorized' | 'upstream' | 'invalid';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const notFound = (what: string) => new DomainError('not_found', `${what} not found`);
export const rejected = (why: string) => new DomainError('rejected', why);
export const upstream = (who: string, cause?: unknown) =>
  new DomainError('upstream', `${who} request failed`, cause);
