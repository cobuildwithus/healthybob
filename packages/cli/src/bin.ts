#!/usr/bin/env node

import { createVaultCli } from './vault-cli.js'

const cli = createVaultCli()

cli.serve(rewriteSearchIndexArgv(process.argv.slice(2)))

function rewriteSearchIndexArgv(argv: string[]): string[] {
  if (argv[0] !== 'search') {
    return argv
  }

  if (argv[1] !== 'index-status' && argv[1] !== 'index-rebuild') {
    return argv
  }

  if (hasNamedOption(argv, 'text')) {
    return argv
  }

  return [...argv, '--text', '__hb_search_index_command__']
}

function hasNamedOption(argv: readonly string[], optionName: string): boolean {
  return argv.some(
    (token) => token === `--${optionName}` || token.startsWith(`--${optionName}=`),
  )
}
