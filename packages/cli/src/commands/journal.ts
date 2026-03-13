import { Cli, z } from 'incur'
import { withBaseOptions } from '../command-helpers.js'
import {
  listResultSchema,
  journalEnsureResultSchema,
  localDateSchema,
  showResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  appendJournalText,
  ensureJournalRecord,
  linkJournalEventIds,
  linkJournalStreams,
  listJournalRecords,
  showJournalRecord,
  unlinkJournalEventIds,
  unlinkJournalStreams,
} from './experiment-journal-vault-read-helpers.js'

const journalMutationResultSchema = z.object({
  vault: z.string().min(1),
  date: localDateSchema,
  lookupId: z.string().min(1),
  journalPath: z.string().min(1),
  created: z.boolean(),
  updated: z.boolean(),
})

const journalLinkResultSchema = z.object({
  vault: z.string().min(1),
  date: localDateSchema,
  lookupId: z.string().min(1),
  journalPath: z.string().min(1),
  created: z.boolean(),
  changed: z.number().int().nonnegative(),
  eventIds: z.array(z.string().min(1)),
  sampleStreams: z.array(z.string().min(1)),
})

export function registerJournalCommands(cli: Cli.Cli, _services: VaultCliServices) {
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
        const result = await ensureJournalRecord({
          vault: options.vault,
          date: args.date,
        })

        return {
          ...result,
          date: args.date,
        }
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

  journal.command('append', {
    description: 'Append freeform markdown text to one journal day.',
    args: z.object({
      date: localDateSchema.describe('Journal day to mutate.'),
    }),
    options: withBaseOptions({
      text: z.string().min(1).describe('Markdown text block to append.'),
    }),
    output: journalMutationResultSchema,
    async run({ args, options }) {
      return appendJournalText({
        vault: options.vault,
        date: args.date,
        text: options.text,
      })
    },
  })

  journal.command('link-event', {
    description: 'Link one or more event ids into the journal day frontmatter.',
    args: z.object({
      date: localDateSchema.describe('Journal day to mutate.'),
    }),
    options: withBaseOptions({
      id: z
        .array(z.string().min(1))
        .min(1)
        .describe('One or more event ids to link. Repeat --id for multiple values.'),
    }),
    output: journalLinkResultSchema,
    async run({ args, options }) {
      return linkJournalEventIds({
        vault: options.vault,
        date: args.date,
        eventIds: options.id,
      })
    },
  })

  journal.command('unlink-event', {
    description: 'Remove one or more event ids from the journal day frontmatter.',
    args: z.object({
      date: localDateSchema.describe('Journal day to mutate.'),
    }),
    options: withBaseOptions({
      id: z
        .array(z.string().min(1))
        .min(1)
        .describe('One or more event ids to unlink. Repeat --id for multiple values.'),
    }),
    output: journalLinkResultSchema,
    async run({ args, options }) {
      return unlinkJournalEventIds({
        vault: options.vault,
        date: args.date,
        eventIds: options.id,
      })
    },
  })

  journal.command('link-stream', {
    description: 'Link one or more sample streams into the journal day frontmatter.',
    args: z.object({
      date: localDateSchema.describe('Journal day to mutate.'),
    }),
    options: withBaseOptions({
      stream: z
        .array(z.string().min(1))
        .min(1)
        .describe('One or more sample streams to link. Repeat --stream for multiple values.'),
    }),
    output: journalLinkResultSchema,
    async run({ args, options }) {
      return linkJournalStreams({
        vault: options.vault,
        date: args.date,
        sampleStreams: options.stream,
      })
    },
  })

  journal.command('unlink-stream', {
    description: 'Remove one or more sample streams from the journal day frontmatter.',
    args: z.object({
      date: localDateSchema.describe('Journal day to mutate.'),
    }),
    options: withBaseOptions({
      stream: z
        .array(z.string().min(1))
        .min(1)
        .describe('One or more sample streams to unlink. Repeat --stream for multiple values.'),
    }),
    output: journalLinkResultSchema,
    async run({ args, options }) {
      return unlinkJournalStreams({
        vault: options.vault,
        date: args.date,
        sampleStreams: options.stream,
      })
    },
  })

  cli.command(journal)
}
