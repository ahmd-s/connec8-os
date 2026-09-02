/** Connec8 OS — shared API payload types (frontend contract). */

export interface User { id: string; name: string; email: string; role: string; title?: string | null }

export interface Attachment {
  id: string; fileName: string; mimeType?: string | null; size: number
  entityType: string; entityId: string; uploaderName?: string | null
  url: string; createdAt: string
}

export interface Activity {
  id: string; type: string; title?: string | null; description: string
  date: string; userId?: string | null; user?: User | null
  leadId?: string | null; saasLeadId?: string | null; productId?: string | null
  clientId?: string | null; projectId?: string | null
}

export interface Lead {
  id: string; businessName: string; contactPerson?: string | null; jobTitle?: string | null
  website?: string | null; industry?: string | null; location?: string | null; companySize?: string | null
  source?: string | null; stage: string; priority: string
  whyTargeted?: string | null; pitchAngle?: string | null; problems?: string | null; notes?: string | null
  email?: string | null; phone?: string | null; whatsapp?: string | null
  linkedin?: string | null; instagram?: string | null; otherContact?: string | null
  lastActivityAt: string; nextFollowUpAt?: string | null; convertedClientId?: string | null
  assignedToId?: string | null; assignedTo?: User | null
  createdAt: string; updatedAt: string
  activities?: Activity[]; followUps?: FollowUp[]; outreaches?: Outreach[]
  pitches?: Pitch[]; meetings?: Meeting[]; contacts?: Contact[]; attachments?: Attachment[]
}

export interface FollowUp {
  id: string; title: string; dueDate: string; method: string
  reason?: string | null; context?: string | null; suggestedNextAction?: string | null
  status: string; completedAt?: string | null
  leadId?: string | null; lead?: Lead | null
  saasLeadId?: string | null; saasLead?: SaasLead | null
  clientId?: string | null; client?: Client | null
  productId?: string | null; product?: SaasProduct | null
  createdAt: string
}

export interface Outreach {
  id: string; channel: string; mode: string; date: string
  message?: string | null; status: string; response?: string | null; followUpRequired: boolean
  whoMet?: string | null; whatWasDiscussed?: string | null; whatTheySaid?: string | null
  problemsIdentified?: string | null; objections?: string | null; featuresLiked?: string | null
  featuresRequested?: string | null; interest?: string | null; nextAction?: string | null; outcome?: string | null
  leadId?: string | null; lead?: Lead | null
  saasLeadId?: string | null; saasLead?: SaasLead | null
  productId?: string | null; product?: SaasProduct | null
  userId?: string | null; user?: User | null
  createdAt: string
}

export interface Pitch {
  id: string; title: string; type: string; status: string; link?: string | null; notes?: string | null
  date: string; creatorId?: string | null; creator?: User | null
  leadId?: string | null; lead?: Lead | null
  saasLeadId?: string | null; saasLead?: SaasLead | null
  productId?: string | null; product?: SaasProduct | null
}

export interface SaasProduct {
  id: string; name: string; tagline?: string | null; description?: string | null
  status: string; accent: string; createdAt: string
  features?: SaasFeature[]; saasLeads?: SaasLead[]; saasClients?: SaasClient[]
  _count?: Record<string, number>
}

export interface SaasFeature {
  id: string; name: string; description?: string | null; whyItMatters?: string | null
  area?: string | null; priority: string; status: string
  effort?: string | null; weight: number; dependencies?: string | null
  whyNotCompleted?: string | null; blockingDetail?: string | null; nextStep?: string | null
  completedAt?: string | null; notes?: string | null; dateAdded: string
  productId: string; assigneeId?: string | null; assignee?: User | null
  attachments?: Attachment[]
}

export interface SaasLead {
  id: string; businessName: string; location?: string | null; contactPerson?: string | null
  role?: string | null; phone?: string | null; email?: string | null; website?: string | null; social?: string | null
  origin: string; funnelStage: string; interested?: string | null
  requirements?: string | null; problems?: string | null; featuresRequested?: string | null
  objections?: string | null; feedback?: string | null; questions?: string | null
  importantStatements?: string | null; notes?: string | null
  lastActivityAt: string; nextFollowUpAt?: string | null
  productId: string; product?: SaasProduct | null
  followUps?: FollowUp[]; outreaches?: Outreach[]; pitches?: Pitch[]
  saasClient?: SaasClient | null; contacts?: Contact[]; attachments?: Attachment[]
}

