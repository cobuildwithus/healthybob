import { z } from 'incur'
import type {
  BaseCommandOptions,
  FailureEnvelope,
  OutputFormat,
} from './vault-cli-contracts.js'
import {
  failureEnvelopeSchema,
  successEnvelopeSchema,
} from './vault-cli-contracts.js'
import { toVaultCliError } from './vault-cli-errors.js'

export interface CommandRunContext<TArgs, TOptions extends BaseCommandOptions> {
  args: TArgs
  options: TOptions
  requestId: string | null
  vault: string
  format: OutputFormat
}

interface SuccessEnvelopeBase<TData> {
  command: string
  ok: true
  format: OutputFormat
  requestId: string | null
  data: TData
  notes?: string[]
  rendered?: string
}

export interface WrappedCommandSpec<
  TArgsSchema extends z.AnyZodObject,
  TOptionsSchema extends z.AnyZodObject,
  TDataSchema extends z.ZodTypeAny,
> {
  command: string
  description: string
  args?: TArgsSchema
  options: TOptionsSchema
  data: TDataSchema
  examples?: Array<{
    args?: Record<string, unknown>
    options?: Record<string, unknown>
    description: string
  }>
  run(input: CommandRunContext<z.infer<TArgsSchema>, z.infer<TOptionsSchema>>): Promise<
    z.infer<TDataSchema>
  >
  renderMarkdown?(
    envelope: SuccessEnvelopeBase<z.infer<TDataSchema>>,
  ): string | undefined
}

export function wrapCommand<
  TArgsSchema extends z.AnyZodObject,
  TOptionsSchema extends z.AnyZodObject,
  TDataSchema extends z.ZodTypeAny,
>(spec: WrappedCommandSpec<TArgsSchema, TOptionsSchema, TDataSchema>) {
  return {
    description: spec.description,
    args: spec.args,
    options: spec.options,
    output: z.union([successEnvelopeSchema(spec.data), failureEnvelopeSchema]),
    examples: spec.examples,
    async run({
      args,
      options,
    }: {
      args: z.infer<TArgsSchema>
      options: z.infer<TOptionsSchema>
    }): Promise<SuccessEnvelopeBase<z.infer<TDataSchema>> | FailureEnvelope> {
      try {
        const requestId = options.requestId ?? null
        const envelope = {
          command: spec.command,
          ok: true as const,
          format: options.format,
          requestId,
          data: await spec.run({
            args,
            options,
            requestId,
            vault: options.vault,
            format: options.format,
          }),
        }

        return {
          ...envelope,
          rendered:
            options.format === 'md'
              ? spec.renderMarkdown?.(envelope)
              : undefined,
        }
      } catch (error) {
        const normalized = toVaultCliError(error)

        return failureEnvelopeSchema.parse({
          command: spec.command,
          ok: false,
          format: options.format,
          requestId: options.requestId ?? null,
          error: {
            code: normalized.code,
            message: normalized.message,
            details: normalized.details,
          },
        })
      }
    },
  }
}
