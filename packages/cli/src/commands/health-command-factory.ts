import { Cli, z } from 'incur'
import { requestIdFromOptions, withBaseOptions } from '../command-helpers.js'
import {
  inputFileOptionSchema,
  normalizeInputFileOption,
} from '../json-input.js'
export { healthPayloadSchema } from '../health-cli-descriptors.js'
export { inputFileOptionSchema, normalizeInputFileOption } from '../json-input.js'

const limitOptionSchema = z.number().int().positive().max(200).default(50)
const localDateOptionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD.')
const statusOptionSchema = z.string().min(1).optional()

interface CommandContext {
  requestId: string | null
  vault: string
}

interface UpsertCommandContext extends CommandContext {
  input: string
}

interface ShowCommandContext extends CommandContext {
  id: string
}

interface ListCommandContext extends CommandContext {
  from?: string
  to?: string
  kind?: string
  limit?: number
  status?: string
}

interface CrudDescriptions {
  list: string
  scaffold: string
  show: string
  upsert: string
}

interface CrudHints {
  list?: string
  scaffold?: string
  show?: string
  upsert?: string
}

export type HealthCrudListFilterCapability = 'date-range' | 'kind' | 'status'

type CrudCommandName = keyof CrudDescriptions
type CommandExamples = Array<Record<string, unknown>>
type ServiceMethod<TInput, TResult> = (input: TInput) => Promise<TResult>

interface CrudExamples {
  list?: CommandExamples
  scaffold?: CommandExamples
  show?: CommandExamples
  upsert?: CommandExamples
}

interface CrudOutputs<
  TScaffold,
  TUpsert,
  TShow,
  TList,
> {
  list: z.ZodType<TList>
  scaffold: z.ZodType<TScaffold>
  show: z.ZodType<TShow>
  upsert: z.ZodType<TUpsert>
}

interface CrudServices<
  TScaffold,
  TUpsert,
  TShow,
  TList,
> {
  list(input: ListCommandContext): Promise<TList>
  scaffold(input: CommandContext): Promise<TScaffold>
  show(input: ShowCommandContext): Promise<TShow>
  upsert(input: UpsertCommandContext): Promise<TUpsert>
}

interface HealthCrudConfig<
  TScaffold,
  TUpsert extends object,
  TShow,
  TList,
> {
  descriptions: CrudDescriptions
  examples?: CrudExamples
  group: Cli.Cli
  groupName: string
  hints?: CrudHints
  listFilterCapabilities?: readonly HealthCrudListFilterCapability[]
  listStatusDescription?: string
  noun: string
  outputs: CrudOutputs<TScaffold, TUpsert, TShow, TList>
  payloadFile: string
  pluralNoun: string
  services: CrudServices<TScaffold, TUpsert, TShow, TList>
  showId: {
    description: string
    example: string
    fromUpsert(result: TUpsert): string
  }
}

interface HealthCrudGroupConfig<
  TScaffold,
  TUpsert extends object,
  TShow,
  TList,
> extends Omit<HealthCrudConfig<TScaffold, TUpsert, TShow, TList>, 'group' | 'groupName'> {
  commandName: string
  description: string
}

type HealthCrudConfigAny = HealthCrudConfig<any, any, any, any>

type MethodName<TService, TInput> = {
  [TKey in keyof TService]: TService[TKey] extends ServiceMethod<TInput, any>
    ? TKey
    : never
}[keyof TService]

type MethodResult<TService, TKey extends keyof TService> =
  TService[TKey] extends ServiceMethod<any, infer TResult> ? TResult : never

interface CrudServiceMethodNames<
  TCore extends object,
  TQuery extends object,
  TScaffoldName extends keyof TCore,
  TUpsertName extends keyof TCore,
  TShowName extends keyof TQuery,
  TListName extends keyof TQuery,
> {
  list: TListName
  scaffold: TScaffoldName
  show: TShowName
  upsert: TUpsertName
}

