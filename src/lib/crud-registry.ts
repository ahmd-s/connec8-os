/**
 * Connec8 OS — CRUD registry.
 *
 * One typed registry powers /api/crud/[entity]/* for all business entities:
 * field whitelisting + coercion, list filters, detail includes, and
 * side-effect hooks (auto activity logging, lastActivityAt touch, etc.)
 */
import { db } from '@/lib/db'

type FieldKind = 'string' | 'number' | 'boolean' | 'date' | 'json'

export interface EntityConfig {
  model: string
  fields: Record<string, FieldKind>
  required?: string[]
  orderBy?: any
  listInclude?: any
  detailInclude?: any
  listWhere?: (p: URLSearchParams) => any
  postFilter?: (rows: any[], p: URLSearchParams) => any[]
  listTransform?: (rows: any[], p: URLSearchParams) => any[] | Promise<any[]>
  afterCreate?: (created: any, full: any) => Promise<void>
  afterUpdate?: (before: any, after: any, full: any) => Promise<void>
  beforeDelete?: (id: string) => Promise<void>
}

const now = () => new Date()
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86_400_000)

/** normalize channel / method → activity type */
function outreachActivityType(channel: string): string {
  switch (channel) {
    case 'COLD_EMAIL': return 'EMAIL_SENT'
    case 'WHATSAPP': return 'WHATSAPP_SENT'
    case 'LINKEDIN': return 'LINKEDIN_SENT'
    case 'PHONE': return 'CALL'
    case 'VISIT': return 'VISIT_LOGGED'
    default: return 'OUTREACH'
  }
}

async function createActivity(data: any) {
  await db.activity.create({ data })
}

async function touchLead(leadId?: string | null, nextFollowUpAt?: Date | null) {
  if (!leadId) return
  await db.lead.update({ where: { id: leadId }, data: { lastActivityAt: now(), ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}) } }).catch(() => {})
}
async function touchSaasLead(saasLeadId?: string | null, nextFollowUpAt?: Date | null) {
  if (!saasLeadId) return
  await db.saasLead.update({ where: { id: saasLeadId }, data: { lastActivityAt: now(), ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}) } }).catch(() => {})
}

async function cascadeDeleteLead(id: string) {
  await db.followUp.deleteMany({ where: { leadId: id } })
  await db.outreach.deleteMany({ where: { leadId: id } })
  await db.pitch.deleteMany({ where: { leadId: id } })
  await db.meeting.updateMany({ where: { leadId: id }, data: { leadId: null } })
  await db.contact.updateMany({ where: { leadId: id }, data: { leadId: null } })
  await db.attachment.deleteMany({ where: { leadId: id } })
  await db.activity.deleteMany({ where: { leadId: id } })
}
async function cascadeDeleteSaasLead(id: string) {
  await db.followUp.deleteMany({ where: { saasLeadId: id } })
  await db.outreach.deleteMany({ where: { saasLeadId: id } })
  await db.pitch.deleteMany({ where: { saasLeadId: id } })
  await db.meeting.updateMany({ where: { saasLeadId: id }, data: { saasLeadId: null } })
  await db.contact.updateMany({ where: { saasLeadId: id }, data: { saasLeadId: null } })
  await db.attachment.deleteMany({ where: { saasLeadId: id } })
  await db.activity.deleteMany({ where: { saasLeadId: id } })
}
async function cascadeDeleteSaasLeadFull(id: string) { await cascadeDeleteSaasLead(id) }

