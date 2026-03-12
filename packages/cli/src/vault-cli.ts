import { Cli } from 'incur'
import { registerDocumentCommands } from './commands/document.js'
import { registerExperimentCommands } from './commands/experiment.js'
import { registerExportCommands } from './commands/export.js'
import { registerJournalCommands } from './commands/journal.js'
import { registerMealCommands } from './commands/meal.js'
import { registerReadCommands } from './commands/read.js'
import { registerSamplesCommands } from './commands/samples.js'
import { registerVaultCommands } from './commands/vault.js'
import {
  createIntegratedVaultCliServices,
  type VaultCliServices,
} from './vault-cli-services.js'

export const CLI_DESCRIPTION =
  'Typed operator surface for the Healthy Bob vault baseline'

export function createVaultCli(
  services: VaultCliServices = createIntegratedVaultCliServices(),
): Cli.Cli {
  const cli = Cli.create('vault-cli', {
    description: CLI_DESCRIPTION,
    version: '0.0.0',
  })

  registerVaultCommands(cli, services)
  registerDocumentCommands(cli, services)
  registerMealCommands(cli, services)
  registerSamplesCommands(cli, services)
  registerExperimentCommands(cli, services)
  registerJournalCommands(cli, services)
  registerReadCommands(cli, services)
  registerExportCommands(cli, services)

  return cli
}
