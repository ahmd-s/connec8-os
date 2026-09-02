'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Lead, Outreach, SaasLead } from '@/lib/types'
import { OUTREACH_CHANNELS, OUTREACH_STATUS, metaOf } from '@/lib/labels'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlarmClock, BarChart3, Globe, MapPin, Percent, Plus, Reply, Search, Send, ThumbsUp } from 'lucide-react'

const REPLY_SET = ['REPLIED', 'POSITIVE', 'NEGATIVE', 'MEETING_BOOKED']

const INTEREST: Record<string, { label: string; cls: string }> = {
  YES: { label: 'Yes', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NO: { label: 'No', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  MAYBE: { label: 'Maybe', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function relatedOf(o: Outreach): { name: string; href: string } | null {
  if (o.lead) return { name: o.lead.businessName, href: `#/leads/${o.lead.id}` }
  if (o.saasLead) return { name: o.saasLead.businessName, href: `#/products?lead=${o.saasLead.id}` }
  if (o.product) return { name: o.product.name, href: `#/products/${o.product.id}` }
  return null
}

/** Label/value row used inside the detail dialog. */
function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}

interface OutreachForm {
  channel: string
  rel: string
  message: string
  status: string
  whoMet: string
  whatWasDiscussed: string
  whatTheySaid: string
  problemsIdentified: string
  objections: string
  featuresLiked: string
  featuresRequested: string
  interest: string
  nextAction: string
}

const blankForm = (): OutreachForm => ({
  channel: 'COLD_EMAIL', rel: 'none', message: '', status: 'SENT',
  whoMet: '', whatWasDiscussed: '', whatTheySaid: '', problemsIdentified: '',
  objections: '', featuresLiked: '', featuresRequested: '', interest: '', nextAction: '',
})

export function OutreachView() {
  const { currentUserId } = useUi()
  const { navigate } = useHashRoute()
  const qc = useQueryClient()

  const [channel, setChannel] = useState('ALL')
  const [mode, setMode] = useState('ALL')
  const [search, setSearch] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [form, setForm] = useState<OutreachForm>(blankForm)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [replyStatus, setReplyStatus] = useState('SENT')
  const [replyText, setReplyText] = useState('')
  const [replyFollow, setReplyFollow] = useState(false)

  const { data: items, isLoading } = useQuery({
    queryKey: ['outreach'],
    queryFn: () => api.list<Outreach>('outreach'),
  })
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => api.list<Lead>('leads') })
  const { data: saasLeads } = useQuery({ queryKey: ['saas-leads'], queryFn: () => api.list<SaasLead>('saas-leads') })

  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; msg: string }) => api.update('outreach', v.id, v.data),
    onSuccess: (_r, v) => { toast.success(v.msg); qc.invalidateQueries(); setViewingId(null) },
    onError: (e: Error) => toast.error(e.message),
  })
  const createM = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.create('outreach', data),
    onSuccess: () => { toast.success('Outreach logged'); qc.invalidateQueries(); setLogOpen(false); setForm(blankForm()) },
    onError: (e: Error) => toast.error(e.message),
  })

  const list = items || []

  /* ── header stats (computed from the full list) ── */
  const repliesCount = list.filter((o) => REPLY_SET.includes(o.status)).length
  const replyRate = list.length ? Math.round((repliesCount / list.length) * 100) : 0
  const positiveCount = list.filter((o) => o.status === 'POSITIVE').length

  const channelCounts = useMemo(() => {
    const c: Record<string, number> = {}
    list.forEach((o) => { c[o.channel] = (c[o.channel] || 0) + 1 })
    return c
  }, [list])

  /* ── filtering ── */
  const filtered = useMemo(() => {
    let rows = list
    if (channel !== 'ALL') rows = rows.filter((o) => o.channel === channel)
    if (mode !== 'ALL') rows = rows.filter((o) => o.mode === mode)
    const needle = search.trim().toLowerCase()
    if (needle) {
      rows = rows.filter((o) =>
        (o.message || '').toLowerCase().includes(needle) ||
        (relatedOf(o)?.name || '').toLowerCase().includes(needle)
      )
    }
    return rows
  }, [list, channel, mode, search])

  /* ── channel performance (from the full list) ── */
  const channelStats = useMemo(() => (
    Object.keys(OUTREACH_CHANNELS)
      .map((ch) => {
        const rows = list.filter((o) => o.channel === ch)
        const replies = rows.filter((o) => REPLY_SET.includes(o.status)).length
        return { channel: ch, sent: rows.length, replies, rate: rows.length ? Math.round((replies / rows.length) * 100) : 0 }
      })
      .filter((s) => s.sent > 0)
      .sort((a, b) => b.sent - a.sent)
  ), [list])

  const viewing = list.find((o) => o.id === viewingId) || null

  const openDetail = (o: Outreach) => {
    setViewingId(o.id)
    setReplyStatus(o.status)
    setReplyText(o.response || '')
    setReplyFollow(o.followUpRequired)
  }

  const setF = (patch: Partial<OutreachForm>) => setForm((prev) => ({ ...prev, ...patch }))

  const submitLog = () => {
    const isVisit = form.channel === 'VISIT'
    const [relKind, relId] = form.rel.split(':')
    createM.mutate({
      channel: form.channel,
      mode: isVisit ? 'OFFLINE' : 'ONLINE',
      message: form.message || null,
      status: form.status,
      leadId: relKind === 'lead' ? relId : null,
      saasLeadId: relKind === 'saas' ? relId : null,
      userId: currentUserId ?? undefined,
      ...(isVisit ? {
        whoMet: form.whoMet || null,
        whatWasDiscussed: form.whatWasDiscussed || null,
        whatTheySaid: form.whatTheySaid || null,
        problemsIdentified: form.problemsIdentified || null,
        objections: form.objections || null,
        featuresLiked: form.featuresLiked || null,
        featuresRequested: form.featuresRequested || null,
        interest: form.interest || null,
        nextAction: form.nextAction || null,
      } : {}),
    })
  }

  const saveReply = () => {
    if (!viewing) return
    updateM.mutate({
      id: viewing.id,
      data: { status: replyStatus, response: replyText || null, followUpRequired: replyFollow },
      msg: 'Reply recorded',
    })
  }

  const modeFilters = [
    { key: 'ALL', label: 'All', icon: null },
    { key: 'ONLINE', label: 'Online', icon: Globe },
    { key: 'OFFLINE', label: 'Offline', icon: MapPin },
  ]

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <PageHeader
          title="Outreach"
          description="Every attempt to contact a potential client, across every channel."
          actions={
            <Button onClick={() => { setForm(blankForm()); setLogOpen(true) }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> Log outreach
            </Button>
          }
        />

        {/* ── stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total outreach" value={list.length} icon={Send} loading={isLoading} />
          <StatCard label="Replies" value={repliesCount} icon={Reply} tone="accent" loading={isLoading} />
          <StatCard label="Reply rate" value={`${replyRate}%`} icon={Percent} tone={replyRate >= 30 ? 'good' : 'warn'} loading={isLoading} />
          <StatCard label="Positive replies" value={positiveCount} icon={ThumbsUp} tone="good" loading={isLoading} />
        </div>

        {/* ── filters: channel pills · mode toggle · search ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setChannel('ALL')}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                channel === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              All channels <span className="text-[10px] font-semibold tabular-nums">{list.length}</span>
            </button>
            {Object.keys(OUTREACH_CHANNELS).map((ch) => {
              const count = channelCounts[ch] || 0
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    channel === ch ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {OUTREACH_CHANNELS[ch].label} <span className="text-[10px] font-semibold tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1.5 sm:ml-auto">
            {modeFilters.map((mf) => {
              const Icon = mf.icon
              return (
                <button
                  key={mf.key}
                  onClick={() => setMode(mf.key)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    mode === mf.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {Icon && <Icon className="h-3 w-3" />} {mf.label}
                </button>
              )
            })}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search message or business…"
                aria-label="Search outreach"
                className="h-8 w-full sm:w-52 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* ── list ── */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Send}
            title={list.length === 0 ? 'No outreach logged yet' : 'Nothing matches these filters'}
            description={list.length === 0
              ? 'Log your first contact attempt — cold email, WhatsApp, a physical visit — and start learning which channels work.'
              : 'Try a different channel, mode, or clear the search to see more outreach.'}
            action={list.length === 0 ? (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setForm(blankForm()); setLogOpen(true) }}>
                <Plus className="h-3.5 w-3.5" /> Log outreach
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-2 max-h-[640px] overflow-y-auto kanban-scroll pr-1">
            {filtered.map((o) => {
              const related = relatedOf(o)
              const isOnline = o.mode !== 'OFFLINE'
              return (
                <div
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Outreach detail: ${related?.name || OUTREACH_CHANNELS[o.channel]?.label || o.channel}`}
                  onClick={() => openDetail(o)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(o) } }}
                  className="rounded-xl border bg-card p-3 hover:border-emerald-200 hover:bg-muted/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge map={OUTREACH_CHANNELS} value={o.channel} size="sm" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full border', isOnline ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-orange-50 text-orange-700 border-orange-200')}>
                          {isOnline ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{isOnline ? 'Online outreach' : 'Offline visit'}</TooltipContent>
                    </Tooltip>
                    {related && (
                      <button
                        aria-label={`Go to ${related.name}`}
                        onClick={(e) => { e.stopPropagation(); navigate(related.href) }}
                        className="max-w-[220px] truncate text-xs font-medium text-muted-foreground hover:text-emerald-700 hover:underline underline-offset-2"
                      >
                        {related.name}
                      </button>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">{fmtDate(o.date)}</span>
                    <StatusBadge map={OUTREACH_STATUS} value={o.status} size="sm" />
                  </div>
                  {o.message && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{o.message}</p>}
                  {o.response && (
                    <div className="mt-1.5 border-l-2 border-emerald-400 pl-2 text-xs text-emerald-800 line-clamp-2">{o.response}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {o.followUpRequired && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                        <AlarmClock className="h-3 w-3" /> Follow-up required
                      </span>
                    )}
                    {o.user?.name && <span className="text-[11px] text-muted-foreground ml-auto">Logged by {o.user.name}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── channel performance ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-teal-600" /> Channel performance
              <span className="text-xs font-normal text-muted-foreground">which channels actually get replies</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelStats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data yet — log outreach to see per-channel performance.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Channel</TableHead>
                    <TableHead className="text-xs text-right">Sent</TableHead>
                    <TableHead className="text-xs text-right">Replies</TableHead>
                    <TableHead className="text-xs text-right">Reply %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelStats.map((s) => {
                    const meta = metaOf(OUTREACH_CHANNELS, s.channel)
                    return (
                      <TableRow key={s.channel}>
                        <TableCell className="text-sm py-2">{meta.label}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums">{s.sent}</TableCell>
                        <TableCell className="text-sm py-2 text-right tabular-nums">{s.replies}</TableCell>
                        <TableCell className="py-2 text-right">
                          <span className={cn('text-sm font-medium tabular-nums', s.rate >= 30 ? 'text-emerald-600' : s.rate > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                            {s.rate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── log outreach dialog ── */}
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log outreach</DialogTitle>
              <DialogDescription>Record the attempt — every touch teaches you which channels work.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Channel *</Label>
                  <Select value={form.channel} onValueChange={(v) => setF({ channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(OUTREACH_CHANNELS).map((k) => (
                        <SelectItem key={k} value={k}>{OUTREACH_CHANNELS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setF({ status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(OUTREACH_STATUS).map((k) => (
                        <SelectItem key={k} value={k}>{OUTREACH_STATUS[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Related lead</Label>
                <Select value={form.rel} onValueChange={(v) => setF({ rel: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {leads.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Agency leads</SelectLabel>
                        {leads.map((l) => <SelectItem key={l.id} value={`lead:${l.id}`}>{l.businessName}</SelectItem>)}
                      </SelectGroup>
                    )}
                    {saasLeads.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>SaaS leads</SelectLabel>
                        {saasLeads.map((l) => <SelectItem key={l.id} value={`saas:${l.id}`}>{l.businessName}</SelectItem>)}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message / notes</Label>
                <Textarea rows={3} value={form.message} onChange={(e) => setF({ message: e.target.value })} placeholder="What did you send or say?" />
              </div>

              {form.channel === 'VISIT' && (
                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-semibold">Visit details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Who you met</Label>
                      <Input value={form.whoMet} onChange={(e) => setF({ whoMet: e.target.value })} placeholder="Name / role" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Interest</Label>
                      <Select value={form.interest} onValueChange={(v) => setF({ interest: v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YES">Yes</SelectItem>
                          <SelectItem value="MAYBE">Maybe</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">What was discussed</Label>
                    <Textarea rows={2} value={form.whatWasDiscussed} onChange={(e) => setF({ whatWasDiscussed: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">What they said</Label>
                    <Textarea rows={2} value={form.whatTheySaid} onChange={(e) => setF({ whatTheySaid: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Problems identified</Label>
                    <Textarea rows={2} value={form.problemsIdentified} onChange={(e) => setF({ problemsIdentified: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Objections</Label>
                      <Textarea rows={2} value={form.objections} onChange={(e) => setF({ objections: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Features liked</Label>
                      <Textarea rows={2} value={form.featuresLiked} onChange={(e) => setF({ featuresLiked: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Features requested</Label>
                      <Textarea rows={2} value={form.featuresRequested} onChange={(e) => setF({ featuresRequested: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Next action</Label>
                      <Textarea rows={2} value={form.nextAction} onChange={(e) => setF({ nextAction: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createM.isPending} onClick={submitLog}>
                {createM.isPending ? 'Logging…' : 'Log outreach'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── detail dialog ── */}
        <Dialog open={!!viewing} onOpenChange={(open) => { if (!open) setViewingId(null) }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {viewing && (() => {
              const related = relatedOf(viewing)
              const offline = viewing.mode === 'OFFLINE'
              const interest = viewing.interest ? INTEREST[viewing.interest] : null
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                      {related?.name || metaOf(OUTREACH_CHANNELS, viewing.channel).label}
                      <StatusBadge map={OUTREACH_CHANNELS} value={viewing.channel} size="sm" />
                      <StatusBadge map={OUTREACH_STATUS} value={viewing.status} size="sm" />
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        {offline ? <MapPin className="h-3 w-3" /> : <Globe className="h-3 w-3" />} {offline ? 'Offline visit' : 'Online'}
                      </span>
                      <span>· {fmtDateTime(viewing.date)}</span>
                      {viewing.user?.name && <span>· logged by {viewing.user.name}</span>}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Message</p>
                      <p className="text-sm whitespace-pre-wrap">{viewing.message || '—'}</p>
                    </div>

                    {viewing.response && (
                      <div className="border-l-2 border-emerald-400 pl-3 space-y-0.5">
                        <p className="text-xs font-medium text-emerald-700">Their response</p>
                        <p className="text-sm whitespace-pre-wrap">{viewing.response}</p>
                      </div>
                    )}

                    {offline && (
                      <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                        <p className="text-xs font-semibold">Visit details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DetailField label="Who you met" value={viewing.whoMet} />
                          {viewing.interest && (
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-muted-foreground">Interest</p>
                              <span className={cn('inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', interest?.cls)}>
                                {interest?.label || viewing.interest}
                              </span>
                            </div>
                          )}
                        </div>
                        <DetailField label="What was discussed" value={viewing.whatWasDiscussed} />
                        <DetailField label="What they said" value={viewing.whatTheySaid} />
                        <DetailField label="Problems identified" value={viewing.problemsIdentified} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DetailField label="Objections" value={viewing.objections} />
                          <DetailField label="Features liked" value={viewing.featuresLiked} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <DetailField label="Features requested" value={viewing.featuresRequested} />
                          <DetailField label="Next action" value={viewing.nextAction} />
                        </div>
                        <DetailField label="Outcome" value={viewing.outcome} />
                      </div>
                    )}

                    {related && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setViewingId(null); navigate(related.href) }}
                      >
                        Open {related.name}
                      </Button>
                    )}

                    {/* record a reply */}
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-xs font-semibold">Record a reply</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Status</Label>
                          <Select value={replyStatus} onValueChange={setReplyStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.keys(OUTREACH_STATUS).map((k) => (
                                <SelectItem key={k} value={k}>{OUTREACH_STATUS[k].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <Switch id="fu-required" checked={replyFollow} onCheckedChange={setReplyFollow} />
                          <Label htmlFor="fu-required" className="text-xs cursor-pointer">Follow-up required</Label>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Response</Label>
                        <Textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="What did they reply?" />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setViewingId(null)}>Close</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={updateM.isPending} onClick={saveReply}>
                      {updateM.isPending ? 'Saving…' : 'Save response'}
                    </Button>
                  </DialogFooter>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
