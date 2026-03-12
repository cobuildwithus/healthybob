import { Cli } from 'incur'
import { defineCommand, emptyArgsSchema, withBaseOptions } from '../command-helpers.js'
import {
  vaultInitResultSchema,
  vaultValidateResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerVaultCommands(cli: Cli.Cli, services: VaultCliServices) {
  cli.command(
    'init',
    defineCommand({
      command: 'init',
      description: 'Create the baseline vault layout through the core write path.',
      args: emptyArgsSchema,
      options: withBaseOptions(),
      data: vaultInitResultSchema,
      async run({ vault, requestId }) {
        return services.core.init({ vault, requestId })
      },
      renderMarkdown({ data }) {
        return `# Vault Initialized\n\n- vault: ${data.vault}\n- created: ${data.created}\n- directories: ${data.directories.length}\n- files: ${data.files.length}`
      },
    }),
  )

  cli.command(
    'validate',
    defineCommand({
      command: 'validate',
      description: 'Validate the vault through the core read/validation path.',
      args: emptyArgsSchema,
      options: withBaseOptions(),
      data: vaultValidateResultSchema,
      async run({ vault, requestId }) {
        return services.core.validate({ vault, requestId })
      },
      renderMarkdown({ data }) {
        return `# Vault Validation\n\n- vault: ${data.vault}\n- valid: ${data.valid}\n- issues: ${data.issues.length}`
      },
    }),
  )
}
