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

type ObjectSchema = z.ZodObject<z.ZodRawShape>

export interface SuccessEnvelopeBase<TData> {
  command: string
  ok: true
  format: OutputFormat
  requestId: string | null
  data: TData
  notes?: string[]
  rendered?: string
}

export interface WrappedCommandSpec<
  TArgsSchema extends ObjectSchema,
  TOptionsSchema extends ObjectSchema,
  TDataSchema extends z.ZodTypeAny,
> {
  command: string
  description: string
  args?: TArgsSchema
  options: TOptionsSchema
  data: TDataSchema
  examples?: Array<{
    args?: Partial<z.input<TArgsSchema>>
    options?: Partial<z.input<TOptionsSchema>>
    description: string
  }>
  run(
    input: CommandRunContext<z.infer<TArgsSchema>, z.infer<TOptionsSchema> & BaseCommandOptions>,
  ): Promise<z.infer<TDataSchema>>
  renderMarkdown?(
    envelope: SuccessEnvelopeBase<z.infer<TDataSchema>>,
  ): string | undefined
}

export function wrapCommand<
  TArgsSchema extends ObjectSchema,
  TOptionsSchema extends ObjectSchema,
  TDataSchema extends z.ZodTypeAny,
>(spec: WrappedCommandSpec<TArgsSchema, TOptionsSchema, TDataSchema>): any {
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
      options: z.infer<TOptionsSchema> & BaseCommandOptions
    }): Promise<SuccessEnvelopeBase<z.infer<TDataSchema>> | FailureEnvelope> {
      const requestId =
        typeof options.requestId === 'string' ? options.requestId : null
      const format: OutputFormat = options.format === 'md' ? 'md' : 'json'

      try {
        const envelope = {
          command: spec.command,
          ok: true as const,
          format,
          requestId,
          data: await spec.run({
            args,
            options,
            requestId,
            vault: options.vault,
            format,
          }),
        }

        return {
          ...envelope,
          rendered:
            format === 'md'
              ? spec.renderMarkdown?.(envelope)
              : undefined,
        }
      } catch (error) {
        const normalized = toVaultCliError(error)

        return failureEnvelopeSchema.parse({
          command: spec.command,
          ok: false,
          format,
          requestId,
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
