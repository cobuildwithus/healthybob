import { Cli } from "incur";
import { registerHealthEntityCrudGroup } from "./health-entity-command-registry.js";
import type { VaultCliServices } from "../vault-cli-services.js";

export function registerFamilyCommands(cli: Cli.Cli, services: VaultCliServices) {
  registerHealthEntityCrudGroup(cli, services, "family");
}
