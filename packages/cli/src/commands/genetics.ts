import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import { pathSchema } from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

const payloadSchema = z.record(z.string(), z.unknown())
const inputFileSchema = z
  .string()
  .regex(/^@.+/u, 'Expected an @file.json payload reference.')

const scaffoldResultSchema = z.object({
  vault: pathSchema,
  noun: z.literal('genetics'),
  payload: payloadSchema,
})

const upsertResultSchema = z.object({
  vault: pathSchema,
  variantId: z.string().min(1),
  lookupId: z.string().min(1),
  path: pathSchema.optional(),
  created: z.boolean(),
})

const showResultSchema = z.object({
  vault: pathSchema,
  entity: payloadSchema,
})

const listResultSchema = z.object({
  vault: pathSchema,
  items: z.array(payloadSchema),
  count: z.number().int().nonnegative(),
})

interface GeneticsServices extends VaultCliServices {
  core: VaultCliServices['core'] & {
    scaffoldGeneticVariant(input: {
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof scaffoldResultSchema>>
    upsertGeneticVariant(input: {
      input: string
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof upsertResultSchema>>
  }
  query: VaultCliServices['query'] & {
    showGeneticVariant(input: {
      id: string
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof showResultSchema>>
    listGeneticVariants(input: {
      vault: string
      requestId: string | null
      status?: string
      cursor?: string
      limit?: number
    }): Promise<z.infer<typeof listResultSchema>>
  }
}

function stripAtPrefix(input: string) {
  return input.slice(1)
}

export function registerGeneticsCommands(cli: Cli.Cli, services: VaultCliServices) {
  const healthServices = services as GeneticsServices
  const genetics = Cli.create('genetics', {
    description: 'Genetic variant commands for the health extension surface.',
  })

  genetics.command(
    'scaffold',
    defineCommand({
      command: 'genetics scaffold',
      description: 'Emit a payload template for genetic variant upserts.',
      args: z.object({}),
      options: withBaseOptions(),
      data: scaffoldResultSchema,
      async run({ vault, requestId }) {
        return healthServices.core.scaffoldGeneticVariant({ vault, requestId })
      },
      renderMarkdown({ data }) {
        return `# Genetics Scaffold\n\n- payloadKeys: ${Object.keys(data.payload).length}`
      },
    }),
  )

  genetics.command(
    'upsert',
    defineCommand({
      command: 'genetics upsert',
      description: 'Upsert one genetic variant from an @file.json payload.',
      args: z.object({}),
      options: withBaseOptions({
        input: inputFileSchema,
      }),
      data: upsertResultSchema,
      async run({ options, vault, requestId }) {
        return healthServices.core.upsertGeneticVariant({
          input: stripAtPrefix(options.input),
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Genetic Variant Upserted\n\n- variantId: ${data.variantId}\n- lookupId: ${data.lookupId}\n- created: ${data.created}`
      },
    }),
  )

  genetics.command(
    'show',
    defineCommand({
      command: 'genetics show',
      description: 'Show one genetic variant by canonical id or slug.',
      args: z.object({
        id: z.string().min(1),
      }),
      options: withBaseOptions(),
      data: showResultSchema,
      async run({ args, vault, requestId }) {
        return healthServices.query.showGeneticVariant({
          id: args.id,
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Genetic Variant\n\n- keys: ${Object.keys(data.entity).length}`
      },
    }),
  )

  genetics.command(
    'list',
    defineCommand({
      command: 'genetics list',
      description: 'List genetic variants through the health read model.',
      args: z.object({}),
      options: withBaseOptions({
        status: z.string().min(1).optional(),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().positive().max(200).default(50),
      }),
      data: listResultSchema,
      async run({ options, vault, requestId }) {
        return healthServices.query.listGeneticVariants({
          vault,
          requestId,
          status: options.status,
          cursor: options.cursor,
          limit: options.limit,
        })
      },
      renderMarkdown({ data }) {
        return `# Genetics\n\n- count: ${data.count}`
      },
    }),
  )

  cli.command(genetics)
}
