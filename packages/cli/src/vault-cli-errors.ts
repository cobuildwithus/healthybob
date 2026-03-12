export type VaultCliErrorDetails = Record<string, unknown> | undefined

export class VaultCliError extends Error {
  readonly code: string
  readonly details: VaultCliErrorDetails

  constructor(code: string, message: string, details?: VaultCliErrorDetails) {
    super(message)
    this.name = 'VaultCliError'
    this.code = code
    this.details = details
  }
}

export function toVaultCliError(error: unknown) {
  if (error instanceof VaultCliError) {
    return error
  }

  if (error instanceof Error) {
    return new VaultCliError('command_failed', error.message)
  }

  return new VaultCliError('command_failed', 'Command failed.')
}
