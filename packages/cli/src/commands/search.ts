import { Cli, z } from 'incur'
import {
  emptyArgsSchema,
  withBaseOptions,
} from '../command-helpers.js'
import {
  localDateSchema,
  pathSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import { loadQueryRuntime } from '../query-runtime.js'
import type { VaultCliServices } from '../vault-cli-services.js'

const recordTypeValues = [
  'audit',
  'core',
  'event',
  'experiment',
  'journal',
  'sample',
] as const

const timelineEntryTypeValues = [
  'journal',
  'event',
  'sample_summary',
] as const

const searchHitSchema = z.object({
  recordId: z.string().min(1),
  aliasIds: z.array(z.string().min(1)),
  recordType: z.enum(recordTypeValues),
  kind: z.string().min(1).nullable(),
  stream: z.string().min(1).nullable(),
  title: z.string().min(1).nullable(),
  occurredAt: z.string().min(1).nullable(),
  date: localDateSchema.nullable(),
  experimentSlug: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1)),
  path: pathSchema,
  snippet: z.string(),
  score: z.number(),
  matchedTerms: z.array(z.string().min(1)),
  citation: z.object({
    path: pathSchema,
    recordId: z.string().min(1),
    aliasIds: z.array(z.string().min(1)),
  }),
})

const searchResultSchema = z.object({
  vault: pathSchema,
  query: z.string().min(1),
  filters: z.object({
    text: z.string().min(1),
    recordTypes: z.array(z.enum(recordTypeValues)),
    kinds: z.array(z.string().min(1)),
    streams: z.array(z.string().min(1)),
    experiment: slugSchema.nullable(),
    dateFrom: localDateSchema.nullable(),
    dateTo: localDateSchema.nullable(),
    tags: z.array(z.string().min(1)),
    limit: z.number().int().positive().max(200),
  }),
  total: z.number().int().nonnegative(),
  hits: z.array(searchHitSchema),
})

const timelineEntrySchema = z.object({
  id: z.string().min(1),
  entryType: z.enum(timelineEntryTypeValues),
  occurredAt: z.string().min(1),
  date: localDateSchema,
  title: z.string().min(1),
  kind: z.string().min(1),
  stream: z.string().min(1).nullable(),
  experimentSlug: z.string().min(1).nullable(),
  path: pathSchema.nullable(),
  relatedIds: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)),
  data: z.record(z.string(), z.unknown()),
})

const timelineResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    from: localDateSchema.nullable(),
    to: localDateSchema.nullable(),
    experiment: slugSchema.nullable(),
    kinds: z.array(z.string().min(1)),
    streams: z.array(z.string().min(1)),
    entryTypes: z.array(z.enum(timelineEntryTypeValues)),
    limit: z.number().int().positive().max(500),
  }),
  items: z.array(timelineEntrySchema),
})