export const registry: Record<string, EntityConfig> = {
  /* ─────────────── LEADS ─────────────── */
  leads: {
    model: 'lead',
    required: ['businessName'],
    fields: {
      businessName: 'string', contactPerson: 'string', jobTitle: 'string', website: 'string',
      industry: 'string', location: 'string', companySize: 'string', source: 'string',
      stage: 'string', priority: 'string', whyTargeted: 'string', pitchAngle: 'string',
      problems: 'json', notes: 'string', email: 'string', phone: 'string', whatsapp: 'string',
      linkedin: 'string', instagram: 'string', otherContact: 'string',
      nextFollowUpAt: 'date', assignedToId: 'string',
    },
    orderBy: { lastActivityAt: 'desc' },
    listInclude: { assignedTo: { select: { id: true, name: true, role: true } } },
    detailInclude: {
      assignedTo: { select: { id: true, name: true, role: true, title: true } },
      activities: { orderBy: { date: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      followUps: { orderBy: { dueDate: 'desc' } },
      outreaches: { orderBy: { date: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      pitches: { orderBy: { date: 'desc' }, include: { creator: { select: { id: true, name: true } } } },
      meetings: { orderBy: { dateTime: 'desc' } },
      contacts: true,
      attachments: true,
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('stage')) w.stage = p.get('stage')
      if (p.get('priority')) w.priority = p.get('priority')
      if (p.get('assignedToId')) w.assignedToId = p.get('assignedToId')
      if (p.get('source')) w.source = p.get('source')
      return w
    },
    postFilter: (rows, p) => {
      const q = p.get('q')?.toLowerCase()
      if (!q) return rows
      return rows.filter((r) =>
        r.businessName?.toLowerCase().includes(q) ||
        r.contactPerson?.toLowerCase().includes(q) ||
        r.industry?.toLowerCase().includes(q) || false
      )
    },
    afterCreate: async (created, full) => {
      await createActivity({
        type: 'LEAD_DISCOVERED', title: 'Lead discovered',
        description: `Lead added${full?.source ? ` via ${full.source.replaceAll('_', ' ').toLowerCase()}` : ''}.`,
        date: now(), userId: full?.assignedToId ?? null, leadId: created.id,
      })
    },
    afterUpdate: async (before, after) => {
      if (before.stage !== after.stage) {
        await createActivity({
          type: 'STAGE_CHANGED', title: `Moved to ${after.stage.replaceAll('_', ' ').toLowerCase()}`,
          description: `${before.businessName} moved from ${before.stage} → ${after.stage}.`,
          leadId: after.id, userId: after.assignedToId ?? null,
        })
      }
    },
    beforeDelete: cascadeDeleteLead,
  },

  /* ─────────────── ACTIVITIES ─────────────── */
  activities: {
    model: 'activity',
    required: ['type', 'description'],
    fields: {
      type: 'string', title: 'string', description: 'string', date: 'date', userId: 'string',
      leadId: 'string', saasLeadId: 'string', productId: 'string', clientId: 'string', projectId: 'string',
    },
    orderBy: { date: 'desc' },
    listInclude: { user: { select: { id: true, name: true, role: true } } },
    listWhere: (p) => {
      const w: any = {}
      const leadId = p.get('leadId'); const saasLeadId = p.get('saasLeadId')
      const productId = p.get('productId'); const clientId = p.get('clientId'); const projectId = p.get('projectId')
      if (leadId) w.leadId = leadId
      if (saasLeadId) w.saasLeadId = saasLeadId
      if (productId) w.productId = productId
      if (clientId) w.clientId = clientId
      if (projectId) w.projectId = projectId
      return w
    },
    afterCreate: async (created) => {
      await touchLead(created.leadId)
      await touchSaasLead(created.saasLeadId)
    },
  },

  /* ─────────────── FOLLOW-UPS ─────────────── */
  followups: {
    model: 'followUp',
    required: ['title', 'dueDate'],
    fields: {
      title: 'string', dueDate: 'date', method: 'string', reason: 'string', context: 'string',
      suggestedNextAction: 'string', status: 'string', completedAt: 'date',
      leadId: 'string', saasLeadId: 'string', clientId: 'string', productId: 'string', createdById: 'string',
    },
    orderBy: { dueDate: 'asc' },
    listInclude: {
      lead: { select: { id: true, businessName: true, contactPerson: true, stage: true } },
      saasLead: { select: { id: true, businessName: true, contactPerson: true, funnelStage: true, productId: true } },
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      if (p.get('clientId')) w.clientId = p.get('clientId')
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('status')) w.status = p.get('status')
      if (p.get('method')) w.method = p.get('method')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'FOLLOW_UP', title: 'Follow-up scheduled',
        description: `${created.title} — ${created.method.replaceAll('_', ' ').toLowerCase()} due ${new Date(created.dueDate).toISOString().slice(0, 10)}.`,
        date: now(), userId: created.createdById ?? null,
        leadId: created.leadId ?? null, saasLeadId: created.saasLeadId ?? null,
        productId: created.productId ?? null, clientId: created.clientId ?? null,
      })
      if (created.leadId) await touchLead(created.leadId, new Date(created.dueDate))
      if (created.saasLeadId) await touchSaasLead(created.saasLeadId, new Date(created.dueDate))
    },
    afterUpdate: async (before, after) => {
      if (before.status !== after.status && after.status === 'COMPLETED') {
        await createActivity({
          type: 'FOLLOW_UP_DONE', title: 'Follow-up completed',
          description: after.title, date: now(),
          leadId: after.leadId ?? null, saasLeadId: after.saasLeadId ?? null,
          productId: after.productId ?? null, clientId: after.clientId ?? null,
        })
        if (after.leadId) await touchLead(after.leadId, null)
        if (after.saasLeadId) await touchSaasLead(after.saasLeadId, null)
      } else if (before.dueDate !== after.dueDate && after.status === 'UPCOMING') {
        if (after.leadId) await touchLead(after.leadId, new Date(after.dueDate))
        if (after.saasLeadId) await touchSaasLead(after.saasLeadId, new Date(after.dueDate))
      }
    },
  },

  /* ─────────────── OUTREACH ─────────────── */
  outreach: {
    model: 'outreach',
    required: ['channel'],
    fields: {
      channel: 'string', mode: 'string', date: 'date', message: 'string', status: 'string',
      response: 'string', followUpRequired: 'boolean',
      whoMet: 'string', whatWasDiscussed: 'string', whatTheySaid: 'string',
      problemsIdentified: 'string', objections: 'string', featuresLiked: 'string',
      featuresRequested: 'string', interest: 'string', nextAction: 'string', outcome: 'string',
      leadId: 'string', saasLeadId: 'string', productId: 'string', userId: 'string',
    },
    orderBy: { date: 'desc' },
    listInclude: {
      lead: { select: { id: true, businessName: true } },
      saasLead: { select: { id: true, businessName: true, productId: true } },
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('channel')) w.channel = p.get('channel')
      if (p.get('mode')) w.mode = p.get('mode')
      if (p.get('status')) w.status = p.get('status')
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      if (p.get('productId')) w.productId = p.get('productId')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: outreachActivityType(created.channel),
        title: created.mode === 'OFFLINE' ? 'Offline visit / outreach' : `Outreach via ${created.channel.replaceAll('_', ' ').toLowerCase()}`,
        description: created.message || created.whoMet || `Outreach — ${created.status.replaceAll('_', ' ').toLowerCase()}.`,
        date: created.date ?? now(), userId: created.userId ?? null,
        leadId: created.leadId ?? null, saasLeadId: created.saasLeadId ?? null, productId: created.productId ?? null,
      })
      await touchLead(created.leadId)
      await touchSaasLead(created.saasLeadId)
    },
    afterUpdate: async (before, after) => {
      if (before.status !== after.status && ['REPLIED', 'POSITIVE', 'NEGATIVE', 'MEETING_BOOKED'].includes(after.status)) {
        await createActivity({
          type: after.status === 'MEETING_BOOKED' ? 'MEETING' : 'REPLY',
          title: after.status === 'MEETING_BOOKED' ? 'Meeting booked' : `Reply received (${after.status.toLowerCase()})`,
          description: after.response || 'Response recorded on outreach.',
          date: now(), userId: after.userId ?? null,
          leadId: after.leadId ?? null, saasLeadId: after.saasLeadId ?? null, productId: after.productId ?? null,
        })
        await touchLead(after.leadId)
        await touchSaasLead(after.saasLeadId)
      }
    },
  },

  /* ─────────────── PITCHES ─────────────── */
  pitches: {
    model: 'pitch',
    required: ['title'],
    fields: {
      title: 'string', type: 'string', status: 'string', link: 'string', notes: 'string',
      date: 'date', creatorId: 'string', leadId: 'string', saasLeadId: 'string', productId: 'string',
    },
    orderBy: { date: 'desc' },
    listInclude: {
      lead: { select: { id: true, businessName: true } },
      saasLead: { select: { id: true, businessName: true, productId: true } },
      product: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('status')) w.status = p.get('status')
      if (p.get('type')) w.type = p.get('type')
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      if (p.get('productId')) w.productId = p.get('productId')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'PITCH_CREATED', title: 'Pitch created',
        description: created.title, date: created.date ?? now(), userId: created.creatorId ?? null,
        leadId: created.leadId ?? null, saasLeadId: created.saasLeadId ?? null, productId: created.productId ?? null,
      })
      await touchLead(created.leadId)
      await touchSaasLead(created.saasLeadId)
    },
    afterUpdate: async (before, after) => {
      if (before.status !== after.status) {
        await createActivity({
          type: 'PITCH_STATUS', title: `Pitch ${after.status.replaceAll('_', ' ').toLowerCase()}`,
          description: `${after.title} — status → ${after.status}.`,
          leadId: after.leadId ?? null, saasLeadId: after.saasLeadId ?? null, productId: after.productId ?? null,
        })
        await touchLead(after.leadId)
        await touchSaasLead(after.saasLeadId)
      }
    },
  },

  /* ─────────────── PRODUCTS ─────────────── */
  products: {
    model: 'saasProduct',
    required: ['name'],
    fields: { name: 'string', tagline: 'string', description: 'string', status: 'string', accent: 'string' },
    orderBy: { createdAt: 'asc' },
    listInclude: {
      features: { select: { status: true, weight: true, effort: true } },
      saasLeads: { select: { lastActivityAt: true } },
      _count: { select: { saasClients: true, features: true, saasLeads: true } },
    },
    listTransform: (rows) => rows.map((p) => {
      const feats = (p.features || []) as any[]
      const active = feats.filter((f) => f.status !== 'REJECTED')
      const totalW = active.reduce((s, f) => s + (f.weight || 3), 0)
      const doneW = active.filter((f) => f.status === 'COMPLETED').reduce((s, f) => s + (f.weight || 3), 0)
      const byStatus: Record<string, number> = {}
      feats.forEach((f) => { byStatus[f.status] = (byStatus[f.status] || 0) + 1 })
      const leadActivity = (p.saasLeads || []).map((l: any) => new Date(l.lastActivityAt).getTime())
      return {
        id: p.id, name: p.name, tagline: p.tagline, description: p.description, status: p.status,
        accent: p.accent, createdAt: p.createdAt,
        stats: {
          progress: totalW > 0 ? Math.round((doneW / totalW) * 100) : 0,
          features: feats.length,
          byStatus,
          leads: p._count?.saasLeads ?? 0,
          clients: p._count?.saasClients ?? 0,
          lastActivityAt: leadActivity.length ? new Date(Math.max(...leadActivity)).toISOString() : p.updatedAt,
        },
      }
    }),
    detailInclude: {
      features: { orderBy: [{ status: 'asc' }, { dateAdded: 'desc' }], include: { assignee: { select: { id: true, name: true } } } },
      saasLeads: { orderBy: { lastActivityAt: 'desc' } },
      saasClients: { orderBy: { createdAt: 'desc' } },
      followUps: { where: { status: 'UPCOMING' }, orderBy: { dueDate: 'asc' }, include: { saasLead: { select: { id: true, businessName: true } } } },
      outreaches: { orderBy: { date: 'desc' }, take: 20, include: { saasLead: { select: { id: true, businessName: true } }, user: { select: { id: true, name: true } } } },
      pitches: { orderBy: { date: 'desc' }, include: { saasLead: { select: { id: true, businessName: true } }, creator: { select: { id: true, name: true } } } },
      knowledge: { orderBy: { updatedAt: 'desc' }, include: { author: { select: { id: true, name: true } } } },
    },
    beforeDelete: async (id) => {
      const leads = await db.saasLead.findMany({ where: { productId: id }, select: { id: true } })
      for (const l of leads) await cascadeDeleteSaasLeadFull(l.id)
      await db.saasFeature.deleteMany({ where: { productId: id } })
      await db.saasClient.deleteMany({ where: { productId: id } })
      await db.followUp.deleteMany({ where: { productId: id } })
      await db.outreach.deleteMany({ where: { productId: id } })
      await db.pitch.deleteMany({ where: { productId: id } })
      await db.knowledgeItem.deleteMany({ where: { productId: id } })
      await db.meeting.updateMany({ where: { productId: id }, data: { productId: null } })
      await db.activity.deleteMany({ where: { productId: id } })
    },
  },

  /* ─────────────── FEATURES ─────────────── */
  features: {
    model: 'saasFeature',
    required: ['name', 'productId'],
    fields: {
      name: 'string', productId: 'string', description: 'string', whyItMatters: 'string',
      area: 'string', priority: 'string', status: 'string', effort: 'string', weight: 'number',
      dependencies: 'string', whyNotCompleted: 'string', blockingDetail: 'string', nextStep: 'string',
      completedAt: 'date', notes: 'string', dateAdded: 'date', assigneeId: 'string',
    },
    orderBy: { dateAdded: 'desc' },
    listInclude: { assignee: { select: { id: true, name: true } } },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('status')) w.status = p.get('status')
      if (p.get('priority')) w.priority = p.get('priority')
      if (p.get('assigneeId')) w.assigneeId = p.get('assigneeId')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'FEATURE_UPDATE', title: `Feature added: ${created.name}`,
        description: created.description || 'New feature tracked in the product workspace.',
        date: now(), productId: created.productId, userId: created.assigneeId ?? null,
      })
    },
    afterUpdate: async (before, after) => {
      if (before.status !== after.status) {
        await createActivity({
          type: 'FEATURE_UPDATE', title: `${after.name}: ${before.status.replaceAll('_', ' ').toLowerCase()} → ${after.status.replaceAll('_', ' ').toLowerCase()}`,
          description: after.status === 'BLOCKED'
            ? (after.blockingDetail || `Blocked: ${after.whyNotCompleted?.replaceAll('_', ' ').toLowerCase() || 'reason unspecified'}.`)
            : (after.nextStep ? `Next: ${after.nextStep}` : 'Status updated.'),
          date: now(), productId: after.productId, userId: after.assigneeId ?? null,
        })
      }
    },
    beforeDelete: async (id) => { await db.attachment.deleteMany({ where: { featureId: id } }) },
  },

  /* ─────────────── SAAS LEADS ─────────────── */
  'saas-leads': {
    model: 'saasLead',
    required: ['businessName', 'productId'],
    fields: {
      businessName: 'string', productId: 'string', location: 'string', contactPerson: 'string',
      role: 'string', phone: 'string', email: 'string', website: 'string', social: 'string',
      origin: 'string', funnelStage: 'string', interested: 'string',
      requirements: 'string', problems: 'json', featuresRequested: 'string', objections: 'string',
      feedback: 'string', questions: 'string', importantStatements: 'string', notes: 'string',
      nextFollowUpAt: 'date',
    },
    orderBy: { lastActivityAt: 'desc' },
    listInclude: { product: { select: { id: true, name: true } } },
    detailInclude: {
      product: { select: { id: true, name: true, accent: true } },
      followUps: { orderBy: { dueDate: 'desc' } },
      outreaches: { orderBy: { date: 'desc' }, include: { user: { select: { id: true, name: true } } } },
      pitches: { orderBy: { date: 'desc' }, include: { creator: { select: { id: true, name: true } } } },
      contacts: true,
      saasClient: true,
      attachments: true,
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('funnelStage')) w.funnelStage = p.get('funnelStage')
      if (p.get('origin')) w.origin = p.get('origin')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'LEAD_DISCOVERED', title: 'SaaS lead added',
        description: `${created.businessName} added as a ${created.product?.name || 'product'} lead (${created.origin.toLowerCase()} source).`,
        date: now(), saasLeadId: created.id, productId: created.productId,
      })
    },
    afterUpdate: async (before, after) => {
      if (before.funnelStage !== after.funnelStage) {
        await createActivity({
          type: 'STAGE_CHANGED', title: `Funnel: ${before.funnelStage.toLowerCase()} → ${after.funnelStage.toLowerCase()}`,
          description: `${after.businessName} moved along the sales funnel.`,
          saasLeadId: after.id, productId: after.productId,
        })
      }
    },
    beforeDelete: cascadeDeleteSaasLead,
  },

  /* ─────────────── SAAS CLIENTS ─────────────── */
  'saas-clients': {
    model: 'saasClient',
    required: ['businessName', 'productId'],
    fields: {
      businessName: 'string', productId: 'string', contactPerson: 'string', email: 'string',
      phone: 'string', plan: 'string', status: 'string', onboardingStatus: 'string',
      featuresEnabled: 'json', customRequirements: 'string', issues: 'string', complaints: 'string',
      feedback: 'string', featureRequests: 'string', notes: 'string', onboardedAt: 'date', saasLeadId: 'string',
    },
    orderBy: { createdAt: 'desc' },
    listInclude: { product: { select: { id: true, name: true } }, saasLead: { select: { id: true, businessName: true } } },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('status')) w.status = p.get('status')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'OTHER', title: 'Client onboarded',
        description: `${created.businessName} onboarded to the product${created.plan ? ` on the ${created.plan} plan` : ''}.`,
        date: now(), productId: created.productId,
      })
      if (created.saasLeadId) {
        await db.saasLead.update({ where: { id: created.saasLeadId }, data: { funnelStage: 'CLIENT' } }).catch(() => {})
      }
    },
  },

  /* ─────────────── AGENCY CLIENTS ─────────────── */
  clients: {
    model: 'client',
    required: ['name'],
    fields: {
      name: 'string', industry: 'string', website: 'string', contactPerson: 'string',
      email: 'string', phone: 'string', status: 'string', notes: 'string', leadId: 'string',
    },
    orderBy: { createdAt: 'desc' },
    listInclude: { _count: { select: { projects: true, contacts: true } } },
    detailInclude: {
      lead: true,
      projects: { include: { _count: { select: { tasks: true } } } },
      meetings: { orderBy: { dateTime: 'desc' } },
      contacts: true,
      followUps: { orderBy: { dueDate: 'desc' } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('status')) w.status = p.get('status')
      return w
    },
    postFilter: (rows, p) => {
      const q = p.get('q')?.toLowerCase()
      if (!q) return rows
      return rows.filter((r) => r.name?.toLowerCase().includes(q) || r.industry?.toLowerCase().includes(q) || false)
    },
    afterCreate: async (created) => {
      if (created.leadId) {
        await db.lead.update({ where: { id: created.leadId }, data: { stage: 'WON', convertedClientId: created.id } }).catch(() => {})
      }
    },
    beforeDelete: async (id) => {
      await db.project.updateMany({ where: { clientId: id }, data: { clientId: null } })
      await db.meeting.updateMany({ where: { clientId: id }, data: { clientId: null } })
      await db.contact.updateMany({ where: { clientId: id }, data: { clientId: null } })
      await db.followUp.deleteMany({ where: { clientId: id } })
    },
  },

  /* ─────────────── PROJECTS ─────────────── */
  projects: {
    model: 'project',
    required: ['name'],
    fields: {
      name: 'string', clientId: 'string', type: 'string', description: 'string', status: 'string',
      startDate: 'date', deadline: 'date', budget: 'number', team: 'json', links: 'json',
      decisions: 'string', notes: 'string',
    },
    orderBy: { updatedAt: 'desc' },
    listInclude: {
      client: { select: { id: true, name: true } },
      tasks: { select: { status: true, deadline: true } },
      _count: { select: { tasks: true } },
    },
    detailInclude: {
      client: true,
      tasks: { orderBy: { createdAt: 'asc' }, include: { assignee: { select: { id: true, name: true } } } },
      meetings: { orderBy: { dateTime: 'desc' } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('status')) w.status = p.get('status')
      if (p.get('clientId')) w.clientId = p.get('clientId')
      return w
    },
    postFilter: (rows, p) => {
      const q = p.get('q')?.toLowerCase()
      if (!q) return rows
      return rows.filter((r) => r.name?.toLowerCase().includes(q) || false)
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'OTHER', title: 'Project started',
        description: `${created.name} created (${created.type.replaceAll('_', ' ').toLowerCase()}).`,
        date: now(), projectId: created.id,
      })
    },
    beforeDelete: async (id) => {
      await db.projectTask.deleteMany({ where: { projectId: id } })
      await db.meeting.updateMany({ where: { projectId: id }, data: { projectId: null } })
      await db.activity.deleteMany({ where: { projectId: id } })
    },
  },

  /* ─────────────── TASKS ─────────────── */
  tasks: {
    model: 'projectTask',
    required: ['title', 'projectId'],
    fields: {
      title: 'string', projectId: 'string', description: 'string', priority: 'string',
      status: 'string', deadline: 'date', notes: 'string', assigneeId: 'string',
    },
    orderBy: { createdAt: 'asc' },
    listInclude: { assignee: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('projectId')) w.projectId = p.get('projectId')
      if (p.get('status')) w.status = p.get('status')
      if (p.get('assigneeId')) w.assigneeId = p.get('assigneeId')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'OTHER', title: 'Task added',
        description: created.title, date: now(), projectId: created.projectId,
      })
    },
    afterUpdate: async (before, after) => {
      if (before.status !== after.status && after.status === 'DONE') {
        await createActivity({
          type: 'OTHER', title: 'Task completed',
          description: after.title, date: now(), projectId: after.projectId,
        })
      }
    },
  },

  /* ─────────────── MEETINGS ─────────────── */
  meetings: {
    model: 'meeting',
    required: ['title', 'dateTime'],
    fields: {
      title: 'string', dateTime: 'date', purpose: 'string', participants: 'json',
      notes: 'string', decisions: 'string', actionItems: 'json', nextMeetingAt: 'date',
      leadId: 'string', saasLeadId: 'string', clientId: 'string', productId: 'string', projectId: 'string',
    },
    orderBy: { dateTime: 'desc' },
    listInclude: {
      lead: { select: { id: true, businessName: true } },
      saasLead: { select: { id: true, businessName: true, productId: true } },
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      if (p.get('clientId')) w.clientId = p.get('clientId')
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('projectId')) w.projectId = p.get('projectId')
      return w
    },
    afterCreate: async (created) => {
      await createActivity({
        type: 'MEETING', title: 'Meeting logged',
        description: created.title, date: created.dateTime ?? now(),
        leadId: created.leadId ?? null, saasLeadId: created.saasLeadId ?? null,
        productId: created.productId ?? null, clientId: created.clientId ?? null, projectId: created.projectId ?? null,
      })
    },
  },

  /* ─────────────── CONTACTS ─────────────── */
  contacts: {
    model: 'contact',
    required: ['name'],
    fields: {
      name: 'string', company: 'string', role: 'string', email: 'string', phone: 'string',
      whatsapp: 'string', linkedin: 'string', socialOther: 'string', notes: 'string',
      leadId: 'string', clientId: 'string', saasLeadId: 'string',
    },
    orderBy: { createdAt: 'desc' },
    listInclude: {
      lead: { select: { id: true, businessName: true } },
      client: { select: { id: true, name: true } },
      saasLead: { select: { id: true, businessName: true, productId: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('clientId')) w.clientId = p.get('clientId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      return w
    },
    postFilter: (rows, p) => {
      const q = p.get('q')?.toLowerCase()
      if (!q) return rows
      return rows.filter((r) =>
        r.name?.toLowerCase().includes(q) || r.company?.toLowerCase().includes(q) || false
      )
    },
  },

  /* ─────────────── KNOWLEDGE ─────────────── */
  knowledge: {
    model: 'knowledgeItem',
    required: ['title', 'content'],
    fields: {
      title: 'string', content: 'string', category: 'string', tags: 'json', link: 'string',
      pinned: 'boolean', authorId: 'string',
      productId: 'string', leadId: 'string', clientId: 'string', projectId: 'string', saasLeadId: 'string',
    },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    listInclude: {
      author: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    listWhere: (p) => {
      const w: any = {}
      if (p.get('category')) w.category = p.get('category')
      if (p.get('productId')) w.productId = p.get('productId')
      if (p.get('leadId')) w.leadId = p.get('leadId')
      if (p.get('clientId')) w.clientId = p.get('clientId')
      if (p.get('projectId')) w.projectId = p.get('projectId')
      if (p.get('saasLeadId')) w.saasLeadId = p.get('saasLeadId')
      return w
    },
    postFilter: (rows, p) => {
      const q = p.get('q')?.toLowerCase()
      const tag = p.get('tag')
      let out = rows
      if (q) out = out.filter((r) => r.title?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q) || false)
      if (tag) out = out.filter((r) => {
        try { const tags = JSON.parse(r.tags || '[]'); return Array.isArray(tags) && tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase())) } catch { return false }
      })
      return out
    },
    beforeDelete: async (id) => { await db.attachment.deleteMany({ where: { knowledgeId: id } }) },
  },

  /* ─────────────── USERS ─────────────── */
  users: {
    model: 'user',
    required: ['name', 'email'],
    fields: { name: 'string', email: 'string', role: 'string', title: 'string' },
    orderBy: { createdAt: 'asc' },
  },
}

