import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import { documentImportResultSchema, pathSchema } from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerDocumentCommands(
  cli: Cli.Cli,
  services: VaultCliServices,
) {
  const document = Cli.create('document', {
    description: 'Document ingestion commands routed through importers.',
  })

  document.command(
    'import',
    defineCommand({
      command: 'document import',
      description: 'Copy a source document into the vault raw area and register it.',
      args: z.object({
        file: pathSchema.describe('Path to the source document to ingest.'),
      }),
      options: withBaseOptions(),
      data: documentImportResultSchema,
      async run({ args, vault, requestId }) {
        return services.importers.importDocument({
          file: args.file,
          vault,
          requestId,
        })
      },
      renderMarkdown({ data }) {
        return `# Document Imported\n\n- documentId: ${data.documentId}\n- lookupId: ${data.lookupId}\n- source: ${data.sourceFile}\n- raw: ${data.rawFile}\n- event: ${data.eventId}`
      },
    }),
  )

  cli.command(document)
}
