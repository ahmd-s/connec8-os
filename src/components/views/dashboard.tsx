'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { DashboardData, AttentionItem } from '@/lib/types'
import { LEAD_STAGES, metaOf } from '@/lib/labels'
import { fmtDayLabel, fmtRelative, fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Timeline } from '@/components/shared/timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users, UserPlus, MessageSquare, CalendarDays, Send, Reply, Percent,
  AlarmClock, AlertTriangle, Trophy, XCircle, FolderKanban, Package, Briefcase,
  ArrowRight, AlertCircle, Clock, CheckCircle2, ChevronDown,
} from 'lucide-react'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'all', label: 'All Time' },
]

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  overdue_followup: AlarmClock, followup_today: AlarmClock, reply_awaiting: Reply,
  feature_blocked: AlertTriangle, deadline: FolderKanban, meeting: CalendarDays,
  client_issue: Briefcase, lead_inactive: Users,
}

const SEV: Record<string, { dot: string; chip: string; label: string }> = {
  high: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200', label: 'High' },
  medium: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Medium' },
  low: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Low' },
}

function hrefFor(item: AttentionItem): string {
  switch (item.entityType) {
    case 'lead': return `#/leads/${item.entityId}`
    case 'saas_lead': return `#/products?lead=${item.entityId}`
    case 'feature': return `#/products?feature=${item.entityId}`
    case 'project': return `#/projects/${item.entityId}`
    case 'meeting': return `#/meetings?selected=${item.entityId}`
    default: return '#/followups'
  }
}

