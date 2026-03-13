import { readFile } from 'node:fs/promises'
import { EXPERIMENT_STATUSES } from '@healthybob/contracts'
import { Cli, z } from 'incur'
import { withBaseOptions } from '../command-helpers.js'
import {
  inputFileOptionSchema,
  normalizeInputFileOption,
} from './health-command-factory.js'
import {
  experimentCreateResultSchema,
  isoTimestampSchema,
  listItemSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  checkpointExperimentRecord,
  createExperimentRecord,
  listExperimentRecords,
  showExperimentRecord,
  stopExperimentRecord,
  updateExperimentRecord,
} from './experiment-journal-vault-read-helpers.js'

const experimentStatusSchema = z.enum(EXPERIMENT_STATUSES)

const experimentListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    status: experimentStatusSchema.nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(listItemSchema),
  nextCursor: z.string().min(1).nullable(),
})

const experimentUpdateResultSchema = z.object({
  vault: pathSchema,
  experimentId: z.string().min(1),
  lookupId: z.string().min(1),
  slug: slugSchema,
  experimentPath: pathSchema,
  status: experimentStatusSchema,
  updated: z.boolean(),
})

const experimentLifecycleResultSchema = experimentUpdateResultSchema.extend({
  eventId: z.string().min(1),
  ledgerFile: pathSchema,
})

const experimentSelectorPayloadSchema = z
  .object({
    lookup: z.string().min(1).optional(),
    experimentId: z.string().min(1).optional(),
    slug: slugSchema.optional(),
  })
  .refine(
    (value) =>
      typeof value.lookup === 'string' ||
      typeof value.experimentId === 'string' ||
      typeof value.slug === 'string',
    'Expected one of lookup, experimentId, or slug.',
  )

const experimentUpdatePayloadSchema = experimentSelectorPayloadSchema.extend({
  title: z.string().min(1).optional(),
  hypothesis: z.string().min(1).optional(),
  startedOn: localDateSchema.optional(),
  status: experimentStatusSchema.optional(),
  body: z.string().optional(),
  tags: z.array(slugSchema).optional(),
})

const experimentCheckpointPayloadSchema = experimentSelectorPayloadSchema.extend({
  occurredAt: isoTimestampSchema.optional(),
  title: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
})

export function registerExperimentCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  const experiment = Cli.create('experiment', {
    description: 'Experiment bank commands routed through the core write API.',
  })

  experiment.command(
    'create',
    {
      description: 'Create a baseline experiment document.',
      args: z.object({
        slug: slugSchema,
      }),
      options: withBaseOptions({
        title: z.string().min(1).optional().describe('Optional human-readable title.'),
        hypothesis: z.string().min(1).optional().describe('Optional experiment hypothesis.'),
        startedOn: localDateSchema.optional().describe('Optional experiment start date.'),
        status: experimentStatusSchema.optional().describe('Optional experiment status.'),
      }),
      output: experimentCreateResultSchema,
      async run({ args, options }) {
        return createExperimentRecord({
          vault: options.vault,
          slug: args.slug,
          title: options.title,
          hypothesis: options.hypothesis,
          startedOn: options.startedOn,
          status: options.status,
        })
      },
    },
  )

  experiment.command('show', {
    description: 'Show one experiment by canonical id or slug.',
    args: z.object({
      lookup: z.string().min(1).describe('Experiment id or slug to resolve.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return showExperimentRecord(options.vault, args.lookup)
    },
  })

  experiment.command('list', {
    description: 'List experiments through the query read model.',
    args: z.object({}),
    options: withBaseOptions({
      status: experimentStatusSchema.optional().describe('Optional experiment status filter.'),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: experimentListResultSchema,
    async run({ options }) {
      return listExperimentRecords({
        vault: options.vault,
        status: options.status,
        limit: options.limit,
      })
    },
  })

  experiment.command('update', {
    description: 'Update one experiment frontmatter/body payload from an @file.json input.',
    args: z.object({}),
    options: withBaseOptions({
      input: inputFileOptionSchema,
    }),
    output: experimentUpdateResultSchema,
    async run({ options }) {
      const payload = experimentUpdatePayloadSchema.parse(
        JSON.parse(
          await readFile(normalizeInputFileOption(options.input), 'utf8'),
        ),
      )

      return updateExperimentRecord({
        vault: options.vault,
        lookup: experimentLookupFromPayload(payload),
        title: payload.title,
        hypothesis: payload.hypothesis,
        startedOn: payload.startedOn,
        status: payload.status,
        body: payload.body,
        tags: payload.tags,
      })
    },
  })

  experiment.command('checkpoint', {
    description: 'Append one experiment checkpoint event from an @file.json input.',
    args: z.object({}),
    options: withBaseOptions({
      input: inputFileOptionSchema,
    }),
    output: experimentLifecycleResultSchema,
    async run({ options }) {
      const payload = experimentCheckpointPayloadSchema.parse(
        JSON.parse(
          await readFile(normalizeInputFileOption(options.input), 'utf8'),
        ),
      )

      return checkpointExperimentRecord({
        vault: options.vault,
        lookup: experimentLookupFromPayload(payload),
        occurredAt: payload.occurredAt,
        title: payload.title,
        note: payload.note,
      })
    },
  })

  experiment.command('stop', {
    description: 'Stop one experiment by id or slug and append a stop lifecycle event.',
    args: z.object({
      lookup: z.string().min(1).describe('Experiment id or slug to stop.'),
    }),
    options: withBaseOptions({
      occurredAt: isoTimestampSchema
        .optional()
        .describe('Optional stop timestamp in ISO 8601 form.'),
      note: z.string().min(1).optional().describe('Optional stop note.'),
    }),
    output: experimentLifecycleResultSchema,
    async run({ args, options }) {
      return stopExperimentRecord({
        vault: options.vault,
        lookup: args.lookup,
        occurredAt: options.occurredAt,
        note: options.note,
      })
    },
  })

  cli.command(experiment)
}

function experimentLookupFromPayload(
  payload: z.infer<typeof experimentSelectorPayloadSchema>,
) {
  return payload.lookup ?? payload.experimentId ?? payload.slug ?? ''
}
