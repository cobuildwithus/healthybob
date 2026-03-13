import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import { localDateSchema, pathSchema } from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

const payloadSchema = z.record(z.string(), z.unknown())
const inputFileSchema = z
  .string()
  .regex(/^@.+/u, 'Expected an @file.json payload reference.')

const scaffoldResultSchema = z.object({
  vault: pathSchema,
  noun: z.literal('regimen'),
  payload: payloadSchema,
})

const upsertResultSchema = z.object({
  vault: pathSchema,
  regimenId: z.string().min(1),
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

const stopResultSchema = z.object({
  vault: pathSchema,
  regimenId: z.string().min(1),
  lookupId: z.string().min(1),
  stoppedOn: localDateSchema.nullable(),
  status: z.string().min(1),
})

interface RegimenServices extends VaultCliServices {
  core: VaultCliServices['core'] & {
    scaffoldRegimen(input: {
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof scaffoldResultSchema>>
    upsertRegimen(input: {
      input: string
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof upsertResultSchema>>
    stopRegimen(input: {
      regimenId: string
      stoppedOn?: string
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof stopResultSchema>>
  }
  query: VaultCliServices['query'] & {
    showRegimen(input: {
      id: string
      vault: string
      requestId: string | null
    }): Promise<z.infer<typeof showResultSchema>>
    listRegimens(input: {
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

export function registerRegimenCommands(cli: Cli.Cli, services: VaultCliServices) {
  const healthServices = services as RegimenServices
  const regimen = Cli.create('regimen', {
    description: 'Regimen registry commands for the health extension surface.',
  })

  regimen.command(
    'scaffold',
    defineCommand({
      command: 'regimen scaffold',
      description: 'Emit a payload template for regimen upserts.',
      args: z.object({}),
      options: withBaseOptions(),
      data: scaffoldResultSchema,
      async run({ vault, requestId }) {
        return healthServices.core.scaffoldRegimen({ vault, requestId })
      },
      renderMarkdown({ data }) {
        return `# Regimen Scaffold\n\n- payloadKeys: ${Object.keys(data.payload).length}`
      },
    }),
  )

  regimen.command(
    'upsert',
    defineCommand({
      command: 'regimen upsert',
      description: 'Upsert one regimen from an @file.json payload.',
      args: z.object({}),
      options: withBaseOptions({
        input: inputFileSchema,
      }),
      data: upsertResultSchema,
      async run({ options, vault, requestId }) {
        return healthServices.core.upsertRegimen({
          input: stripAtPrefix(options.input),
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Regimen Upserted\n\n- regimenId: ${data.regimenId}\n- lookupId: ${data.lookupId}\n- created: ${data.created}`
      },
    }),
  )

  regimen.command(
    'show',
    defineCommand({
      command: 'regimen show',
      description: 'Show one regimen by canonical id or slug.',
      args: z.object({
        id: z.string().min(1),
      }),
      options: withBaseOptions(),
      data: showResultSchema,
      async run({ args, vault, requestId }) {
        return healthServices.query.showRegimen({
          id: args.id,
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Regimen\n\n- keys: ${Object.keys(data.entity).length}`
      },
    }),
  )

  regimen.command(
    'list',
    defineCommand({
      command: 'regimen list',
      description: 'List regimens through the health read model.',
      args: z.object({}),
      options: withBaseOptions({
        status: z.string().min(1).optional(),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().positive().max(200).default(50),
      }),
      data: listResultSchema,
      async run({ options, vault, requestId }) {
        return healthServices.query.listRegimens({
          vault,
          requestId,
          status: options.status,
          cursor: options.cursor,
          limit: options.limit,
        })
      },
      renderMarkdown({ data }) {
        return `# Regimens\n\n- count: ${data.count}`
      },
    }),
  )

  regimen.command(
    'stop',
    defineCommand({
      command: 'regimen stop',
      description: 'Stop one regimen while preserving its canonical id.',
      args: z.object({
        regimenId: z.string().min(1),
      }),
      options: withBaseOptions({
        stoppedOn: localDateSchema.optional(),
      }),
      data: stopResultSchema,
      async run({ args, options, vault, requestId }) {
        return healthServices.core.stopRegimen({
          regimenId: args.regimenId,
          stoppedOn: options.stoppedOn,
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Regimen Stopped\n\n- regimenId: ${data.regimenId}\n- stoppedOn: ${data.stoppedOn ?? 'none'}\n- status: ${data.status}`
      },
    }),
  )

  cli.command(regimen)
}
