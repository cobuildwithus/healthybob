import { EXPERIMENT_STATUSES } from '@healthybob/contracts'
import { Cli, z } from 'incur'
import { withBaseOptions } from '../command-helpers.js'
import {
  experimentCreateResultSchema,
  listItemSchema,
  localDateSchema,
  pathSchema,
  showResultSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'
import {
  createExperimentRecord,
  listExperimentRecords,
  showExperimentRecord,
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

  cli.command(experiment)
}