export interface SaasClient {
  id: string; businessName: string; contactPerson?: string | null; email?: string | null; phone?: string | null
  plan?: string | null; status: string; onboardingStatus?: string | null
  featuresEnabled?: string | null; customRequirements?: string | null
  issues?: string | null; complaints?: string | null; feedback?: string | null
  featureRequests?: string | null; notes?: string | null; onboardedAt?: string | null
  productId: string; product?: SaasProduct | null; saasLeadId?: string | null; saasLead?: SaasLead | null
}

export interface Client {
  id: string; name: string; industry?: string | null; website?: string | null
  contactPerson?: string | null; email?: string | null; phone?: string | null
  status: string; notes?: string | null; leadId?: string | null; lead?: Lead | null
  projects?: Project[]; meetings?: Meeting[]; contacts?: Contact[]; followUps?: FollowUp[]
  createdAt: string
}

export interface Project {
  id: string; name: string; type: string; description?: string | null; status: string
  startDate?: string | null; deadline?: string | null; budget?: number | null
  team?: string | null; links?: string | null; decisions?: string | null; notes?: string | null
  clientId?: string | null; client?: Client | null
  tasks?: ProjectTask[]; meetings?: Meeting[]
  createdAt: string
}

export interface ProjectTask {
  id: string; title: string; description?: string | null; priority: string; status: string
  deadline?: string | null; notes?: string | null
  projectId: string; project?: Project | null
  assigneeId?: string | null; assignee?: User | null
}

export interface Meeting {
  id: string; title: string; dateTime: string; purpose?: string | null
  participants?: string | null; notes?: string | null; decisions?: string | null
  actionItems?: string | null; nextMeetingAt?: string | null
  leadId?: string | null; lead?: Lead | null
  saasLeadId?: string | null; saasLead?: SaasLead | null
  clientId?: string | null; client?: Client | null
  productId?: string | null; product?: SaasProduct | null
  projectId?: string | null; project?: Project | null
}

export interface Contact {
  id: string; name: string; company?: string | null; role?: string | null
  email?: string | null; phone?: string | null; whatsapp?: string | null
  linkedin?: string | null; socialOther?: string | null; notes?: string | null
  leadId?: string | null; lead?: Lead | null
  clientId?: string | null; client?: Client | null
  saasLeadId?: string | null; saasLead?: SaasLead | null
}

export interface KnowledgeItem {
  id: string; title: string; content: string; category: string
  tags?: string | null; link?: string | null; pinned: boolean
  authorId?: string | null; author?: User | null
  productId?: string | null; product?: SaasProduct | null
  leadId?: string | null; clientId?: string | null; projectId?: string | null; saasLeadId?: string | null
  attachments?: Attachment[]
  createdAt: string; updatedAt: string
}

// ── Dashboard payload ──
export interface AttentionItem {
  severity: 'high' | 'medium' | 'low'
  kind: string
  title: string
  reason: string
  entityType: 'lead' | 'saas_lead' | 'feature' | 'project' | 'meeting' | 'followup' | 'pitch' | 'saas_client'
  entityId: string
  entityName: string
  lastActivityAt?: string | null
  suggestedAction: string
  dueDate?: string | null
}

export interface DashboardData {
  range: string
  metrics: {
    totalLeads: number; newLeads: number
    outreachSent: number; repliesReceived: number; replyRate: number
    activeConversations: number
    followUpsDueToday: number; overdueFollowUps: number
    meetingsScheduled: number
    pitchesSent: number
    dealsWon: number; dealsLost: number
    activeProjects: number; activeSaas: number; activeClients: number
  }
  attention: AttentionItem[]
  followUpsToday: FollowUp[]
  meetingsUpcoming: Meeting[]
  pipeline: { stage: string; count: number }[]
  recentActivity: Activity[]
}

// ── Analytics payload ──
export interface FunnelStep { stage: string; label: string; count: number; convFromPrev: number | null }
export interface ChannelStat { channel: string; sent: number; replies: number; positive: number; meetings: number; conversion: number }
export interface MonthlyPoint { month: string; label: string; leads: number; outreach: number; replies: number; meetings: number; won: number }
export interface AnalyticsData {
  agencyFunnel: FunnelStep[]
  channels: ChannelStat[]
  monthly: MonthlyPoint[]
  saasFunnels: { productId: string; productName: string; funnel: FunnelStep[]; online: number; offline: number }[]
}

// ── Search ──
export interface SearchGroup {
  type: 'lead' | 'saas_lead' | 'client' | 'saas_client' | 'project' | 'contact' | 'pitch' | 'meeting' | 'knowledge' | 'feature' | 'product'
  label: string
  items: { id: string; title: string; subtitle?: string; href: string }[]
}
