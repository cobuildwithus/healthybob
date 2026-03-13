import { Cli, z } from 'incur'
import {
  emptyArgsSchema,
  withBaseOptions,
} from '../command-helpers.js'
import {
  listItemSchema,
  pathSchema,
  showResultSchema,
  localDateSchema,
} from '../vault-cli-contracts.js'
import {
  type AuditCommandListItem,
  listAudits,
  showAudit,
  tailAudits,
} from './samples-audit-read-helpers.js'
import type { VaultCliServices } from '../vault-cli-services.js'

const auditIdSchema = z
  .string()
  .regex(/^aud_[0-9A-Za-z]+$/u, 'Expected a canonical audit id in aud_* form.')

const auditListItemSchema = listItemSchema.extend({
  action: z.string().min(1).nullable(),
  actor: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  commandName: z.string().min(1).nullable(),
  summary: z.string().min(1).nullable(),
})

const auditListResultSchema = z.object({
  vault: pathSchema,
  filters: z.object({
    action: z.string().min(1).nullable(),
    actor: z.string().min(1).nullable(),
    status: z.string().min(1).nullable(),
    from: localDateSchema.nullable(),
    to: localDateSchema.nullable(),
    limit: z.number().int().positive().max(200),
  }),
  items: z.array(auditListItemSchema),
})

export function registerAuditCommands(
  cli: Cli.Cli,
  _services: VaultCliServices,
) {
  const audit = Cli.create('audit', {
    description: 'Audit inspection commands routed through the query read model.',
  })

  audit.command('show', {
    description: 'Show one audit record by canonical audit id.',
    args: z.object({
      auditId: auditIdSchema.describe('Audit record id such as aud_<ULID>.'),
    }),
    options: withBaseOptions(),
    output: showResultSchema,
    async run({ args, options }) {
      return {
        vault: options.vault,
        entity: await showAudit(options.vault, args.auditId),
      }
    },
  })

  audit.command('list', {
    description: 'List audit records with optional action, actor, status, and date filters.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      action: z.string().min(1).optional(),
      actor: z.string().min(1).optional(),
      status: z.string().min(1).optional(),
      from: localDateSchema.optional(),
      to: localDateSchema.optional(),
      limit: z.number().int().positive().max(200).default(50),
    }),
    output: auditListResultSchema,
    async run({ options }) {
      const items = await listAudits(options.vault, {
        action: options.action,
        actor: options.actor,
        from: options.from,
        limit: options.limit,
        status: options.status,
        to: options.to,
      })

      return {
        vault: options.vault,
        filters: {
          action: options.action ?? null,
          actor: options.actor ?? null,
          status: options.status ?? null,
          from: options.from ?? null,
          to: options.to ?? null,
          limit: options.limit,
        },
        items: items satisfies AuditCommandListItem[],
      }
    },
  })

  audit.command('tail', {
    description: 'Show the latest audit records in descending occurredAt order.',
    args: emptyArgsSchema,
    options: withBaseOptions({
      limit: z.number().int().positive().max(200).default(20),
    }),
    output: auditListResultSchema,
    async run({ options }) {
      const items = await tailAudits(options.vault, options.limit)

      return {
        vault: options.vault,
        filters: {
          action: null,
          actor: null,
          status: null,
          from: null,
          to: null,
          limit: options.limit,
        },
        items: items satisfies AuditCommandListItem[],
      }
    },
  })

  cli.command(audit)
}
