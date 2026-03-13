import { Cli, z } from 'incur'
import {
  emptyArgsSchema,
  withBaseOptions,
} from '../command-helpers.js'
import {
  documentImportResultSchema,
  isoTimestampSchema,
  listResultSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
} from '../vault-cli-contracts.js'
import { loadRuntimeModule } from '../runtime-import.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  documentLookupSchema,
  listDocumentRecords,
  rawImportManifestResultSchema,
  showDocumentManifest,
  showDocumentRecord,
} from './document-meal-read-helpers.js'

const eventSourceSchema = z.enum(['manual', 'import', 'device', 'derived'])

interface ImportersRuntimeModule {
  createImporters(): {
    importDocument(input: {
      filePath: string
      vaultRoot: string
      title?: string
      occurredAt?: string
      note?: string
      source?: string
    }): Promise<{
      raw: {
        relativePath: string
      }
      manifestPath: string
      documentId: string
      event: {
        id: string
      }
    }>
  }
}

async function loadImportersRuntime() {
  return loadRuntimeModule<ImportersRuntimeModule>('@healthybob/importers')
}

export function registerDocumentCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  const document = Cli.create('document', {
    description: 'Document ingestion commands routed through importers.',
  })

  document.command(
    'import',
    {
      description: 'Copy a source document into the vault raw area and register it.',
      args: z.object({
        file: pathSchema.describe('Path to the source document to ingest.'),
      }),
      options: withBaseOptions({
        title: z
          .string()
          .min(1)
          .optional()
          .describe('Optional document title to record on the emitted event.'),
        occurredAt: isoTimestampSchema
          .optional()
          .describe('Optional occurrence timestamp in ISO 8601 form.'),
        note: z.string().min(1).optional().describe('Optional freeform note.'),
        source: eventSourceSchema
          .optional()
          .describe('Optional event source (`manual`, `import`, `device`, or `derived`).'),
      }),
      output: documentImportResultSchema,
      async run({ args, options }) {
        const importers = (await loadImportersRuntime()).createImporters()
        const result = await importers.importDocument({
          filePath: args.file,
          vaultRoot: options.vault,
          title: options.title,
          occurredAt: options.occurredAt,
          note: options.note,
          source: options.source,
        })

        return {
          vault: options.vault,
          sourceFile: args.file,
          rawFile: result.raw.relativePath,
          manifestFile: result.manifestPath,
          documentId: result.documentId,
          eventId: result.event.id,
          lookupId: result.event.id,
        }
      },
    },
  )

  document.command(
    'show',
    {
      description: 'Show one imported document event by document id or event id.',
      args: z.object({
        id: documentLookupSchema,
      }),
      options: withBaseOptions(),
      output: showResultSchema,
      async run({ args, options }) {
        return showDocumentRecord(options.vault, args.id)
      },
    },
  )

  document.command(
    'list',
    {
      description: 'List imported document events with optional date bounds.',
      args: emptyArgsSchema,
      options: withBaseOptions({
        from: localDateSchema
          .optional()
          .describe('Optional inclusive start date in YYYY-MM-DD form.'),
        to: localDateSchema
          .optional()
          .describe('Optional inclusive end date in YYYY-MM-DD form.'),
      }),
      output: listResultSchema,
      async run({ options }) {
        return listDocumentRecords({
          vault: options.vault,
          from: options.from,
          to: options.to,
        })
      },
    },
  )

  document.command(
    'manifest',
    {
      description: 'Show the immutable raw import manifest for a document event.',
      args: z.object({
        id: documentLookupSchema,
      }),
      options: withBaseOptions(),
      output: rawImportManifestResultSchema,
      async run({ args, options }) {
        return showDocumentManifest(options.vault, args.id)
      },
    },
  )

  cli.command(document)
}
