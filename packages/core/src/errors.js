export class VaultError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'VaultError'
    this.code = code
    this.details = details
  }
}

export function isVaultError(error) {
  return error instanceof VaultError
}
