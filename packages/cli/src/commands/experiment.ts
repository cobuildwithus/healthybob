import { Cli, z } from 'incur'
import { defineCommand, withBaseOptions } from '../command-helpers.js'
import {
  experimentCreateResultSchema,
  slugSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerExperimentCommands(
  cli: Cli.Cli,
  services: VaultCliServices,
) {
  const experiment = Cli.create('experiment', {
    description: 'Experiment bank commands routed through the core write API.',
  })

  experiment.command(
    'create',
    defineCommand({
      command: 'experiment create',
      description: 'Create a baseline experiment document.',
      args: z.object({
        slug: slugSchema,
      }),
      options: withBaseOptions(),
      data: experimentCreateResultSchema,
      async run({ args, vault, requestId }) {
        return services.core.createExperiment({
          vault,
          requestId,
          slug: args.slug,
        })
      },
      renderMarkdown({ data }) {
        return `# Experiment Created\n\n- experimentId: ${data.experimentId}\n- lookupId: ${data.lookupId}\n- slug: ${data.slug}\n- path: ${data.experimentPath}\n- created: ${data.created}`
      },
    }),
  )

  cli.command(experiment)
}