interface SuggestedCommand {
  command: string
  description: string
  args?: Record<string, unknown>
  options?: Record<string, unknown>
}

const defaultExamplesByCommand: Record<
  CrudCommandName,
  (config: HealthCrudConfigAny) => CommandExamples
> = {
  list(config) {
    return [
      {
        description: `List ${config.pluralNoun} with a smaller page size.`,
        options: {
          limit: 10,
          vault: './vault',
        },
      },
    ]
  },
  scaffold(config) {
    return [
      {
        description: `Print a template ${config.noun} payload.`,
        options: {
          vault: './vault',
        },
      },
    ]
  },
  show(config) {
    return [
      {
        args: {
          id: config.showId.example,
        },
        description: `Show one ${config.noun}.`,
        options: {
          vault: './vault',
        },
      },
    ]
  },
  upsert(config) {
    return [
      {
        description: `Upsert one ${config.noun} from a JSON payload file.`,
        options: {
          input: `@${config.payloadFile}`,
          vault: './vault',
        },
      },
    ]
  },
}

const defaultHintsByCommand: Partial<
  Record<CrudCommandName, (config: HealthCrudConfigAny) => string>
> = {
  list() {
    return 'Use --limit to cap results.'
  },
  scaffold(config) {
    return `Edit the emitted payload, save it as ${config.payloadFile}, then pass it back with --input @${config.payloadFile} or pipe it to --input -.`
  },
  upsert(config) {
    return `--input accepts @file.json or - so the CLI can load the structured ${config.noun} payload from disk or stdin.`
  },
}

function examplesFor(
  config: HealthCrudConfigAny,
  command: CrudCommandName,
) {
  return config.examples?.[command] ?? defaultExamplesByCommand[command](config)
}

function hintFor(
  config: HealthCrudConfigAny,
  command: keyof CrudHints,
) {
  return config.hints?.[command] ?? defaultHintsByCommand[command]?.(config)
}

function bindServiceMethod<
  TService extends object,
  TInput,
  TMethodName extends MethodName<TService, TInput>,
>(
  service: TService,
  methodName: TMethodName,
): ServiceMethod<TInput, MethodResult<TService, TMethodName>> {
  const method = service[methodName] as ServiceMethod<
    TInput,
    MethodResult<TService, TMethodName>
  >
  return method.bind(service)
}

export function bindHealthCrudServices<
  TCore extends object,
  TQuery extends object,
  TScaffoldName extends MethodName<TCore, CommandContext>,
  TUpsertName extends MethodName<TCore, UpsertCommandContext>,
  TShowName extends MethodName<TQuery, ShowCommandContext>,
  TListName extends MethodName<TQuery, ListCommandContext>,
>(
  services: {
    core: TCore
    query: TQuery
  },
  methodNames: CrudServiceMethodNames<
    TCore,
    TQuery,
    TScaffoldName,
    TUpsertName,
    TShowName,
    TListName
  >,
): CrudServices<
  MethodResult<TCore, TScaffoldName>,
  MethodResult<TCore, TUpsertName>,
  MethodResult<TQuery, TShowName>,
  MethodResult<TQuery, TListName>
> {
  return {
    list: bindServiceMethod(services.query, methodNames.list),
    scaffold: bindServiceMethod(services.core, methodNames.scaffold),
    show: bindServiceMethod(services.query, methodNames.show),
    upsert: bindServiceMethod(services.core, methodNames.upsert),
  }
}

export function createHealthCrudGroup<
  TScaffold,
  TUpsert extends object,
  TShow,
  TList,
>(
  config: HealthCrudGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  const group = Cli.create(config.commandName, {
    description: config.description,
  })

  registerHealthCrudCommands({
    ...config,
    group,
    groupName: config.commandName,
  })

  return group
}

export function registerHealthCrudGroup<
  TScaffold,
  TUpsert extends object,
  TShow,
  TList,
