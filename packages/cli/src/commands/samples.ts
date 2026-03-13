import { Cli, z } from 'incur'
import { emptyArgsSchema, requestIdFromOptions, withBaseOptions } from '../command-helpers.js'
import {
  listItemSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
  samplesImportCsvResultSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  importCsvSamples,
  listSampleBatches,
  listSamples,
  showSample,
  showSampleBatch,
} from './samples-audit-read-helpers.js'

const sampleIdSchema = z
  .string()
  .regex(/^smp_[0-9A-Za-z]+$/u, 'Expected a canonical sample id in smp_* form.')

const batchIdSchema = z
  .string()
  .regex(/^xfm_[0-9A-Za-z]+$/u, 'Expected a transform batch id in xfm_* form.')

const csvOptionSchema = z
  .string()
  .optional()
  .describe('Optional comma-separated values.')

const sampleListItemSchema = listItemSchema.extend({
  quality: z.string().min(1).nullable(),
  stream: z.string().min(1).nullable(),
})

const samplesListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    stream: z.string().min(1).nullable(),
    from: localDateSchema.nullable(),
    to: localDateSchema.nullable(),
    quality: z.string().min(1).nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(sampleListItemSchema),
})

const sampleBatchManifestSchema = z.object({}).catchall(z.unknown())

const sampleBatchShowResultSchema = z.object({
  vault: pathSchema,
  batchId: z.string().min(1),
  stream: z.string().min(1).nullable(),
  manifestFile: pathSchema,
  rawDirectory: pathSchema.nullable(),
  importedAt: z.string().min(1).nullable(),
  source: z.string().min(1).nullable(),
  importedCount: z.number().int().nonnegative().nullable(),
  sampleIds: z.array(z.string().min(1)),
  importConfig: sampleBatchManifestSchema,
  artifacts: z.array(sampleBatchManifestSchema),
  manifest: sampleBatchManifestSchema,
})

const sampleBatchListItemSchema = z.object({
  batchId: z.string().min(1),
  stream: z.string().min(1).nullable(),
  manifestFile: pathSchema,
  importedAt: z.string().min(1).nullable(),
  source: z.string().min(1).nullable(),
  importedCount: z.number().int().nonnegative().nullable(),
})

const sampleBatchListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    stream: z.string().min(1).nullable(),
    from: localDateSchema.nullable(),
    to: localDateSchema.nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(sampleBatchListItemSchema),
})

export function registerSamplesCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  const samples = Cli.create('samples', {
    description: 'Sample ingestion and inspection commands routed through importers and the query read model.',
  })

  samples.command(
    'import-csv',
    {
      description: 'Import timestamped numeric samples from a CSV file.',
      args: z.object({
        file: pathSchema.describe('Source CSV file to import.'),
      }),
      options: withBaseOptions({
        preset: z
          .string()
          .min(1)
          .optional()
          .describe('Optional preset id that supplies stream, delimiter, and column defaults.'),
        stream: z
          .string()
          .min(1)
          .optional()
          .describe('Stream identifier to write under. Required unless the selected preset supplies it.'),
        tsColumn: z
          .string()
          .min(1)
          .optional()
          .describe('CSV column containing timestamps. Required unless the selected preset supplies it.'),
        valueColumn: z
          .string()
          .min(1)
          .optional()
          .describe('CSV column containing the numeric value. Required unless the selected preset supplies it.'),
        unit: z
          .string()
          .min(1)
          .optional()
          .describe('Unit label for the imported values. Required unless the selected preset supplies it.'),
        delimiter: z
          .string()
          .length(1)
          .optional()
          .describe('Optional single-character CSV delimiter override.'),
        metadataColumns: csvOptionSchema.describe(
          'Optional comma-separated metadata columns to copy into batch provenance rows.',
        ),
        source: z
          .string()
          .min(1)
          .optional()
          .describe('Optional sample source override such as import, device, or manual.'),
      }),
      output: samplesImportCsvResultSchema,
      async run({ args, options }) {
        return importCsvSamples({
          delimiter: options.delimiter,
          file: args.file,
          metadataColumns: parseCsvOption(options.metadataColumns),
          presetId: options.preset,
          requestId: requestIdFromOptions(options),
          source: options.source,
          stream: options.stream,
          tsColumn: options.tsColumn,
          valueColumn: options.valueColumn,
          unit: options.unit,
          vault: options.vault,
        })
      },
    },
  )

  samples.command('show', {
    description: 'Show one sample record by canonical sample id.',
    args: z.object({
      sampleId: sampleIdSchema.describe('Sample id such as smp_<ULID>.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return {
        vault: options.vault,
        entity: await showSample(options.vault, args.sampleId),
      }
    },
  })

  samples.command('list', {
    description: 'List sample records with optional stream, date-range, and quality filters.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      stream: z.string().min(1).optional(),
      from: localDateSchema.optional(),
      to: localDateSchema.optional(),
      quality: z.string().min(1).optional(),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: samplesListResultSchema,
    async run({ options }) {
      const items = await listSamples(options.vault, {
        from: options.from,
        limit: options.limit,
        quality: options.quality,
        stream: options.stream,
        to: options.to,
      })

      return {
        vault: options.vault,
        filters: {
          stream: options.stream ?? null,
          from: options.from ?? null,
          to: options.to ?? null,
          quality: options.quality ?? null,
          limit: options.limit,
        },
        items,
      }
    },
  })

  const batch = Cli.create('batch', {
    description: 'Sample import-batch inspection commands for xfm_* ids.',
  })

  batch.command('show', {
    description: 'Show one imported sample batch by transform id.',
    args: z.object({
      batchId: batchIdSchema.describe('Transform batch id such as xfm_<ULID>.'),
    }),
    options: withBaseOptions(),
    output: sampleBatchShowResultSchema,
    async run({ args, options }) {
      const batchDetails = await showSampleBatch(options.vault, args.batchId)

      return {
        vault: options.vault,
        ...batchDetails,
      }
    },
  })

  batch.command('list', {
    description: 'List imported sample batches from raw sample manifests.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      stream: z.string().min(1).optional(),
      from: localDateSchema.optional(),
      to: localDateSchema.optional(),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: sampleBatchListResultSchema,
    async run({ options }) {
      const items = await listSampleBatches(options.vault, {
        from: options.from,
        limit: options.limit,
        stream: options.stream,
        to: options.to,
      })

      return {
        vault: options.vault,
        filters: {
          stream: options.stream ?? null,
          from: options.from ?? null,
          to: options.to ?? null,
          limit: options.limit,
        },
        items: items.map((item) => ({
          batchId: item.batchId,
          stream: item.stream,
          manifestFile: item.manifestFile,
          importedAt: item.importedAt,
          source: item.source,
          importedCount: item.importedCount,
        })),
      }
    },
  })

  samples.command(batch)

  cli.command(samples)
}

function parseCsvOption(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.length > 0 ? entries : undefined
}