export function registerSearchCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  cli.command(
    'search',
    {
      description: 'Search the local read model with lexical scoring and structured filters.',
      args: emptyArgsSchema,
      options: withBaseOptions({
        text: z
          .string()
          .min(1)
          .describe('Search text to run across titles, notes, tags, ids, and record payloads.'),
        recordType: z
          .string()
          .optional()
          .describe('Optional comma-separated record types: core, experiment, journal, event, sample, audit.'),
        kind: z
          .string()
          .optional()
          .describe('Optional comma-separated record kinds such as meal, note, document, or journal_day.'),
        stream: z
          .string()
          .optional()
          .describe('Optional comma-separated sample streams; setting this also opts sample rows into search.'),
        experiment: slugSchema
          .optional()
          .describe('Optional experiment slug filter.'),
        dateFrom: localDateSchema
          .optional()
          .describe('Inclusive lower date bound.'),
        dateTo: localDateSchema
          .optional()
          .describe('Inclusive upper date bound.'),
        tag: z
          .string()
          .optional()
          .describe('Optional comma-separated tags that matching records must contain.'),
        limit: z
          .number()
          .int()
          .positive()
          .max(200)
          .default(20)
          .describe('Maximum number of hits to return.'),
      }),
      output: searchResultSchema,
      async run({ options }) {
        const recordTypes = parseRecordTypes(options.recordType)
        const kinds = parseCsvOption(options.kind)
        const streams = parseCsvOption(options.stream)
        const tags = parseCsvOption(options.tag)
        const query = await loadQueryRuntime()
        const vault = await query.readVault(options.vault)
        const result = query.searchVault(vault, options.text, {
          recordTypes: recordTypes.length > 0 ? recordTypes : undefined,
          kinds: kinds.length > 0 ? kinds : undefined,
          streams: streams.length > 0 ? streams : undefined,
          experimentSlug: options.experiment,
          from: options.dateFrom,
          to: options.dateTo,
          tags: tags.length > 0 ? tags : undefined,
          limit: options.limit,
        })

        return {
          vault: options.vault,
          query: result.query,
          filters: {
            text: options.text,
            recordTypes,
            kinds,
            streams,
            experiment: options.experiment ?? null,
            dateFrom: options.dateFrom ?? null,
            dateTo: options.dateTo ?? null,
            tags,
            limit: options.limit,
          },
          total: result.total,
          hits: result.hits as z.infer<typeof searchResultSchema>['hits'],
        }
      },
    },
  )

  cli.command(
    'timeline',
    {
      description: 'Build a descending timeline from journals, events, and daily sample summaries.',
      args: emptyArgsSchema,
      options: withBaseOptions({
        from: localDateSchema
          .optional()
          .describe('Inclusive lower date bound.'),
        to: localDateSchema
          .optional()
          .describe('Inclusive upper date bound.'),
        experiment: slugSchema
          .optional()
          .describe('Optional experiment slug filter.'),
        kind: z
          .string()
          .optional()
          .describe('Optional comma-separated entry kinds such as meal, note, journal_day, or sample_summary.'),
        stream: z
          .string()
          .optional()
          .describe('Optional comma-separated streams; applies to sample summaries and any stream-carrying events.'),
        entryType: z
          .string()
          .optional()
          .describe('Optional comma-separated entry types: journal, event, sample_summary.'),
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .default(200)
          .describe('Maximum number of timeline entries to return.'),
      }),
      output: timelineResultSchema,
      async run({ options }) {
        const kinds = parseCsvOption(options.kind)
        const streams = parseCsvOption(options.stream)
        const entryTypes = parseTimelineEntryTypes(options.entryType)
        const entryTypeSet = entryTypes.length > 0 ? new Set(entryTypes) : null
        const query = await loadQueryRuntime()
        const vault = await query.readVault(options.vault)
        const items = query.buildTimeline(vault, {
          from: options.from,
          to: options.to,
          experimentSlug: options.experiment,
          kinds: kinds.length > 0 ? kinds : undefined,
          streams: streams.length > 0 ? streams : undefined,
          includeJournal: entryTypeSet ? entryTypeSet.has('journal') : true,
          includeEvents: entryTypeSet ? entryTypeSet.has('event') : true,
          includeDailySampleSummaries: entryTypeSet
            ? entryTypeSet.has('sample_summary')
            : true,
          limit: options.limit,
        })

        return {
          vault: options.vault,
          filters: {
            from: options.from ?? null,
            to: options.to ?? null,
            experiment: options.experiment ?? null,
            kinds,
            streams,
            entryTypes,
            limit: options.limit,
          },
          items: items as z.infer<typeof timelineResultSchema>['items'],
        }
      },
    },
  )
}

function parseCsvOption(value: string | undefined): string[] {
  if (typeof value !== 'string') {
    return []
  }

  return [...new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  )]
}

function parseRecordTypes(
  value: string | undefined,
): Array<(typeof recordTypeValues)[number]> {
  const requestedValues = parseCsvOption(value)
  const recordTypeSet = new Set(recordTypeValues)

  return requestedValues.filter(
    (entry): entry is (typeof recordTypeValues)[number] => recordTypeSet.has(entry as (typeof recordTypeValues)[number]),
  )
}

function parseTimelineEntryTypes(
  value: string | undefined,
): Array<(typeof timelineEntryTypeValues)[number]> {
  const requestedValues = parseCsvOption(value)
  const entryTypeSet = new Set(timelineEntryTypeValues)

  return requestedValues.filter(
    (entry): entry is (typeof timelineEntryTypeValues)[number] =>
      entryTypeSet.has(entry as (typeof timelineEntryTypeValues)[number]),
  )
}
