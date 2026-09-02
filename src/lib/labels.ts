/**
 * Connec8 OS — canonical enum metadata shared by every view.
 * Single source of truth for labels + badge colors.
 */

export type EnumMeta = { label: string; color: string }

const badge = (cls: string): EnumMeta => ({ label: '', color: cls })

// ── Lead pipeline stages (agency) ──
export const LEAD_STAGES: Record<string, EnumMeta> = {
  LEAD_FOUND: { label: 'Lead Found', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  RESEARCHING: { label: 'Researching', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  OPPORTUNITY_IDENTIFIED: { label: 'Opportunity Identified', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  PITCH_PREPARED: { label: 'Pitch/Demo Prepared', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  CONTACTED: { label: 'Contacted', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  AWAITING_REPLY: { label: 'Awaiting Reply', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  REPLIED: { label: 'Replied', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  ACTIVE_CONVERSATION: { label: 'Active Conversation', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MEETING: { label: 'Meeting', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  PROPOSAL_SENT: { label: 'Proposal Sent', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  NEGOTIATING: { label: 'Negotiating', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  WON: { label: 'Won', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  LOST: { label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}
export const LEAD_STAGE_ORDER = Object.keys(LEAD_STAGES)

// ── SaaS funnel stages ──
export const SAAS_FUNNEL_STAGES: Record<string, EnumMeta> = {
  LEAD: { label: 'Lead', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  CONTACTED: { label: 'Contacted', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  REPLIED: { label: 'Replied', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  INTERESTED: { label: 'Interested', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DEMO: { label: 'Demo', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  TRIAL: { label: 'Trial', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  CLIENT: { label: 'Client', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  LOST: { label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}
export const SAAS_FUNNEL_ORDER: string[] = ['LEAD', 'CONTACTED', 'REPLIED', 'INTERESTED', 'DEMO', 'TRIAL', 'CLIENT']

// ── Priorities ──
export const PRIORITY: Record<string, EnumMeta> = {
  LOW: badge('bg-zinc-100 text-zinc-600 border-zinc-200'),
  MEDIUM: badge('bg-sky-50 text-sky-700 border-sky-200'),
  HIGH: badge('bg-amber-50 text-amber-700 border-amber-200'),
  URGENT: badge('bg-rose-50 text-rose-700 border-rose-200'),
  CRITICAL: badge('bg-rose-50 text-rose-700 border-rose-200'),
}
PRIORITY.LOW.label = 'Low'; PRIORITY.MEDIUM.label = 'Medium'; PRIORITY.HIGH.label = 'High'; PRIORITY.URGENT.label = 'Urgent'; PRIORITY.CRITICAL.label = 'Critical'

// ── Feature statuses ──
export const FEATURE_STATUS: Record<string, EnumMeta> = {
  IDEA: { label: 'Idea', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  RESEARCHING: { label: 'Researching', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  PLANNED: { label: 'Planned', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  READY_TO_BUILD: { label: 'Ready to Build', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  IN_DEVELOPMENT: { label: 'In Development', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  BLOCKED: { label: 'Blocked', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  TESTING: { label: 'Testing', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  REJECTED: { label: 'Not Building', color: 'bg-zinc-100 text-zinc-400 border-zinc-200' },
}
export const FEATURE_STATUS_ORDER = Object.keys(FEATURE_STATUS)

// ── Follow-up statuses & methods ──
export const FOLLOWUP_STATUS: Record<string, EnumMeta> = {
  OVERDUE: { label: 'Overdue', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  DUE_TODAY: { label: 'Due Today', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  UPCOMING: { label: 'Upcoming', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

export const METHODS: Record<string, EnumMeta> = {
  EMAIL: { label: 'Email', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  WHATSAPP: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PHONE: { label: 'Phone Call', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  LINKEDIN: { label: 'LinkedIn', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  INSTAGRAM: { label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  VISIT: { label: 'Physical Visit', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  MEETING: { label: 'Meeting', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  DEMO: { label: 'Demo', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  REDDIT: { label: 'Reddit', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  REFERRAL: { label: 'Referral', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  OTHER: { label: 'Other', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

// ── Outreach channels (superset incl. methods) ──
export const OUTREACH_CHANNELS: Record<string, EnumMeta> = {
  COLD_EMAIL: { label: 'Cold Email', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  LINKEDIN: { label: 'LinkedIn', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  WHATSAPP: { label: 'WhatsApp', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INSTAGRAM: { label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  REDDIT: { label: 'Reddit', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  PHONE: { label: 'Phone Call', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  REFERRAL: { label: 'Referral', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  VISIT: { label: 'Physical Visit', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  OTHER: { label: 'Other', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

export const OUTREACH_STATUS: Record<string, EnumMeta> = {
  SENT: { label: 'Sent', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  DELIVERED: { label: 'Delivered', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  REPLIED: { label: 'Replied', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  POSITIVE: { label: 'Positive Reply', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NEGATIVE: { label: 'Negative Reply', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  MEETING_BOOKED: { label: 'Meeting Booked', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  NO_RESPONSE: { label: 'No Response', color: 'bg-zinc-100 text-zinc-400 border-zinc-200' },
}

// ── Pitch types & statuses ──
export const PITCH_TYPES: Record<string, EnumMeta> = {
  WEBSITE_CONCEPT: { label: 'Website Concept', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  WEBSITE_REDESIGN: { label: 'Website Redesign', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  SOFTWARE_IDEA: { label: 'Software Idea', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  AI_SOLUTION: { label: 'AI Solution', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  LANDING_PAGE: { label: 'Landing Page', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  PRESENTATION: { label: 'Presentation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  PROPOSAL: { label: 'Proposal', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
}

export const PITCH_STATUS: Record<string, EnumMeta> = {
  DRAFT: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  READY: { label: 'Ready', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  SENT: { label: 'Sent', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  VIEWED: { label: 'Viewed', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  DISCUSSING: { label: 'Discussing', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  WON: { label: 'Won', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  LOST: { label: 'Lost', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

// ── Project statuses & types, task statuses ──
export const PROJECT_STATUS: Record<string, EnumMeta> = {
  PLANNING: { label: 'Planning', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  DESIGN: { label: 'Design', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  DEVELOPMENT: { label: 'Development', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  TESTING: { label: 'Testing', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  CLIENT_REVIEW: { label: 'Client Review', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
}
export const PROJECT_STATUS_ORDER = Object.keys(PROJECT_STATUS)

export const PROJECT_TYPES: Record<string, EnumMeta> = {
  WEBSITE: { label: 'Website', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  REDESIGN: { label: 'Redesign', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  ECOMMERCE: { label: 'E-commerce', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  SOFTWARE: { label: 'Software', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  AI: { label: 'AI', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  AUTOMATION: { label: 'Automation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  INTERNAL: { label: 'Internal', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  OTHER: { label: 'Other', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

export const TASK_STATUS: Record<string, EnumMeta> = {
  TODO: { label: 'To Do', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  BLOCKED: { label: 'Blocked', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  DONE: { label: 'Done', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
}

// ── Client statuses ──
export const CLIENT_STATUS: Record<string, EnumMeta> = {
  ACTIVE: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PROSPECT: { label: 'Prospect', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  COMPLETED: { label: 'Completed', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  CHURNED: { label: 'Churned', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  TRIAL: { label: 'Trial', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  PAUSED: { label: 'Paused', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// ── Activity types ──
export const ACTIVITY_TYPES: Record<string, EnumMeta> = {
  LEAD_DISCOVERED: { label: 'Lead discovered', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  RESEARCH: { label: 'Research', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  WEBSITE_ANALYSED: { label: 'Website analysed', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  PITCH_CREATED: { label: 'Pitch created', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  EMAIL_SENT: { label: 'Email sent', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  WHATSAPP_SENT: { label: 'WhatsApp sent', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LINKEDIN_SENT: { label: 'LinkedIn sent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  CALL: { label: 'Call', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  VISIT: { label: 'Visit', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  VISIT_LOGGED: { label: 'Visit logged', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  MEETING: { label: 'Meeting', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  DEMO: { label: 'Demo', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  FOLLOW_UP: { label: 'Follow-up', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  FOLLOW_UP_DONE: { label: 'Follow-up done', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PROPOSAL: { label: 'Proposal', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  REPLY: { label: 'Reply', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  NOTE: { label: 'Note', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  STAGE_CHANGED: { label: 'Stage changed', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PITCH_STATUS: { label: 'Pitch update', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  FEATURE_UPDATE: { label: 'Feature update', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  OUTREACH: { label: 'Outreach', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  OTHER: { label: 'Other', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

// ── "Why is this not built?" structured reasons ──
export const WHY_NOT_COMPLETED: Record<string, string> = {
  WAITING_DEVELOPER: 'Waiting for developer',
  TECHNICAL_DIFFICULTY: 'Technical difficulty',
  LACK_OF_CLARITY: 'Lack of clarity',
  LOWER_PRIORITY: 'Lower priority',
  WAITING_CLIENT: 'Waiting for client feedback',
  DEPENDENCY: 'Dependency not completed',
  NO_BUDGET: 'No budget',
  NEEDS_RESEARCH: 'Need further research',
  OTHER: 'Other',
}

// ── User roles ──
export const USER_ROLES: Record<string, { label: string; desc: string }> = {
  ADMIN: { label: 'Admin', desc: 'Full access' },
  FOUNDER: { label: 'Founder', desc: 'Business-wide access' },
  MANAGER: { label: 'Manager', desc: 'Operational management' },
  DEVELOPER: { label: 'Developer', desc: 'Relevant projects/products' },
  DESIGNER: { label: 'Designer', desc: 'Relevant work' },
  SALES: { label: 'Sales / Outreach', desc: 'Leads and outreach' },
  VIEWER: { label: 'Viewer', desc: 'Read-only access' },
}

// ── Lead sources ──
export const LEAD_SOURCES: Record<string, string> = {
  GOOGLE_MAPS: 'Google Maps', LINKEDIN: 'LinkedIn', REFERRAL: 'Referral', WEBSITE: 'Website',
  WALK_IN: 'Walk-in', INSTAGRAM: 'Instagram', REDDIT: 'Reddit', OTHER: 'Other',
}

// ── Knowledge categories ──
export const KNOWLEDGE_CATEGORIES: Record<string, EnumMeta> = {
  RESEARCH: { label: 'Research', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  IDEA: { label: 'Idea', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  BUSINESS: { label: 'Business', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  COMPETITOR: { label: 'Competitor', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  SALES: { label: 'Sales', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TECHNICAL: { label: 'Technical', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  RESOURCE: { label: 'Resource', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  DECISION: { label: 'Decision', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  GENERAL: { label: 'General', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
}

// ── Effort → weight mapping (weighted progress) ──
export const EFFORT_WEIGHT: Record<string, number> = { XS: 1, S: 2, M: 3, L: 5, XL: 8 }

export function metaOf(map: Record<string, EnumMeta>, key?: string | null): EnumMeta {
  if (!key) return { label: '—', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' }
  return map[key] || { label: key.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), color: 'bg-zinc-100 text-zinc-600 border-zinc-200' }
}

// Parse a JSON string column safely → array
export function parseJsonArray(s?: string | null): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

// Parse a JSON string column safely → records
export function parseJsonObjects<T = any>(s?: string | null): T[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
