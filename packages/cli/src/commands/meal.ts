import { Cli, z } from 'incur'
import { defineCommand, emptyArgsSchema, withBaseOptions } from '../command-helpers.js'
import {
  isoTimestampSchema,
  mealAddResultSchema,
  pathSchema,
} from '../vault-cli-contracts.js'
import type { VaultCliServices } from '../vault-cli-services.js'

export function registerMealCommands(cli: Cli, services: VaultCliServices) {
  const meal = Cli.create('meal', {
    description: 'Meal capture commands routed through the core write API.',
  })

  meal.command(
    'add',
    defineCommand({
      command: 'meal add',
      description: 'Record a meal event using media references plus optional notes.',
      args: emptyArgsSchema,
      options: withBaseOptions(
        z.object({
          photo: pathSchema.describe('Required meal photo path.'),
          audio: pathSchema
            .optional()
            .describe('Optional audio note path.'),
          note: z.string().min(1).optional().describe('Optional freeform note.'),
          occurredAt: isoTimestampSchema
            .optional()
            .describe('Optional occurrence timestamp in ISO 8601 form.'),
        }),
      ),
      data: mealAddResultSchema,
      async run({ options, vault, requestId }) {
        return services.core.addMeal({
          vault,
          requestId,
          photo: options.photo,
          audio: options.audio,
          note: options.note,
          occurredAt: options.occurredAt,
        })
      },
      renderMarkdown({ data }) {
        return `# Meal Added\n\n- meal: ${data.mealId}\n- event: ${data.eventId}\n- photo: ${data.photoPath}\n- occurredAt: ${data.occurredAt ?? 'unknown'}`
      },
    }),
  )

  cli.command(meal)
}