export function getRegistry(entity: string): EntityConfig | null {
  return registry[entity] ?? null
}

/** Coerce + whitelist request body against the entity's field map. */
export function coerceBody(cfg: EntityConfig, body: any, { partial }: { partial: boolean }): { data: any } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const data: any = {}
  for (const [field, kind] of Object.entries(cfg.fields)) {
    if (!(field in body)) continue
    let v = body[field]
    if (kind === 'date') {
      if (v === null || v === '') { data[field] = null; continue }
      const d = new Date(v)
      if (isNaN(d.getTime())) return { error: `Invalid date for field "${field}"` }
      data[field] = d
    } else if (kind === 'number') {
      const n = Number(v)
      if (Number.isNaN(n)) { data[field] = null } else { data[field] = n }
    } else if (kind === 'boolean') {
      data[field] = Boolean(v)
    } else if (kind === 'json') {
      if (v === null || v === '') { data[field] = null; continue }
      data[field] = typeof v === 'string' ? v : JSON.stringify(v)
    } else {
      data[field] = v === '' ? null : String(v)
    }
  }
  if (!partial) {
    for (const req of cfg.required || []) {
      if (data[req] === undefined || data[req] === null || data[req] === '') {
        return { error: `Missing required field: ${req}` }
      }
    }
  }
  return { data }
}
