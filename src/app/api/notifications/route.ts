import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Derived alert feed — high-signal only, no noise. */
export async function GET() {
  try {
    const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
    const nowD = new Date()

    const [overdueFus, dueTodayFus, repliedLeads, blockedFeatures, soonMeetings] = await Promise.all([
      db.followUp.findMany({
        where: { status: 'UPCOMING', dueDate: { lt: startOfToday() } },
        include: { lead: { select: { id: true, businessName: true } }, saasLead: { select: { id: true, businessName: true } }, client: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      db.followUp.findMany({
        where: { status: 'UPCOMING', dueDate: { gte: startOfToday(), lt: new Date(new Date().setHours(23, 59, 59, 999)) } },
        include: { lead: { select: { id: true, businessName: true } }, saasLead: { select: { id: true, businessName: true } }, client: { select: { id: true, name: true } }, product: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      db.lead.findMany({ where: { stage: { in: ['REPLIED', 'ACTIVE_CONVERSATION'] } } }),
      db.saasFeature.findMany({ where: { status: 'BLOCKED' }, include: { product: { select: { name: true } } } }),
      db.meeting.findMany({ where: { dateTime: { gte: nowD, lte: new Date(Date.now() + 48 * 3600_000) } }, orderBy: { dateTime: 'asc' } }),
    ])

    const daysSince = (dt: Date | string) => Math.floor((Date.now() - new Date(dt).getTime()) / 86_400_000)
    type NItem = { severity: 'high' | 'medium' | 'low'; kind: string; title: string; reason: string; entityType: string; entityId: string; entityName: string; suggestedAction: string; dueDate?: string | null }
    const items: NItem[] = []

    for (const f of overdueFus) {
      const owner = f.lead?.businessName || f.saasLead?.businessName || f.client?.name || f.product?.name || 'General'
      items.push({
        severity: 'high', kind: 'overdue_followup', title: f.title,
        reason: `Overdue by ${daysSince(f.dueDate)} days — ${owner}`,
        entityType: f.saasLead ? 'saas_lead' : 'lead', entityId: f.saasLead?.id || f.lead?.id || f.id,
        entityName: owner, suggestedAction: f.suggestedNextAction || 'Complete or reschedule.', dueDate: f.dueDate,
      })
    }
    for (const f of dueTodayFus) {
      const owner = f.lead?.businessName || f.saasLead?.businessName || f.client?.name || f.product?.name || 'General'
      items.push({
        severity: 'medium', kind: 'followup_today', title: f.title,
        reason: `Due today — ${owner}`,
        entityType: f.saasLead ? 'saas_lead' : 'lead', entityId: f.saasLead?.id || f.lead?.id || f.id,
        entityName: owner, suggestedAction: f.suggestedNextAction || 'Get it done today.', dueDate: f.dueDate,
      })
    }
    for (const l of repliedLeads) {
      const idle = daysSince(l.lastActivityAt)
      if (idle >= 3) {
        items.push({
          severity: 'high', kind: 'reply_awaiting', title: `${l.businessName} replied — waiting on you`,
          reason: `No response for ${idle} days`,
          entityType: 'lead', entityId: l.id, entityName: l.businessName,
          suggestedAction: 'Send the next message now.',
        })
      }
    }
    for (const f of blockedFeatures) {
      items.push({
        severity: daysSince(f.updatedAt) >= 5 ? 'high' : 'medium', kind: 'feature_blocked',
        title: `Blocked: ${f.name} (${f.product.name})`,
        reason: f.blockingDetail || 'Blocked — no reason recorded.',
        entityType: 'feature', entityId: f.id, entityName: f.name,
        suggestedAction: f.nextStep || 'Review the blocker.',
      })
    }
    for (const m of soonMeetings) {
      items.push({
        severity: 'low', kind: 'meeting', title: m.title,
        reason: `Meeting ${new Date(m.dateTime) > new Date(Date.now() + 24 * 3600_000) ? 'tomorrow' : 'today'} — ${new Date(m.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
        entityType: 'meeting', entityId: m.id, entityName: m.title,
        suggestedAction: m.purpose || 'Prepare notes.', dueDate: m.dateTime,
      })
    }

    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    items.sort((a, b) => rank[a.severity] - rank[b.severity])
    return NextResponse.json({ count: items.length, items: items.slice(0, 12) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Notifications failed' }, { status: 500 })
  }
}