>(
  cli: Cli.Cli,
  config: HealthCrudGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  const group = createHealthCrudGroup(config)
  cli.command(group)
  return group
}

export function suggestedCommandsCta(commands: SuggestedCommand[]) {
  return {
    commands,
    description: 'Suggested commands:' as const,
  }
}

function upsertCta<TUpsert extends object>(
  config: HealthCrudConfig<any, TUpsert, any, any>,
  result: TUpsert,
) {
  return suggestedCommandsCta([
    {
      command: `${config.groupName} show`,
      args: {
        id: config.showId.fromUpsert(result),
      },
      description: `Show the saved ${config.noun}.`,
      options: {
        vault: true,
      },
    },
    {
      command: `${config.groupName} list`,
      description: `List ${config.pluralNoun}.`,
      options: {
        vault: true,
      },
    },
  ])
}

export function registerHealthCrudCommands<
  TScaffold,
  TUpsert extends object,
  TShow,
  TList,
>(config: HealthCrudConfig<TScaffold, TUpsert, TShow, TList>) {
  config.group.command('scaffold', {
    args: z.object({}),
    description: config.descriptions.scaffold,
    examples: examplesFor(config, 'scaffold'),
    hint: hintFor(config, 'scaffold'),
    options: withBaseOptions(),
    output: config.outputs.scaffold,
    async run(context) {
      const result = await config.services.scaffold({
        requestId: requestIdFromOptions(context.options),
        vault: context.options.vault,
      })

      return context.ok(result, {
        cta: suggestedCommandsCta([
          {
            command: `${config.groupName} upsert`,
            description: `Apply the edited ${config.noun} payload.`,
            options: {
              input: `@${config.payloadFile}`,
              vault: true,
            },
          },
        ]),
      })
    },
  })

  config.group.command('upsert', {
    args: z.object({}),
    description: config.descriptions.upsert,
    examples: examplesFor(config, 'upsert'),
    hint: hintFor(config, 'upsert'),
    options: withBaseOptions({
      input: inputFileOptionSchema,
    }),
    output: config.outputs.upsert,
    async run(context) {
      const result = await config.services.upsert({
        input: normalizeInputFileOption(context.options.input),
        requestId: requestIdFromOptions(context.options),
        vault: context.options.vault,
      })

      return context.ok(result, {
        cta: upsertCta(config, result),
      })
    },
  })

  config.group.command('show', {
    args: z.object({
      id: z.string().min(1).describe(config.showId.description),
    }),
    description: config.descriptions.show,
    examples: examplesFor(config, 'show'),
    hint: hintFor(config, 'show'),
    options: withBaseOptions(),
    output: config.outputs.show,
    async run(context) {
      return config.services.show({
        id: context.args.id,
        requestId: requestIdFromOptions(context.options),
        vault: context.options.vault,
      })
    },
  })

  const listOptionShape: Record<string, z.ZodTypeAny> = {
    limit: limitOptionSchema,
  }

  if (config.listStatusDescription) {
    listOptionShape.status = statusOptionSchema.describe(config.listStatusDescription)
  }

  if (config.listFilterCapabilities?.includes('date-range')) {
    listOptionShape.from = localDateOptionSchema
      .optional()
      .describe('Optional inclusive lower date bound in YYYY-MM-DD form.')
    listOptionShape.to = localDateOptionSchema
      .optional()
      .describe('Optional inclusive upper date bound in YYYY-MM-DD form.')
  }

  if (config.listFilterCapabilities?.includes('kind')) {
    listOptionShape.kind = z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional history event kind filter such as encounter, procedure, test, adverse_effect, or exposure.',
      )
  }

  const listOptions = withBaseOptions(listOptionShape)

  config.group.command('list', {
    args: z.object({}),
    description: config.descriptions.list,
    examples: examplesFor(config, 'list'),
    hint: hintFor(config, 'list'),
    options: listOptions,
    output: config.outputs.list,
    async run(context) {
      const limit =
        'limit' in context.options &&
        typeof context.options.limit === 'number'
          ? context.options.limit
          : undefined
      const requestId =
        'requestId' in context.options &&
        typeof context.options.requestId === 'string'
          ? context.options.requestId
          : null
      const status =
        'status' in context.options &&
        typeof context.options.status === 'string'
          ? context.options.status
          : undefined
      const vault =
        'vault' in context.options &&
        typeof context.options.vault === 'string'
          ? context.options.vault
          : ''

      return config.services.list({
        from:
          'from' in context.options &&
          typeof context.options.from === 'string'
            ? context.options.from
            : undefined,
        kind:
          'kind' in context.options &&
          typeof context.options.kind === 'string'
            ? context.options.kind
            : undefined,
        limit,
        requestId,
        status,
        to:
          'to' in context.options &&
          typeof context.options.to === 'string'
            ? context.options.to
            : undefined,
        vault,
      })
    },
  })
}

