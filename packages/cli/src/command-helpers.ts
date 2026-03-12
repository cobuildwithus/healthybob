import { z } from 'incur'
import {
  baseCommandOptionsSchema,
  type BaseCommandOptions,
} from './vault-cli-contracts.js'
import {
  type WrappedCommandSpec,
  wrapCommand,
} from './root-middleware.js'

export const emptyArgsSchema = z.object({})

export function withBaseOptions<TOptions extends z.AnyZodObject>(
  schema?: TOptions,
) {
  return schema ? baseCommandOptionsSchema.extend(schema.shape) : baseCommandOptionsSchema
}

export function defineCommand<
  TArgsSchema extends z.AnyZodObject,
  TOptionsSchema extends z.AnyZodObject,
  TDataSchema extends z.ZodTypeAny,
>(
  spec: WrappedCommandSpec<TArgsSchema, TOptionsSchema, TDataSchema>,
) {
  return wrapCommand(spec)
}

export type CommonCommandOptions = BaseCommandOptions
