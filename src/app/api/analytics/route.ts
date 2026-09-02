import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const REPLY_STATUSES = ['REPLIED', 'POSITIVE', 'NEGATIVE', 'MEETING_BOOKED']
// stage index: higher = deeper in funnel
const STAGE_ORDER = ['LEAD_FOUND', 'RESEARCHING', 'OPPORTUNITY_IDENTIFIED', 'PITCH_PREPARED', 'CONTACTED', 'AWAITING_REPLY', 'REPLIED', 'ACTIVE_CONVERSATION', 'MEETING', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST']
const FUNNEL_STEPS: { stage: string; label: string; minIdx: number }[] = [
  { stage: 'LEAD_FOUND', label: 'Leads Found', minIdx: 0 },
  { stage: 'CONTACTED', label: 'Contacted', minIdx: 4 },
  { stage: 'REPLIED', label: 'Replied', minIdx: 6 },
  { stage: 'MEETING', label: 'Meeting', minIdx: 8 },
  { stage: 'PROPOSAL_SENT', label: 'Proposal', minIdx: 9 },
  { stage: 'WON', label: 'Won', minIdx: 11 },
]
const SAAS_FUNNEL: { stage: string; label: string }[] = [
  { stage: 'LEAD', label: 'Leads' }, { stage: 'CONTACTED', label: 'Contacted' },
  { stage: 'REPLIED', label: 'Replied' }, { stage: 'INTERESTED', label: 'Interested' },
  { stage: 'DEMO', label: 'Demo' }, { stage: 'TRIAL', label: 'Trial' }, { stage: 'CLIENT', label: 'Clients' },
]

export async function GET() {
  try {
    const [leads, outreaches, meetings, pitches, products, saasLeads] = await Promise.all([
      db.lead.findMany(),
      db.outreach.findMany(),
      db.meeting.findMany(),
      db.pitch.findMany(),
      db.saasProduct.findMany(),
      db.saasLead.findMany(),
    ])

    // ── Agency funnel ──
    const idx = (s: string) => STAGE_ORDER.indexOf(s)
    let prev: number | null = null
    const agencyFunnel = FUNNEL_STEPS.map((step) => {
      const count = leads.filter((l) => (l.stage === 'LOST' ? false : idx(l.stage) >= step.minIdx) || (step.stage === 'LEAD_FOUND' ? true : l.stage === 'WON')).length
      const convFromPrev = prev !== null && prev > 0 ? Math.round((count / prev) * 100) : null
      prev = count
      return { stage: step.stage, label: step.label, count, convFromPrev }
    })

    // ── Channel performance ──
    const byChannel = new Map<string, typeof outreaches>()
    outreaches.forEach((o) => {
      const arr = byChannel.get(o.channel) || []
      arr.push(o); byChannel.set(o.channel, arr)
    })
    const channels = [...byChannel.entries()].map(([channel, list]) => {
      const sent = list.length
      const replies = list.filter((o) => REPLY_STATUSES.includes(o.status)).length
      const positive = list.filter((o) => o.status === 'POSITIVE').length
      const meetingsN = list.filter((o) => o.status === 'MEETING_BOOKED').length
      return {
        channel, sent, replies, positive, meetings: meetingsN,
        conversion: sent > 0 ? Math.round((replies / sent) * 100) : 0,
      }
    }).sort((a, b) => b.sent - a.sent)

    // ── Monthly performance (last 6 months) ──
    const monthly: { month: string; label: string; leads: number; outreach: number; replies: number; meetings: number; won: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); d.setHours(0, 0, 0, 0)
      const next = new Date(d); next.setMonth(next.getMonth() + 1)
      const inM = (dt: Date | string | null) => dt && new Date(dt) >= d && new Date(dt) < next
      monthly.push({
        month: d.toISOString().slice(0, 7),
        label: d.toLocaleString('en', { month: 'short' }),
        leads: leads.filter((l) => inM(l.createdAt)).length,
        outreach: outreaches.filter((o) => inM(o.date)).length,
        replies: outreaches.filter((o) => REPLY_STATUSES.includes(o.status) && inM(o.date)).length,
        meetings: meetings.filter((m) => inM(m.dateTime)).length,
        won: leads.filter((l) => l.stage === 'WON' && inM(l.updatedAt)).length
          + pitches.filter((p) => p.status === 'WON' && inM(p.updatedAt)).length,
      })
    }

    // ── SaaS funnels ──
    const saasFunnels = products.map((p) => {
      const pls = saasLeads.filter((l) => l.productId === p.id)
      let prevN: number | null = null
      const funnel = SAAS_FUNNEL.map((step) => {
        const count = pls.filter((l) => l.funnelStage === step.stage).length
        const convFromPrev = prevN !== null && prevN > 0 ? Math.round((count / prevN) * 100) : null
        prevN = count
        return { stage: step.stage, label: step.label, count, convFromPrev }
      })
      return {
        productId: p.id, productName: p.name, funnel,
        online: pls.filter((l) => l.origin === 'ONLINE').length,
        offline: pls.filter((l) => l.origin === 'OFFLINE').length,
      }
    })

    return NextResponse.json({ agencyFunnel, channels, monthly, saasFunnels, totals: { pitches: pitches.length, meetings: meetings.length } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Analytics failed' }, { status: 500 })
  }
}