type CommandOptionShape = Record<string, z.ZodTypeAny>

interface FactoryCommandConfig<TResult> {
  name: string
  args: z.ZodObject<any>
  description: string
  examples?: CommandExamples
  hint?: string
  options?: CommandOptionShape
  output: z.ZodType<TResult>
  run(input: {
    args: Record<string, unknown>
    options: Record<string, unknown> & { vault: string }
    requestId: string | null
  }): Promise<TResult>
}

interface FactoryCommandGroupConfig {
  commandName: string
  description: string
  commands: readonly FactoryCommandConfig<any>[]
}

interface NamedArgCommandConfig<TResult> {
  description: string
  argName: string
  argSchema: z.ZodTypeAny
  examples?: CommandExamples
  hint?: string
  output: z.ZodType<TResult>
  run(input: ShowCommandContext): Promise<TResult>
}

interface RegistryDocEntityGroupConfig<
  TScaffold,
  TUpsert,
  TShow,
  TList,
> {
  commandName: string
  description: string
  scaffold: FactoryCommandConfig<TScaffold>
  upsert: {
    description: string
    examples?: CommandExamples
    hint?: string
    output: z.ZodType<TUpsert>
    run(input: UpsertCommandContext): Promise<TUpsert>
  }
  show: NamedArgCommandConfig<TShow>
  list: {
    description: string
    examples?: CommandExamples
    hint?: string
    output: z.ZodType<TList>
    statusOption?: z.ZodTypeAny
    run(input: ListCommandContext): Promise<TList>
  }
}

interface LedgerEventListCommandContext extends ListCommandContext {
  experiment?: string
  tag?: unknown
}

interface LedgerEventEntityGroupConfig<
  TScaffold,
  TUpsert,
  TShow,
  TList,
> {
  commandName: string
  description: string
  scaffold: {
    description: string
    examples?: CommandExamples
    hint?: string
    kindOption: z.ZodTypeAny
    output: z.ZodType<TScaffold>
    run(input: CommandContext & { kind: string }): Promise<TScaffold>
  }
  upsert: {
    description: string
    examples?: CommandExamples
    hint?: string
    output: z.ZodType<TUpsert>
    run(input: UpsertCommandContext): Promise<TUpsert>
  }
  show: NamedArgCommandConfig<TShow>
  list: {
    description: string
    examples?: CommandExamples
    hint?: string
    experimentOption?: z.ZodTypeAny
    kindOption?: z.ZodTypeAny
    output: z.ZodType<TList>
    tagOption?: z.ZodTypeAny
    run(input: LedgerEventListCommandContext): Promise<TList>
  }
}

interface ArtifactListOptionNames {
  from: string
  to: string
}

interface ArtifactBackedEntityGroupConfig<
  TPrimary,
  TShow,
  TList,
  TManifest,
