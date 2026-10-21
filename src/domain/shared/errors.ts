export type DomainErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT'

/**
 * Base class for errors that express a broken business rule.
 * Upper layers translate these into user-facing messages; anything else is treated as unexpected.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: DomainErrorCode,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message, 'VALIDATION')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError
