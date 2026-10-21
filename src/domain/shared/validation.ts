import { ValidationError } from './errors'

export const requireText = (
  value: unknown,
  field: string,
  { min = 1, max }: { min?: number; max: number },
): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < min) throw new ValidationError(`${field} is required`, field)
  if (text.length > max) throw new ValidationError(`${field} must be at most ${max} characters`, field)
  return text
}

export const optionalText = (value: unknown, field: string, max: number): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw new ValidationError(`${field} must be at most ${max} characters`, field)
  return text
}

export const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T => {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`, field)
}
