import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const REPLY_STATUSES = ['REPLIED', 'POSITIVE', 'NEGATIVE', 'MEETING_BOOKED']
const ACTIVE_CONV_STAGES = ['REPLIED', 'ACTIVE_CONVERSATION', 'NEGOTIATING']
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }

function rangeSince(range: string): Date | null {
  const d = new Date()
  switch (range) {
    case 'today': { const s = startOfToday(); return s }
    case 'week': { d.setDate(d.getDate() - 7); return d }
    case '30d': { d.setDate(d.getDate() - 30); return d }
    default: return null
  }
}
// month = calendar month start
function monthSince(): Date {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

export async function GET(req: NextRequest) {
  try {
    const range = req.nextUrl.searchParams.get('range') || '30d'
    // custom range support: ?since=YYYY-MM-DD&until=YYYY-MM-DD overrides preset ranges
    const sinceP = req.nextUrl.searchParams.get('since')
    const untilP = req.nextUrl.searchParams.get('until')
    let since = range === 'month' ? monthSince() : rangeSince(range)
    if (sinceP) {
      const d = new Date(sinceP); d.setHours(0, 0, 0, 0)
      if (!isNaN(d.getTime())) since = d
    }
    let until: Date | null = untilP ? (() => { const d = new Date(untilP); d.setHours(23, 59, 59, 999); return isNaN(d.getTime()) ? null : d })() : null
    if (until) since = since || new Date(0)

    const [leads, followUps, outreaches, pitches, meetings, products, clients, projects, tasks, saasClients] = await Promise.all([
      db.lead.findMany({ include: { assignedTo: { select: { id: true, name: true } } } }),
      db.followUp.findMany({
        include: {
          lead: { select: { id: true, businessName: true, contactPerson: true } },
          saasLead: { select: { id: true, businessName: true, productId: true } },
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      db.outreach.findMany(),
      db.pitch.findMany(),
      db.meeting.findMany({ orderBy: { dateTime: 'asc' } }),
      db.saasProduct.findMany({ include: { _count: { select: { features: true, saasLeads: true, saasClients: true } } } }),
      db.client.findMany(),
      db.project.findMany({ include: { tasks: { select: { status: true } } } }),
      db.projectTask.findMany(),
      db.saasClient.findMany(),
    ])

    // ── Metrics ──
    const inRange = (dt: Date | string | null | undefined) => {
      if (!dt) return false
      const t = new Date(dt).getTime()
      if (since && t < since.getTime()) return false
      if (until && t > until.getTime()) return false
      if (!since && !until) return true
      return true
    }
    const newLeads = leads.filter((l) => inRange(l.createdAt)).length
    const outreachSent = outreaches.filter((o) => inRange(o.date)).length
    const repliesReceived = outreaches.filter((o) => REPLY_STATUSES.includes(o.status) && inRange(o.date)).length
    const replyRate = outreachSent > 0 ? Math.round((repliesReceived / outreachSent) * 100) : 0
    const activeConversations = leads.filter((l) => ACTIVE_CONV_STAGES.includes(l.stage)).length
    const today0 = startOfToday(); const today24 = endOfToday()
    const openFUs = followUps.filter((f) => f.status === 'UPCOMING')
    const followUpsDueToday = openFUs.filter((f) => new Date(f.dueDate) >= today0 && new Date(f.dueDate) <= today24).length
    const overdueFollowUps = openFUs.filter((f) => new Date(f.dueDate) < today0).length
    const meetingsScheduled = meetings.filter((m) => new Date(m.dateTime) >= new Date()).length
    const pitchesSent = pitches.filter((p) => ['SENT', 'VIEWED', 'DISCUSSING'].includes(p.status) && inRange(p.date)).length
    const dealsWon = leads.filter((l) => l.stage === 'WON' && inRange(l.updatedAt)).length
    const dealsLost = leads.filter((l) => l.stage === 'LOST' && inRange(l.updatedAt)).length
    const activeProjects = projects.filter((p) => p.status !== 'COMPLETED').length
    const activeSaas = products.filter((p) => p.status === 'ACTIVE').length
    const activeClients = clients.filter((c) => c.status === 'ACTIVE').length

    const metrics = {
      totalLeads: leads.length, newLeads,
      outreachSent, repliesReceived, replyRate,
      activeConversations,
      followUpsDueToday, overdueFollowUps,
      meetingsScheduled, pitchesSent,
      dealsWon, dealsLost,
      activeProjects, activeSaas, activeClients,
    }

    // ── Needs Attention ──
    type Item = {
      severity: 'high' | 'medium' | 'low'; kind: string; title: string; reason: string
      entityType: string; entityId: string; entityName: string
      lastActivityAt?: string | null; suggestedAction: string; dueDate?: string | null
    }
    const items: Item[] = []
    const daysSince = (dt: Date | string) => Math.floor((Date.now() - new Date(dt).getTime()) / 86_400_000)
    const daysUntil = (dt: Date | string) => Math.ceil((new Date(dt).getTime() - Date.now()) / 86_400_000)

    for (const f of openFUs) {
      const due = new Date(f.dueDate)
      const owner = f.lead?.businessName || f.saasLead?.businessName || f.client?.name || f.product?.name || 'General'
      const ent = f.lead ? { t: 'lead', id: f.lead.id } : f.saasLead ? { t: 'saas_lead', id: f.saasLead.id } : f.client ? { t: 'lead', id: '' } : { t: 'followup', id: f.id }
      if (due < today0) {
        items.push({
          severity: daysSince(due) > 2 ? 'high' : 'medium', kind: 'overdue_followup',
          title: f.title,
          reason: `Overdue by ${daysSince(due)} day${daysSince(due) === 1 ? '' : 's'} — ${f.method.replaceAll('_', ' ').toLowerCase()} for ${owner}.`,
          entityType: ent.t === 'saas_lead' ? 'saas_lead' : ent.id ? 'lead' : 'followup',
          entityId: ent.id || f.id, entityName: owner,
          lastActivityAt: f.dueDate, dueDate: f.dueDate,
          suggestedAction: f.suggestedNextAction || 'Complete, reschedule or cancel this follow-up.',
        })
      } else if (due >= today0 && due <= today24) {
        items.push({
          severity: 'medium', kind: 'followup_today', title: f.title,
          reason: `Due today — ${f.method.replaceAll('_', ' ').toLowerCase()} for ${owner}.`,
          entityType: ent.t === 'saas_lead' ? 'saas_lead' : ent.id ? 'lead' : 'followup',
          entityId: ent.id || f.id, entityName: owner,
          lastActivityAt: null, dueDate: f.dueDate,
          suggestedAction: f.suggestedNextAction || 'Get it done today to keep momentum.',
        })
      }
    }

    for (const l of leads) {
      if (['WON', 'LOST'].includes(l.stage)) continue
      const idle = daysSince(l.lastActivityAt)
      const entName = l.businessName
      if ((l.stage === 'REPLIED' || l.stage === 'ACTIVE_CONVERSATION') && idle >= 3) {
        items.push({
          severity: 'high', kind: 'reply_awaiting', title: `${entName} replied — waiting on you`,
          reason: `${l.contactPerson || 'They'} replied but no response for ${idle} days. Stage: ${l.stage.replaceAll('_', ' ').toLowerCase()}.`,
          entityType: 'lead', entityId: l.id, entityName: entName,
          lastActivityAt: l.lastActivityAt,
          suggestedAction: l.nextFollowUpAt ? 'Complete the planned follow-up now.' : 'Send the next message — momentum dies in silence.',
        })
      } else if (idle >= 14 && !ACTIVE_CONV_STAGES.includes(l.stage)) {
        items.push({
          severity: 'medium', kind: 'lead_inactive', title: `${entName} went quiet`,
          reason: `No activity for ${idle} days. Stage: ${l.stage.replaceAll('_', ' ').toLowerCase()}.`,
          entityType: 'lead', entityId: l.id, entityName: entName,
          lastActivityAt: l.lastActivityAt,
          suggestedAction: 'Send a nudge or schedule a follow-up — or close it out consciously.',
        })
      }
    }

    const features = await db.saasFeature.findMany({ include: { product: { select: { id: true, name: true } } } })
    for (const f of features) {
      if (f.status === 'BLOCKED') {
        const blockedFor = daysSince(f.updatedAt)
        items.push({
          severity: blockedFor >= 5 ? 'high' : 'medium', kind: 'feature_blocked',
          title: `Blocked: ${f.name} (${f.product.name})`,
          reason: f.blockingDetail || f.whyNotCompleted?.replaceAll('_', ' ').toLowerCase() || 'Blocked without a recorded reason.',
          entityType: 'feature', entityId: f.id, entityName: f.name,
          lastActivityAt: f.updatedAt,
          suggestedAction: f.nextStep || 'Review the blocker and record the next step.',
        })
      }
    }

    for (const p of projects) {
      if (p.status === 'COMPLETED' || !p.deadline) continue
      const dleft = daysUntil(p.deadline)
      if (dleft <= 14) {
        const blockedTasks = (p.tasks || []).filter((t: any) => t.status === 'BLOCKED').length
        items.push({
          severity: dleft <= 5 ? 'high' : 'medium', kind: 'deadline',
          title: `${p.name}: deadline in ${Math.max(dleft, 0)} day${dleft === 1 ? '' : 's'}`,
          reason: blockedTasks > 0
            ? `${blockedTasks} blocked task${blockedTasks === 1 ? '' : 's'} and ${dleft} days to deadline.`
            : `Project is in ${p.status.replaceAll('_', ' ').toLowerCase()}.`,
          entityType: 'project', entityId: p.id, entityName: p.name,
          lastActivityAt: p.updatedAt, dueDate: p.deadline,
          suggestedAction: blockedTasks > 0 ? 'Unblock the stuck tasks first.' : 'Check remaining scope against the deadline.',
        })
      }
    }

    const soonMeetings = meetings.filter((m) => {
      const t = new Date(m.dateTime).getTime()
      return t > Date.now() && t < Date.now() + 48 * 3600_000
    })
    for (const m of soonMeetings) {
      items.push({
        severity: 'low', kind: 'meeting', title: m.title,
        reason: `Meeting ${daysUntil(m.dateTime) >= 1 ? 'tomorrow' : 'today'} at ${new Date(m.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`,
        entityType: 'meeting', entityId: m.id, entityName: m.title,
        lastActivityAt: null, dueDate: m.dateTime,
        suggestedAction: m.purpose ? `Prepare: ${m.purpose}` : 'Prepare notes before the meeting.',
      })
    }

    for (const sc of saasClients) {
      if (sc.issues && ['TRIAL', 'ACTIVE'].includes(sc.status)) {
        items.push({
          severity: 'medium', kind: 'client_issue', title: `${sc.businessName}: open issue`,
          reason: sc.issues, entityType: 'saas_client', entityId: sc.id, entityName: sc.businessName,
          lastActivityAt: sc.updatedAt,
          suggestedAction: 'Resolve before the trial converts (or churn risk rises).',
        })
      }
    }

    const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    items.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])

    // ── Lists ──
    const followUpsToday = openFUs
      .filter((f) => new Date(f.dueDate) <= today24)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    const meetingsUpcoming = meetings
      .filter((m) => new Date(m.dateTime) >= new Date())
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(0, 5)

    const stageCounts: Record<string, number> = {}
    leads.forEach((l) => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1 })
    const pipeline = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }))

    const recentActivity = await db.activity.findMany({
      orderBy: { date: 'desc' }, take: 8,
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({
      range, metrics, attention: items, followUpsToday, meetingsUpcoming, pipeline, recentActivity,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Dashboard failed' }, { status: 500 })
  }
}