export function DashboardView() {
  const { currentUserId } = useUi()
  const { navigate } = useHashRoute()
  const [range, setRange] = useState('30d')
  const [showAll, setShowAll] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  const qs = new URLSearchParams()
  if (range === 'custom') { if (customSince) qs.set('since', customSince); if (customUntil) qs.set('until', customUntil) }
  else qs.set('range', range)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', range, customSince, customUntil],
    queryFn: () => api.dashboard(`${qs.toString()}`),
  })

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list('users') })
  const me = users?.find((u) => u.id === currentUserId) || users?.[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const m = data?.metrics
  const attention = data?.attention || []
  const visibleAttention = showAll ? attention : attention.slice(0, 7)

  return (
    <div className="space-y-6">
      {/* header */}
      <PageHeader
        title={`${greeting}${me ? `, ${me.name}` : ''}`}
        description={`${fmtDayLabel(new Date())} — here is the state of the business and everything that needs you today.`}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  range === r.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {r.label}
              </button>
            ))}
            <Popover open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <button className={cn('px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  range === 'custom' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted')}>
                  Custom
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={customSince} onChange={(e) => setCustomSince(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} /></div>
                <Button size="sm" className="w-full" onClick={() => { setRange('custom'); setCustomOpen(false) }}>Apply range</Button>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {isLoading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── Needs attention — hero ── */}
          <Card className="border-amber-200/60 bg-gradient-to-b from-amber-50/40 to-transparent dark:from-amber-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600" />
                Needs attention
                <span className="text-xs font-normal text-muted-foreground">
                  {attention.length > 0 ? `${attention.length} thing${attention.length === 1 ? '' : 's'} shouldn't wait` : '— nothing is slipping'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {attention.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All clear"
                  description="No overdue follow-ups, no ignored replies, no blocked work. Go build something."
                  className="py-8 bg-transparent border-none"
                />
              ) : (
                <>
                  {visibleAttention.map((item, i) => {
                    const Icon = KIND_ICON[item.kind] || AlertCircle
                    const sev = SEV[item.severity]
                    return (
                      <button
                        key={`${item.kind}-${item.entityId}-${i}`}
                        onClick={() => navigate(hrefFor(item))}
                        className="w-full text-left flex gap-3 rounded-xl border bg-background p-3 hover:border-emerald-300 hover:shadow-sm transition-all group"
                      >
                        <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', sev.chip)}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{item.title}</span>
                            <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border', sev.chip)}>{sev.label}</span>
                            {item.dueDate && <span className="text-[11px] text-muted-foreground">· {fmtDateTime(item.dueDate)}</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{item.reason}</span>
                          <span className="flex items-center gap-1 mt-1.5 text-xs font-medium text-emerald-700">
                            <ArrowRight className="h-3 w-3" /> {item.suggestedAction}
                          </span>
                        </span>
                        <span className="hidden sm:flex items-center text-muted-foreground group-hover:text-emerald-600 transition-colors">
                          <ArrowRight className="h-4 w-4 rotate-90 group-hover:rotate-0" />
                        </span>
                      </button>
                    )
                  })}
                  {attention.length > 7 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAll(!showAll)}>
                      {showAll ? 'Show less' : `Show all ${attention.length} items`} <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-180')} />
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Metrics ── */}
          <div className="space-y-3">
            <MetricRow title="Pipeline">
              <StatCard label="Total Leads" value={m?.totalLeads ?? 0} icon={Users} loading={isLoading} />
              <StatCard label="New Leads" value={m?.newLeads ?? 0} icon={UserPlus} tone="accent" loading={isLoading} sub={rangeLabel(range)} />
              <StatCard label="Active Conversations" value={m?.activeConversations ?? 0} icon={MessageSquare} tone="good" loading={isLoading} />
              <StatCard label="Meetings Scheduled" value={m?.meetingsScheduled ?? 0} icon={CalendarDays} loading={isLoading} />
            </MetricRow>
            <MetricRow title="Outreach & Engagement">
              <StatCard label="Outreach Sent" value={m?.outreachSent ?? 0} icon={Send} loading={isLoading} sub={rangeLabel(range)} />
              <StatCard label="Replies Received" value={m?.repliesReceived ?? 0} icon={Reply} tone="good" loading={isLoading} />
              <StatCard label="Reply Rate" value={`${m?.replyRate ?? 0}%`} icon={Percent} tone={((m?.replyRate ?? 0) >= 30 ? 'good' : 'warn')} loading={isLoading} />
              <StatCard label="Pitches / Proposals Sent" value={m?.pitchesSent ?? 0} icon={Send} loading={isLoading} />
            </MetricRow>
            <MetricRow title="Commitments & Results">
              <StatCard label="Follow-ups Due Today" value={m?.followUpsDueToday ?? 0} icon={Clock} tone={((m?.followUpsDueToday ?? 0) > 0 ? 'warn' : 'default')} loading={isLoading} />
              <StatCard label="Overdue Follow-ups" value={m?.overdueFollowUps ?? 0} icon={AlertTriangle} tone={((m?.overdueFollowUps ?? 0) > 0 ? 'bad' : 'good')} loading={isLoading} />
              <StatCard label="Deals Won" value={m?.dealsWon ?? 0} icon={Trophy} tone="good" loading={isLoading} sub={rangeLabel(range)} />
              <StatCard label="Deals Lost" value={m?.dealsLost ?? 0} icon={XCircle} tone="bad" loading={isLoading} sub={rangeLabel(range)} />
            </MetricRow>
            <MetricRow title="Business">
              <StatCard label="Active Client Projects" value={m?.activeProjects ?? 0} icon={FolderKanban} loading={isLoading} />
              <StatCard label="Active SaaS Products" value={m?.activeSaas ?? 0} icon={Package} loading={isLoading} />
              <StatCard label="Active Clients" value={m?.activeClients ?? 0} icon={Briefcase} tone="accent" loading={isLoading} />
              <StatCard label="Total Leads" value={m?.totalLeads ?? 0} icon={Users} loading={isLoading} className="hidden md:flex" />
            </MetricRow>
          </div>

          {/* ── Bottom: today's actions, meetings, pipeline ── */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlarmClock className="h-4 w-4 text-amber-600" /> Due today & overdue</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {(data?.followUpsToday || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nothing due today. Rare and excellent.</p>
                ) : (
                  data!.followUpsToday.map((f) => {
                    const overdue = new Date(f.dueDate) < new Date()
                    const owner = f.lead?.businessName || f.saasLead?.businessName || f.client?.name || f.product?.name
                    return (
                      <button
                        key={f.id}
                        onClick={() => navigate(f.lead ? `#/leads/${f.lead.id}` : f.saasLead ? `#/products?lead=${f.saasLead.id}` : '#/followups')}
                        className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', overdue ? 'bg-rose-500' : 'bg-amber-500')} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium truncate">{f.title}</span>
                          {owner && <span className="block text-[10px] text-muted-foreground truncate">{owner} · {f.method.replaceAll('_', ' ').toLowerCase()}</span>}
                        </span>
                        <span className={cn('text-[10px] font-medium whitespace-nowrap', overdue ? 'text-rose-600' : 'text-amber-600')}>
                          {overdue ? 'Overdue' : fmtRelative(f.dueDate).replace('in ', '')}
                        </span>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-teal-600" /> Upcoming meetings</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {(data?.meetingsUpcoming || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No upcoming meetings scheduled.</p>
                ) : (
                  data!.meetingsUpcoming.map((mt) => (
                    <button
                      key={mt.id}
                      onClick={() => navigate(`#/meetings?selected=${mt.id}`)}
                      className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium truncate">{mt.title}</span>
                        <span className="block text-[10px] text-muted-foreground">{fmtDateTime(mt.dateTime)}</span>
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /> Lead pipeline</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {(data?.pipeline || []).map((p) => {
                    const meta = metaOf(LEAD_STAGES, p.stage)
                    return (
                      <button
                        key={p.stage}
                        onClick={() => navigate(`#/leads?stage=${p.stage}`)}
                        className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:shadow-sm transition-shadow', meta.color)}
                      >
                        <span className="font-semibold tabular-nums">{p.count}</span> {meta.label}
                      </button>
                    )
                  })}
                  {(data?.pipeline || []).length === 0 && <p className="text-xs text-muted-foreground py-4 text-center w-full">No leads yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* recent activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Latest activity across the business</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline activities={data?.recentActivity || []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function MetricRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

function rangeLabel(range: string): string {
  switch (range) {
    case 'today': return 'today'
    case 'week': return 'this week'
    case 'month': return 'this month'
    case '30d': return 'in last 30 days'
    case 'custom': return 'in custom range'
    default: return 'all time'
  }
}
