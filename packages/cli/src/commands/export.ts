import { Cli, z } from 'incur'
import { defineCommand, emptyArgsSchema, withBaseOptions } from '../command-helpers.js'
import {
  exportPackResultSchema,
  localDateSchema,
  pathSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerExportCommands(cli: Cli, services: VaultCliServices) {
  const exportCli = Cli.create('export', {
    description: 'Export commands routed through the query layer.',
  })

  exportCli.command(
    'pack',
    defineCommand({
      command: 'export pack',
      description: 'Build a date-bounded export pack from the read model.',
      args: emptyArgsSchema,
      options: withBaseOptions(
        z.object({
          from: localDateSchema.describe('Inclusive start date for the pack.'),
          to: localDateSchema.describe('Inclusive end date for the pack.'),
          experiment: slugSchema
            .optional()
            .describe('Optional experiment slug filter.'),
          out: pathSchema
            .optional()
            .describe('Optional directory for materialized pack output.'),
        }),
      ),
      data: exportPackResultSchema,
      async run({ options, vault, requestId }) {
        return services.query.exportPack({
          vault,
          requestId,
          from: options.from,
          to: options.to,
          experiment: options.experiment,
          out: options.out,
        })
      },
      renderMarkdown({ data }) {
        return `# Export Pack\n\n- pack: ${data.packId}\n- files: ${data.files.length}\n- range: ${data.from} to ${data.to}`
      },
    }),
  )

  cli.command(exportCli)
}
