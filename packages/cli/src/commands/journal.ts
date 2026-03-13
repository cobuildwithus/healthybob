import { Cli, z } from 'incur'
import { requestIdFromOptions, withBaseOptions } from '../command-helpers.js'
import {
  listResultSchema,
  journalEnsureResultSchema,
  localDateSchema,
  showResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  listJournalRecords,
  showJournalRecord,
} from './experiment-journal-vault-read-helpers.js'

export function registerJournalCommands(cli: Cli.Cli, services: VaultCliServices) {
  const journal = Cli.create('journal', {
    description: 'Journal document commands routed through the core write API.',
  })

  journal.command(
    'ensure',
    {
      description: 'Create or confirm the daily journal document for a date.',
      args: z.object({
        date: localDateSchema,
      }),
      options: withBaseOptions(),
      output: journalEnsureResultSchema,
      async run({ args, options }) {
        return services.core.ensureJournal({
          vault: options.vault,
          requestId: requestIdFromOptions(options),
          date: args.date,
        })
      },
    },
  )

  journal.command('show', {
    description: 'Show the journal document for one day.',
    args: z.object({
      date: localDateSchema.describe('Journal day to read.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return showJournalRecord(options.vault, args.date)
    },
  })

  journal.command('list', {
    description: 'List journal documents over an optional date range.',
    args: z.object({}),
    options: withBaseOptions({
      from: localDateSchema.optional().describe('Inclusive lower date bound.'),
      to: localDateSchema.optional().describe('Inclusive upper date bound.'),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: listResultSchema,
    async run({ options }) {
      return listJournalRecords({
        vault: options.vault,
        from: options.from,
        to: options.to,
        limit: options.limit,
      })
    },
  })

  cli.command(journal)
}
