import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import {
  pathSchema,
  samplesImportCsvResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerSamplesCommands(
  cli: Cli,
  services: VaultCliServices,
) {
  const samples = Cli.create('samples', {
    description: 'Sample ingestion commands routed through importers.',
  })

  samples.command(
    'import-csv',
    defineCommand({
      command: 'samples import-csv',
      description: 'Import timestamped numeric samples from a CSV file.',
      args: z.object({
        file: pathSchema.describe('Source CSV file to import.'),
      }),
      options: withBaseOptions(
        z.object({
          stream: z.string().min(1).describe('Stream identifier to write under.'),
          tsColumn: z
            .string()
            .min(1)
            .describe('CSV column containing timestamps.'),
          valueColumn: z
            .string()
            .min(1)
            .describe('CSV column containing the numeric value.'),
          unit: z.string().min(1).describe('Unit label for the imported values.'),
        }),
      ),
      data: samplesImportCsvResultSchema,
      async run({ args, options, vault, requestId }) {
        return services.importers.importSamplesCsv({
          file: args.file,
          vault,
          requestId,
          stream: options.stream,
          tsColumn: options.tsColumn,
          valueColumn: options.valueColumn,
          unit: options.unit,
        })
      },
      renderMarkdown({ data }) {
        return `# Samples Imported\n\n- stream: ${data.stream}\n- imported: ${data.importedCount}\n- transform: ${data.transformId}\n- ledgers: ${data.ledgerFiles.length}`
      },
    }),
  )

  cli.command(samples)
}
