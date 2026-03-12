#!/usr/bin/env node

import { createVaultCli } from './vault-cli.js'

const cli = createVaultCli()

cli.serve()