> {
  commandName: string
  description: string
  primaryAction: FactoryCommandConfig<TPrimary>
  show: NamedArgCommandConfig<TShow>
  list: {
    description: string
    examples?: CommandExamples
    hint?: string
    limitOption?: z.ZodTypeAny
    optionNames?: ArtifactListOptionNames
    output: z.ZodType<TList>
    run(input: CommandContext & { from?: string; to?: string; limit?: number }): Promise<TList>
  }
  manifest: NamedArgCommandConfig<TManifest>
  additionalCommands?: readonly FactoryCommandConfig<any>[]
}

interface LifecycleEntityGroupConfig<
  TCreate,
  TShow,
  TList,
  TUpdate,
  TCheckpoint,
  TStop,
> {
  commandName: string
  description: string
  create: FactoryCommandConfig<TCreate>
  show: NamedArgCommandConfig<TShow>
  list: {
    description: string
    examples?: CommandExamples
    hint?: string
    output: z.ZodType<TList>
    statusOption?: z.ZodTypeAny
    run(input: ListCommandContext): Promise<TList>
  }
  update: FactoryCommandConfig<TUpdate>
  checkpoint: FactoryCommandConfig<TCheckpoint>
  stop: {
    description: string
    argName: string
    argSchema: z.ZodTypeAny
    examples?: CommandExamples
    hint?: string
    options?: CommandOptionShape
    output: z.ZodType<TStop>
    run(input: CommandContext & { id: string } & Record<string, unknown>): Promise<TStop>
  }
}

function optionStringValue(
  options: Record<string, unknown>,
  key: string,
) {
  return typeof options[key] === 'string' ? options[key] : undefined
}

function optionNumberValue(
  options: Record<string, unknown>,
  key: string,
) {
  return typeof options[key] === 'number' ? options[key] : undefined
}

function createNamedArgSchema(
  argName: string,
  argSchema: z.ZodTypeAny,
): z.ZodObject<any> {
  return z.object({
    [argName]: argSchema,
  })
}

function createFactoryCommandGroup(config: FactoryCommandGroupConfig) {
  const group = Cli.create(config.commandName, {
    description: config.description,
  })

  for (const command of config.commands) {
    group.command(command.name, {
      args: command.args,
      description: command.description,
      examples: command.examples,
      hint: command.hint,
      options: withBaseOptions(command.options ?? {}),
      output: command.output,
      async run(context) {
        return command.run({
          args: context.args as Record<string, unknown>,
          options: context.options as Record<string, unknown> & { vault: string },
          requestId: requestIdFromOptions(
            context.options as { vault: string; requestId?: string },
          ),
        })
      },
    })
  }

  return group
}

function registerFactoryCommandGroup(
  cli: Cli.Cli,
  config: FactoryCommandGroupConfig,
) {
  const group = createFactoryCommandGroup(config)
  cli.command(group)
  return group
}

export function createRegistryDocEntityGroup<
  TScaffold,
  TUpsert,
  TShow,
  TList,
