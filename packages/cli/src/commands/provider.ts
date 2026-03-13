import { Cli, z } from 'incur'
import { emptyArgsSchema, withBaseOptions } from '../command-helpers.js'
import {
  listItemSchema,
  pathSchema,
  showResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  loadJsonInputFile,
  listProviderRecords,
  parseProviderPayload,
  scaffoldProviderPayload,
  showProviderRecord,
  upsertProviderRecord,
} from './provider-event-read-helpers.js'

const inputFileOptionSchema = z
  .string()
  .regex(/^@.+/u, 'Expected an @file.json payload reference.')

const providerStatusSchema = z.string().min(1)

const providerScaffoldResultSchema = z.object({
  vault: pathSchema,
  noun: z.literal('provider'),
  payload: z.record(z.string(), z.unknown()),
})

const providerUpsertResultSchema = z.object({
  vault: pathSchema,
  providerId: z.string().min(1),
  lookupId: z.string().min(1),
  path: pathSchema,
  created: z.boolean(),
})

const providerListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    status: providerStatusSchema.nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(listItemSchema),
  nextCursor: z.string().min(1).nullable(),
})

export function registerProviderCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  const provider = Cli.create('provider', {
    description: 'Provider registry commands for bank/providers Markdown records.',
  })

  provider.command('scaffold', {
    description: 'Emit a provider payload template for `provider upsert`.',
    args: emptyArgsSchema,
    options: withBaseOptions(),
    output: providerScaffoldResultSchema,
    async run({ options }) {
      return {
        vault: options.vault,
        noun: 'provider' as const,
        payload: scaffoldProviderPayload(),
      }
    },
  })

  provider.command('upsert', {
    description: 'Create or update one provider Markdown record from an @file.json payload.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      input: inputFileOptionSchema,
    }),
    output: providerUpsertResultSchema,
    async run({ options }) {
      const payload = parseProviderPayload(
        await loadJsonInputFile(options.input.slice(1), 'provider payload'),
      )

      return upsertProviderRecord({
        vault: options.vault,
        payload,
      })
    },
  })

  provider.command('show', {
    description: 'Show one provider by canonical id or slug.',
    args: z.object({
      lookup: z.string().min(1).describe('Provider id or slug to show.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return showProviderRecord(options.vault, args.lookup)
    },
  })

  provider.command('list', {
    description: 'List provider records with an optional status filter.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      status: providerStatusSchema.optional(),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: providerListResultSchema,
    async run({ options }) {
      return listProviderRecords({
        vault: options.vault,
        status: options.status as z.infer<typeof providerStatusSchema> | undefined,
        limit: options.limit,
      })
    },
  })

  cli.command(provider)
}
