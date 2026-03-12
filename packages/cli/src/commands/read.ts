import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import {
  listFilterSchema,
  listResultSchema,
  showResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerReadCommands(cli: Cli, services: VaultCliServices) {
  cli.command(
    'show',
    defineCommand({
      command: 'show',
      description: 'Read one vault entity through the query layer.',
      args: z.object({
        id: z.string().min(1).describe('Entity identifier to resolve.'),
      }),
      options: withBaseOptions(),
      data: showResultSchema,
      async run({ args, vault, requestId }) {
        return services.query.show({
          id: args.id,
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Entity\n\n- id: ${data.entity.id}\n- kind: ${data.entity.kind}\n- title: ${data.entity.title ?? 'untitled'}`
      },
    }),
  )

  cli.command(
    'list',
    defineCommand({
      command: 'list',
      description: 'List vault entities through the query layer.',
      args: z.object({}),
      options: withBaseOptions(listFilterSchema),
      data: listResultSchema,
      async run({ options, vault, requestId }) {
        return services.query.list({
          vault,
          requestId,
          kind: options.kind,
          experiment: options.experiment,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          cursor: options.cursor,
          limit: options.limit,
        })
      },
      renderMarkdown({ data }) {
        return `# Entities\n\n- count: ${data.items.length}\n- nextCursor: ${data.nextCursor ?? 'none'}`
      },
    }),
  )
}
