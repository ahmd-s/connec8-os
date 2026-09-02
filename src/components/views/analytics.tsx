'use client'

/**
 * Analytics module — the growth diagnostics page. Agency sales funnel with
 * weakest-step insight, channel performance table, monthly grouped bar chart
 * (pure CSS) and per-SaaS funnels with Online/Offline split + bottleneck.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { AnalyticsData, ChannelStat, FunnelStep, MonthlyPoint } from '@/lib/types'
import { OUTREACH_CHANNELS, metaOf } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { FunnelBars } from '@/components/shared/funnel-bars'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, BarChart3, Globe, MapPin, TrendingDown } from 'lucide-react'

// ── helpers ──

/** Step with the lowest non-null convFromPrev → the weakest transition. */
function weakestStep(steps: FunnelStep[]): FunnelStep | null {
  const withConv = steps.filter((s) => s.convFromPrev !== null)
  if (withConv.length === 0) return null
  return withConv.reduce((min, s) => ((s.convFromPrev as number) < (min.convFromPrev as number) ? s : min))
}

function transitionLabel(steps: FunnelStep[], step: FunnelStep): string {
  const idx = steps.findIndex((s) => s.stage === step.stage)
  const prev = idx > 0 ? steps[idx - 1] : null
  return prev ? `${prev.label} → ${step.label}` : step.label
}

const convTone = (pct: number) =>
  pct >= 40 ? 'text-emerald-600 font-semibold' : pct >= 20 ? 'text-amber-600 font-semibold' : 'text-rose-500 font-medium'

// ── monthly chart series (zinc/sky/emerald/violet/amber — no blue/indigo) ──

type NumericKey = 'leads' | 'outreach' | 'replies' | 'meetings' | 'won'
const SERIES: { key: NumericKey; label: string; color: string }[] = [
  { key: 'leads', label: 'Leads', color: 'bg-zinc-400' },
  { key: 'outreach', label: 'Outreach', color: 'bg-sky-500' },
  { key: 'replies', label: 'Replies', color: 'bg-emerald-500' },
  { key: 'meetings', label: 'Meetings', color: 'bg-violet-500' },
  { key: 'won', label: 'Won', color: 'bg-amber-500' },
]

// ── view ──

export function AnalyticsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.analytics(),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Funnels, channel performance and bottlenecks — where growth breaks down."
      />

      {isLoading && !data ? (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : !data ? (
        <EmptyState icon={BarChart3} title="Analytics unavailable" description="Could not load analytics data. Try refreshing." />
      ) : (
        <AnalyticsBody data={data} />
      )}
    </div>
  )
}

function AnalyticsBody({ data }: { data: AnalyticsData }) {
  const weakest = weakestStep(data.agencyFunnel)

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* agency sales funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Agency sales funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBars steps={data.agencyFunnel} />
            {weakest && weakest.convFromPrev !== null && (
              <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Weakest step: <span className="font-medium text-foreground">{transitionLabel(data.agencyFunnel, weakest)}</span>{' '}
                  ({weakest.convFromPrev}%). This is where most prospects drop off — fix it first.
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* channel performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Channel performance</CardTitle>
          </CardHeader>
          <CardContent>
            {data.channels.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No outreach logged yet"
                description="Channel stats appear once outreach is recorded."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Channel</TableHead>
                      <TableHead className="text-xs text-right">Sent</TableHead>
                      <TableHead className="text-xs text-right">Replies</TableHead>
                      <TableHead className="text-xs text-right">Positive</TableHead>
                      <TableHead className="text-xs text-right">Meetings</TableHead>
                      <TableHead className="text-xs text-right">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.channels.map((c: ChannelStat) => (
                      <TableRow key={c.channel}>
                        <TableCell className="text-xs font-medium">{metaOf(OUTREACH_CHANNELS, c.channel).label}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{c.sent}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{c.replies}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{c.positive}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{c.meetings}</TableCell>
                        <TableCell className={cn('text-xs text-right tabular-nums', convTone(c.conversion))}>
                          {c.conversion}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* monthly performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Monthly performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data.monthly.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No monthly data yet.</p>
          ) : (
            <>
              <div className="flex items-end gap-2 sm:gap-4">
                {data.monthly.map((p: MonthlyPoint) => (
                  <MonthColumn key={p.month} point={p} globalMax={monthMax(data.monthly)} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {SERIES.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-2.5 w-2.5 rounded-sm', s.color)} aria-hidden />
                    {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* SaaS funnels */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">SaaS funnels</p>
        {data.saasFunnels.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No SaaS funnels yet"
            description="Funnels appear once a product has leads in its pipeline."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {data.saasFunnels.map((f) => {
              const bottleneck = weakestStep(f.funnel)
              const total = f.online + f.offline
              return (
                <Card key={f.productId}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{f.productName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FunnelBars steps={f.funnel} barTone="bg-teal-600" />

                    {/* online vs offline split */}
                    <div className="space-y-1.5">
                      <SplitBar label="Online" icon={<Globe className="h-3 w-3" />} value={f.online} total={total} tone="bg-teal-600" />
                      <SplitBar label="Offline" icon={<MapPin className="h-3 w-3" />} value={f.offline} total={total} tone="bg-orange-500" />
                    </div>

                    {bottleneck && bottleneck.convFromPrev !== null && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span>
                          Bottleneck: <span className="font-medium text-foreground">{transitionLabel(f.funnel, bottleneck)}</span>{' '}
                          ({bottleneck.convFromPrev}%)
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ── one month column: five thin vertical bars, height % of the global max ──

function monthMax(monthly: MonthlyPoint[]): number {
  return Math.max(1, ...monthly.flatMap((p) => SERIES.map((s) => p[s.key])))
}

function MonthColumn({ point, globalMax }: { point: MonthlyPoint; globalMax: number }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
      <div className="flex items-end justify-center gap-[3px] h-44" role="img" aria-label={`${point.label}: ${SERIES.map((s) => `${s.label} ${point[s.key]}`).join(', ')}`}>
        {SERIES.map((s) => {
          const v = point[s.key]
          return (
            <div
              key={s.key}
              title={`${point.label} — ${s.label}: ${v}`}
              className={cn('w-1.5 sm:w-2 rounded-t-sm transition-all hover:opacity-75', s.color, v === 0 && 'opacity-30')}
              style={{ height: `${Math.max((v / globalMax) * 100, v > 0 ? 4 : 2)}%` }}
            />
          )
        })}
      </div>
      <span className="text-[10px] text-muted-foreground truncate max-w-full">{point.label}</span>
    </div>
  )
}

// ── online/offline mini horizontal bar ──

function SplitBar({
  label, icon, value, total, tone,
}: {
  label: string
  icon: React.ReactNode
  value: number
  total: number
  tone: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 w-16 shrink-0 text-[11px] text-muted-foreground">
        {icon} {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}
