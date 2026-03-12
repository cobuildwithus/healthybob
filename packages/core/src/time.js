import { VaultError } from './errors.js'

export function coerceDate(value, fieldName = 'date') {
  const candidate = value === undefined ? new Date() : value
  const date = candidate instanceof Date ? new Date(candidate) : new Date(candidate)

  if (Number.isNaN(date.getTime())) {
    throw new VaultError('VAULT_INVALID_DATE', `Invalid ${fieldName}.`, {
      fieldName,
      value,
    })
  }

  return date
}

export function toIsoTimestamp(value, fieldName = 'date') {
  return coerceDate(value, fieldName).toISOString()
}

export function toDateOnly(value, fieldName = 'date') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return toIsoTimestamp(value, fieldName).slice(0, 10)
}

export function toMonthShard(value, fieldName = 'date') {
  return toIsoTimestamp(value, fieldName).slice(0, 7)
}
