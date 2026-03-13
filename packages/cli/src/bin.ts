#!/usr/bin/env node

import { createVaultCli } from './vault-cli.js'

const cli = createVaultCli()

cli.serve(rewriteSearchArgv(process.argv.slice(2)))

function rewriteSearchArgv(argv: string[]): string[] {
  if (argv[0] !== 'search') {
    return argv
  }

  if (argv[1] === 'index' && (argv[2] === 'status' || argv[2] === 'rebuild')) {
    return ['search', `index-${argv[2]}`, ...argv.slice(3)]
  }

  return argv
}