>(
  config: RegistryDocEntityGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  return createFactoryCommandGroup({
    commandName: config.commandName,
    description: config.description,
    commands: [
      config.scaffold,
      {
        name: 'upsert',
        args: z.object({}),
        description: config.upsert.description,
        examples: config.upsert.examples,
        hint: config.upsert.hint,
        options: {
          input: inputFileOptionSchema,
        },
        output: config.upsert.output,
        run({ options, requestId }) {
          return config.upsert.run({
            input: normalizeInputFileOption(String(options.input ?? '')),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'show',
        args: createNamedArgSchema(config.show.argName, config.show.argSchema),
        description: config.show.description,
        examples: config.show.examples,
        hint: config.show.hint,
        output: config.show.output,
        run({ args, options, requestId }) {
          return config.show.run({
            id: String(args[config.show.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'list',
        args: z.object({}),
        description: config.list.description,
        examples: config.list.examples,
        hint: config.list.hint,
        options: {
          ...(config.list.statusOption ? { status: config.list.statusOption } : {}),
          limit: limitOptionSchema,
        },
        output: config.list.output,
        run({ options, requestId }) {
          return config.list.run({
            limit: optionNumberValue(options, 'limit'),
            requestId,
            status: optionStringValue(options, 'status'),
            vault: String(options.vault ?? ''),
          })
        },
      },
    ],
  })
}

export function registerRegistryDocEntityGroup<
  TScaffold,
  TUpsert,
  TShow,
  TList,
>(
  cli: Cli.Cli,
  config: RegistryDocEntityGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  const group = createRegistryDocEntityGroup(config)
  cli.command(group)
  return group
}

export function createLedgerEventEntityGroup<
  TScaffold,
  TUpsert,
  TShow,
  TList,
>(
  config: LedgerEventEntityGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  return createFactoryCommandGroup({
    commandName: config.commandName,
    description: config.description,
    commands: [
      {
        name: 'scaffold',
        args: z.object({}),
        description: config.scaffold.description,
        examples: config.scaffold.examples,
        hint: config.scaffold.hint,
        options: {
          kind: config.scaffold.kindOption,
        },
        output: config.scaffold.output,
        run({ options, requestId }) {
          return config.scaffold.run({
            kind: String(options.kind ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'upsert',
        args: z.object({}),
        description: config.upsert.description,
        examples: config.upsert.examples,
        hint: config.upsert.hint,
        options: {
          input: inputFileOptionSchema,
        },
        output: config.upsert.output,
        run({ options, requestId }) {
          return config.upsert.run({
            input: normalizeInputFileOption(String(options.input ?? '')),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'show',
        args: createNamedArgSchema(config.show.argName, config.show.argSchema),
        description: config.show.description,
        examples: config.show.examples,
        hint: config.show.hint,
        output: config.show.output,
        run({ args, options, requestId }) {
          return config.show.run({
            id: String(args[config.show.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'list',
        args: z.object({}),
        description: config.list.description,
        examples: config.list.examples,
        hint: config.list.hint,
        options: {
          ...(config.list.kindOption ? { kind: config.list.kindOption } : {}),
          from: localDateOptionSchema.optional(),
          to: localDateOptionSchema.optional(),
          ...(config.list.tagOption ? { tag: config.list.tagOption } : {}),
          ...(config.list.experimentOption
            ? { experiment: config.list.experimentOption }
            : {}),
          limit: limitOptionSchema,
        },
        output: config.list.output,
        run({ options, requestId }) {
          return config.list.run({
            experiment: optionStringValue(options, 'experiment'),
            from: optionStringValue(options, 'from'),
            kind: optionStringValue(options, 'kind'),
            limit: optionNumberValue(options, 'limit'),
            requestId,
            tag: options.tag,
            to: optionStringValue(options, 'to'),
            vault: String(options.vault ?? ''),
          })
        },
      },
    ],
  })
}

export function registerLedgerEventEntityGroup<
  TScaffold,
  TUpsert,
  TShow,
  TList,
>(
  cli: Cli.Cli,
  config: LedgerEventEntityGroupConfig<TScaffold, TUpsert, TShow, TList>,
) {
  const group = createLedgerEventEntityGroup(config)
  cli.command(group)
  return group
}

export function createArtifactBackedEntityGroup<
  TPrimary,
  TShow,
  TList,
  TManifest,
>(
  config: ArtifactBackedEntityGroupConfig<TPrimary, TShow, TList, TManifest>,
) {
  const optionNames = config.list.optionNames ?? {
    from: 'from',
    to: 'to',
  }

  return createFactoryCommandGroup({
    commandName: config.commandName,
    description: config.description,
    commands: [
      config.primaryAction,
      {
        name: 'show',
        args: createNamedArgSchema(config.show.argName, config.show.argSchema),
        description: config.show.description,
        examples: config.show.examples,
        hint: config.show.hint,
        output: config.show.output,
        run({ args, options, requestId }) {
          return config.show.run({
            id: String(args[config.show.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'list',
        args: z.object({}),
        description: config.list.description,
        examples: config.list.examples,
        hint: config.list.hint,
        options: {
          [optionNames.from]: localDateOptionSchema
            .optional()
            .describe('Optional inclusive start date in YYYY-MM-DD form.'),
          [optionNames.to]: localDateOptionSchema
            .optional()
            .describe('Optional inclusive end date in YYYY-MM-DD form.'),
          ...(config.list.limitOption ? { limit: config.list.limitOption } : {}),
        },
        output: config.list.output,
        run({ options, requestId }) {
          return config.list.run({
            from: optionStringValue(options, optionNames.from),
            limit: optionNumberValue(options, 'limit'),
            requestId,
            to: optionStringValue(options, optionNames.to),
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'manifest',
        args: createNamedArgSchema(
          config.manifest.argName,
          config.manifest.argSchema,
        ),
        description: config.manifest.description,
        examples: config.manifest.examples,
        hint: config.manifest.hint,
        output: config.manifest.output,
        run({ args, options, requestId }) {
          return config.manifest.run({
            id: String(args[config.manifest.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      ...(config.additionalCommands ?? []),
    ],
  })
}

export function registerArtifactBackedEntityGroup<
  TPrimary,
  TShow,
  TList,
  TManifest,
>(
  cli: Cli.Cli,
  config: ArtifactBackedEntityGroupConfig<TPrimary, TShow, TList, TManifest>,
) {
  const group = createArtifactBackedEntityGroup(config)
  cli.command(group)
  return group
}

export function createLifecycleEntityGroup<
  TCreate,
  TShow,
  TList,
  TUpdate,
  TCheckpoint,
  TStop,
>(
  config: LifecycleEntityGroupConfig<
    TCreate,
    TShow,
    TList,
    TUpdate,
    TCheckpoint,
    TStop
  >,
) {
  return createFactoryCommandGroup({
    commandName: config.commandName,
    description: config.description,
    commands: [
      config.create,
      {
        name: 'show',
        args: createNamedArgSchema(config.show.argName, config.show.argSchema),
        description: config.show.description,
        examples: config.show.examples,
        hint: config.show.hint,
        output: config.show.output,
        run({ args, options, requestId }) {
          return config.show.run({
            id: String(args[config.show.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
          })
        },
      },
      {
        name: 'list',
        args: z.object({}),
        description: config.list.description,
        examples: config.list.examples,
        hint: config.list.hint,
        options: {
          ...(config.list.statusOption ? { status: config.list.statusOption } : {}),
          limit: limitOptionSchema,
        },
        output: config.list.output,
        run({ options, requestId }) {
          return config.list.run({
            limit: optionNumberValue(options, 'limit'),
            requestId,
            status: optionStringValue(options, 'status'),
            vault: String(options.vault ?? ''),
          })
        },
      },
      config.update,
      config.checkpoint,
      {
        name: 'stop',
        args: createNamedArgSchema(config.stop.argName, config.stop.argSchema),
        description: config.stop.description,
        examples: config.stop.examples,
        hint: config.stop.hint,
        options: config.stop.options,
        output: config.stop.output,
        run({ args, options, requestId }) {
          return config.stop.run({
            id: String(args[config.stop.argName] ?? ''),
            requestId,
            vault: String(options.vault ?? ''),
            ...(options as Record<string, unknown>),
          })
        },
      },
    ],
  })
}

export function registerLifecycleEntityGroup<
  TCreate,
  TShow,
  TList,
  TUpdate,
  TCheckpoint,
  TStop,
>(
  cli: Cli.Cli,
  config: LifecycleEntityGroupConfig<
    TCreate,
    TShow,
    TList,
    TUpdate,
    TCheckpoint,
    TStop
  >,
) {
  const group = createLifecycleEntityGroup(config)
  cli.command(group)
  return group
}
