import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import {
  journalEnsureResultSchema,
  localDateSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerJournalCommands(cli: Cli.Cli, services: VaultCliServices) {
  const journal = Cli.create('journal', {
    description: 'Journal document commands routed through the core write API.',
  })

  journal.command(
    'ensure',
    defineCommand({
      command: 'journal ensure',
      description: 'Create or confirm the daily journal document for a date.',
      args: z.object({
        date: localDateSchema,
      }),
      options: withBaseOptions(),
      data: journalEnsureResultSchema,
      async run({ args, vault, requestId }) {
        return services.core.ensureJournal({
          vault,
          requestId,
          date: args.date,
        })
      },
      renderMarkdown({ data }) {
        return `# Journal Ready\n\n- date: ${data.date}\n- lookupId: ${data.lookupId}\n- path: ${data.journalPath}\n- created: ${data.created}`
      },
    }),
  )

  cli.command(journal)
}
