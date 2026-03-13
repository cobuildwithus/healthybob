import { Cli, z } from 'incur'
import { emptyArgsSchema, withBaseOptions } from '../command-helpers.js'
import {
  listItemSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  eventScaffoldKindSchema,
  listEventRecords,
  loadJsonInputFile,
  scaffoldEventPayload,
  showEventRecord,
  upsertEventRecord,
} from './provider-event-read-helpers.js'

const inputFileOptionSchema = z
  .string()
  .regex(/^@.+/u, 'Expected an @file.json payload reference.')

const eventIdSchema = z
  .string()
  .regex(/^evt_[0-9A-Za-z]+$/u, 'Expected a canonical event id in evt_* form.')

const eventScaffoldResultSchema = z.object({
  vault: pathSchema,
  noun: z.literal('event'),
  kind: eventScaffoldKindSchema,
  payload: z.record(z.string(), z.unknown()),
})

const eventUpsertResultSchema = z.object({
  vault: pathSchema,
  eventId: z.string().min(1),
  lookupId: z.string().min(1),
  ledgerFile: pathSchema,
  created: z.boolean(),
})

const eventListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    kind: z.string().min(1).nullable(),
    from: localDateSchema.nullable(),
    to: localDateSchema.nullable(),
    tag: z.string().min(1).nullable(),
    experiment: slugSchema.nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(listItemSchema),
  nextCursor: z.string().min(1).nullable(),
})

export function registerEventCommands(cli: Cli.Cli, _services: VaultCliServices) {
  const event = Cli.create('event', {
    description: 'Generic canonical event commands for event kinds without specialized nouns.',
  })

  event.command('scaffold', {
    description: 'Emit an event payload template for one canonical event kind.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      kind: eventScaffoldKindSchema.describe('Canonical event kind to scaffold.'),
    }),
    output: eventScaffoldResultSchema,
    async run({ options }) {
      return {
        vault: options.vault,
        noun: 'event' as const,
        kind: options.kind,
        payload: scaffoldEventPayload(options.kind),
      }
    },
  })

  event.command('upsert', {
    description: 'Append one canonical event from an @file.json payload.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      input: inputFileOptionSchema,
    }),
    output: eventUpsertResultSchema,
    async run({ options }) {
      const payload = await loadJsonInputFile(
        options.input.slice(1),
        'event payload',
      )

      return upsertEventRecord({
        vault: options.vault,
        payload,
      })
    },
  })

  event.command('show', {
    description: 'Show one canonical non-history event by event id.',
    args: z.object({
      eventId: eventIdSchema.describe('Canonical event id such as evt_<ULID>.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return showEventRecord(options.vault, args.eventId)
    },
  })

  event.command('list', {
    description: 'List canonical non-history events with kind, date, tag, and experiment filters.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      kind: z.string().min(1).optional(),
      from: localDateSchema.optional(),
      to: localDateSchema.optional(),
      tag: z.string().min(1).optional().describe('Optional comma-separated tag filter.'),
      experiment: slugSchema.optional(),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: eventListResultSchema,
    async run({ options }) {
      return listEventRecords({
        vault: options.vault,
        kind: options.kind,
        from: options.from,
        to: options.to,
        tag: options.tag,
        experiment: options.experiment,
        limit: options.limit,
      })
    },
  })

  cli.command(event)
}
