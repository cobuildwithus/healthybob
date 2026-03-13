import { VaultCliError } from './vault-cli-errors.js'

export function normalizeRepeatedOption(
  value: string[] | undefined,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const entries = [
    ...new Set(
      value
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ]

  return entries.length > 0 ? entries : undefined
}

function rejectCommaDelimitedEntries(
  value: readonly string[] | undefined,
  optionName: string,
) {
  if (!Array.isArray(value)) {
    return
  }

  for (const entry of value) {
    if (entry.includes(',')) {
      throw new VaultCliError(
        'invalid_option',
        `Comma-delimited values are not supported for --${optionName}. Repeat the flag instead.`,
      )
    }
  }
}

export function normalizeRepeatableFlagOption(
  value: string[] | undefined,
  optionName: string,
): string[] | undefined {
  rejectCommaDelimitedEntries(value, optionName)
  return normalizeRepeatedOption(value)
}
