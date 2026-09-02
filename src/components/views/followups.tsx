'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { FollowUp, Lead, SaasLead } from '@/lib/types'
import { FOLLOWUP_STATUS, METHODS } from '@/lib/labels'
import { fmtDateTime, fmtRelative, isOverdue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlarmClock, Ban, CalendarClock, Check, CheckCircle2, Clock, Pencil, Plus } from 'lucide-react'

/* ── derived status helpers (per contract) ── */

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function deriveStatus(f: FollowUp): string {
  if (f.status !== 'UPCOMING') return f.status
  if (isOverdue(f.dueDate)) return 'OVERDUE'
  if (isSameDay(new Date(f.dueDate), new Date())) return 'DUE_TODAY'
  return 'UPCOMING'
}

const STATUS_ORDER: Record<string, number> = { OVERDUE: 0, DUE_TODAY: 1, UPCOMING: 2, COMPLETED: 3, CANCELLED: 4 }
const DOT: Record<string, string> = {
  OVERDUE: 'bg-rose-500',
  DUE_TODAY: 'bg-amber-500',
  UPCOMING: 'bg-sky-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-zinc-400',
}

/** ISO string → value for <input type="datetime-local"> */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function relatedOf(f: FollowUp): { name: string; href: string } | null {
  if (f.lead) return { name: f.lead.businessName, href: `#/leads/${f.lead.id}` }
  if (f.saasLead) return { name: f.saasLead.businessName, href: `#/products?lead=${f.saasLead.id}` }
  if (f.client) return { name: f.client.name, href: '#/clients' }
  if (f.product) return { name: f.product.name, href: `#/products/${f.product.id}` }
  return null
}

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  OVERDUE: { title: 'Nothing overdue', description: 'You are completely on top of everything. Keep this streak going.' },
  DUE_TODAY: { title: 'Inbox zero for follow-ups', description: 'Nothing due today. Rare and excellent — enjoy the calm.' },
  UPCOMING: { title: 'No upcoming follow-ups', description: 'Plan the next touch-point with a lead before the trail goes cold.' },
  COMPLETED: { title: 'Nothing completed yet', description: 'Check one off and feel the momentum build.' },
  ALL: { title: 'No follow-ups yet', description: 'Create the first one so no conversation ever slips through the cracks.' },
}

interface FollowUpForm {
  title: string
  dueDate: string
  method: string
  status: string
  reason: string
  context: string
  suggestedNextAction: string
  rel: string // 'none' | 'lead:<id>' | 'saas:<id>'
}

const blankForm = (): FollowUpForm => ({
  title: '', dueDate: '', method: 'EMAIL', status: 'UPCOMING',
  reason: '', context: '', suggestedNextAction: '', rel: 'none',
})

function formFrom(f: FollowUp): FollowUpForm {
  return {
    title: f.title,
    dueDate: toLocalInput(f.dueDate),
    method: f.method || 'EMAIL',
    status: f.status,
    reason: f.reason || '',
    context: f.context || '',
    suggestedNextAction: f.suggestedNextAction || '',
    rel: f.leadId ? `lead:${f.leadId}` : f.saasLeadId ? `saas:${f.saasLeadId}` : 'none',
  }
}

export function FollowUpsView({ query }: { query?: string }) {
  const { currentUserId } = useUi()
  const { navigate, query: hashQuery } = useHashRoute()
  const qc = useQueryClient()

  const [tab, setTab] = useState('OVERDUE')
  const [manualId, setManualId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['followups'],
    queryFn: () => api.list<FollowUp>('followups'),
  })
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => api.list<Lead>('leads') })
  const { data: saasLeads } = useQuery({ queryKey: ['saas-leads'], queryFn: () => api.list<SaasLead>('saas-leads') })

  const list = useMemo(() => followUps || [], [followUps])

  /* hash query ?selected=<id> → open that follow-up's dialog on load (derived, no effect) */
  const selectedId = (query ? new URLSearchParams(query) : hashQuery).get('selected')
  const selectedFollowUp = useMemo(
    () => (selectedId ? list.find((f) => f.id === selectedId) ?? null : null),
    [list, selectedId]
  )
  const manualFollowUp = useMemo(
    () => (manualId ? list.find((f) => f.id === manualId) ?? null : null),
    [list, manualId]
  )
  const editTarget = manualFollowUp ?? selectedFollowUp

  const closeDialogs = () => {
    setManualId(null)
    setCreateOpen(false)
    if (selectedId) navigate('#/followups')
  }

  /* ── mutations ── */
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; msg: string }) => api.update('followups', v.id, v.data),
    onSuccess: (_r, v) => { toast.success(v.msg); qc.invalidateQueries(); closeDialogs() },
    onError: (e: Error) => toast.error(e.message),
  })
  const createM = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.create('followups', data),
    onSuccess: () => { toast.success('Follow-up created'); qc.invalidateQueries(); closeDialogs() },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── derived data ── */
  const withStatus = useMemo(() => list.map((f) => ({ f, status: deriveStatus(f) })), [list])
  const counts = useMemo(() => {
    const c: Record<string, number> = { OVERDUE: 0, DUE_TODAY: 0, UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 }
    withStatus.forEach(({ status }) => { c[status] = (c[status] || 0) + 1 })
    return c
  }, [withStatus])

  const completedThisWeek = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000
    return list.filter((f) => f.status === 'COMPLETED' && f.completedAt && new Date(f.completedAt).getTime() >= since).length
  }, [list])

  const rows = useMemo(() => {
    const filteredList = tab === 'ALL' ? withStatus : withStatus.filter(({ status }) => status === tab)
    return [...filteredList].sort((a, b) => {
      const po = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      if (po !== 0) return po
      return new Date(a.f.dueDate).getTime() - new Date(b.f.dueDate).getTime()
    })
  }, [withStatus, tab])

  const handleDialogSubmit = (data: Record<string, unknown>) => {
    if (editTarget) updateM.mutate({ id: editTarget.id, data, msg: 'Follow-up updated' })
    else createM.mutate({ ...data, createdById: currentUserId ?? undefined })
  }

  const tabs = [
    { key: 'OVERDUE', label: 'Overdue', dot: 'bg-rose-500' },
    { key: 'DUE_TODAY', label: 'Due Today', dot: 'bg-amber-500' },
    { key: 'UPCOMING', label: 'Upcoming', dot: 'bg-sky-500' },
    { key: 'COMPLETED', label: 'Completed', dot: 'bg-emerald-500' },
    { key: 'ALL', label: 'All', dot: 'bg-zinc-400' },
  ]

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <PageHeader
          title="Follow-ups"
          description="Everything that requires action — nothing slips."
          actions={
            <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> New follow-up
            </Button>
          }
        />

        {/* ── stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Overdue" value={counts.OVERDUE} icon={AlarmClock} tone={counts.OVERDUE > 0 ? 'bad' : 'good'} loading={isLoading} sub={counts.OVERDUE > 0 ? 'need attention now' : 'all caught up'} />
          <StatCard label="Due today" value={counts.DUE_TODAY} icon={Clock} tone="warn" loading={isLoading} sub="before the day ends" />
          <StatCard label="Completed this week" value={completedThisWeek} icon={CheckCircle2} tone="good" loading={isLoading} sub="last 7 days" />
        </div>

        {/* ── scope tabs ── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => {
            const active = tab === t.key
            const count = t.key === 'ALL' ? withStatus.length : counts[t.key]
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
                {t.label}
                <span className={cn(
                  'text-[10px] font-semibold rounded-full px-1.5 tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                  t.key === 'OVERDUE' && !active && count > 0 && 'bg-rose-100 text-rose-700',
                  t.key === 'DUE_TODAY' && !active && count > 0 && 'bg-amber-100 text-amber-700'
                )}>
                  {count ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── list ── */}
        <Card>
          {isLoading ? (
            <CardContent className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </CardContent>
          ) : rows.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={tab === 'COMPLETED' || tab === 'OVERDUE' ? CheckCircle2 : AlarmClock}
                title={EMPTY_COPY[tab]?.title || 'No follow-ups'}
                description={EMPTY_COPY[tab]?.description}
                action={
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New follow-up
                  </Button>
                }
              />
            </CardContent>
          ) : (
            <CardContent className="space-y-1.5 max-h-[640px] overflow-y-auto kanban-scroll">
              {rows.map(({ f, status }) => {
                const related = relatedOf(f)
                const isActive = status === 'OVERDUE' || status === 'DUE_TODAY' || status === 'UPCOMING'
                const dueCls = status === 'OVERDUE' ? 'text-rose-600' : status === 'DUE_TODAY' ? 'text-amber-600' : 'text-muted-foreground'
                return (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open follow-up: ${f.title}`}
                    onClick={() => setManualId(f.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setManualId(f.id) } }}
                    className="group w-full text-left flex items-start gap-2.5 rounded-lg border px-2.5 py-2 hover:bg-muted/50 hover:border-emerald-200 transition-colors cursor-pointer"
                  >
                    <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', DOT[status])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn('text-sm font-medium', status === 'COMPLETED' && 'text-muted-foreground line-through decoration-border')}>{f.title}</span>
                        <StatusBadge map={METHODS} value={f.method} size="sm" />
                        {related && (
                          <button
                            aria-label={`Go to ${related.name}`}
                            onClick={(e) => { e.stopPropagation(); navigate(related.href) }}
                            className="max-w-[220px] truncate text-xs text-muted-foreground hover:text-emerald-700 hover:underline underline-offset-2"
                          >
                            {related.name}
                          </button>
                        )}
                      </div>
                      {(f.reason || f.context) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.reason || f.context}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                        <span className={cn('font-medium', dueCls)}>{fmtDateTime(f.dueDate)}</span>
                        <span className="text-muted-foreground">· {fmtRelative(f.dueDate)}</span>
                        {status === 'COMPLETED' && f.completedAt && (
                          <span className="text-emerald-600">· completed {fmtRelative(f.completedAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isActive && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" aria-label="Mark completed"
                              className="h-7 w-7 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                              disabled={updateM.isPending}
                              onClick={() => updateM.mutate({ id: f.id, data: { status: 'COMPLETED' }, msg: 'Follow-up completed' })}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Complete</TooltipContent>
                        </Tooltip>
                      )}
                      {isActive && (
                        <ReschedulePopover
                          initial={toLocalInput(f.dueDate)}
                          pending={updateM.isPending}
                          onSave={(value) => updateM.mutate({ id: f.id, data: { dueDate: value }, msg: 'Follow-up rescheduled' })}
                        />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Edit follow-up" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setManualId(f.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      {isActive && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon" aria-label="Cancel follow-up"
                              className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                              disabled={updateM.isPending}
                              onClick={() => updateM.mutate({ id: f.id, data: { status: 'CANCELLED' }, msg: 'Follow-up cancelled' })}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cancel</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          )}
        </Card>

        {/* ── create / edit dialog (keyed → fresh form state per target) ── */}
        {(createOpen || editTarget) && (
          <FollowUpDialog
            key={editTarget?.id ?? 'create'}
            followUp={editTarget}
            leads={leads || []}
            saasLeads={saasLeads || []}
            saving={createM.isPending || updateM.isPending}
            onClose={closeDialogs}
            onSubmit={handleDialogSubmit}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

/* ── reschedule popover (row action) ── */
function ReschedulePopover({ initial, onSave, pending }: { initial: string; onSave: (value: string) => void; pending: boolean }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial)
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(initial) }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Reschedule follow-up" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Reschedule</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">New date &amp; time</Label>
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button size="sm" className="w-full" disabled={!value || pending} onClick={() => { onSave(value); setOpen(false) }}>
          {pending ? 'Saving…' : 'Save new date'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/* ── create / edit dialog ── */
function FollowUpDialog({
  followUp, leads, saasLeads, saving, onClose, onSubmit,
}: {
  followUp: FollowUp | null // null → create mode
  leads: Lead[]
  saasLeads: SaasLead[]
  saving: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
}) {
  const isEdit = !!followUp
  const [form, setForm] = useState<FollowUpForm>(() => (
    followUp ? formFrom(followUp) : { ...blankForm(), dueDate: toLocalInput(new Date().toISOString()) }
  ))
  const setF = (patch: Partial<FollowUpForm>) => setForm((prev) => ({ ...prev, ...patch }))

  const submit = () => {
    if (!form.title.trim() || !form.dueDate) { toast.error('Title and due date are required'); return }
    const [relKind, relId] = form.rel.split(':')
    onSubmit({
      title: form.title.trim(),
      dueDate: form.dueDate,
      method: form.method,
      status: form.status,
      reason: form.reason || null,
      context: form.context || null,
      suggestedNextAction: form.suggestedNextAction || null,
      leadId: relKind === 'lead' ? relId : null,
      saasLeadId: relKind === 'saas' ? relId : null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit follow-up' : 'New follow-up'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update details, reschedule, or close this out.' : 'Schedule the next touch-point so no conversation goes cold.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setF({ title: e.target.value })} placeholder="e.g. Send proposal recap to Bloom Cafe" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due *</Label>
              <Input type="datetime-local" value={form.dueDate} onChange={(e) => setF({ dueDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={form.method} onValueChange={(v) => setF({ method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(METHODS).map((k) => <SelectItem key={k} value={k}>{METHODS[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setF({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['UPCOMING', 'COMPLETED', 'CANCELLED'].map((k) => (
                    <SelectItem key={k} value={k}>{FOLLOWUP_STATUS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <RelatedSelect value={form.rel} onChange={(rel) => setF({ rel })} leads={leads} saasLeads={saasLeads} />
          <div className="space-y-1.5">
            <Label className="text-xs">Reason</Label>
            <Input value={form.reason} onChange={(e) => setF({ reason: e.target.value })} placeholder="Why this follow-up exists" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Context</Label>
            <Textarea rows={2} value={form.context} onChange={(e) => setF({ context: e.target.value })} placeholder="What was said / where things stand" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Suggested next action</Label>
            <Input value={form.suggestedNextAction} onChange={(e) => setF({ suggestedNextAction: e.target.value })} placeholder="What to do when it's time" />
          </div>
          {isEdit && followUp && (
            <p className="text-[11px] text-muted-foreground">Created {fmtRelative(followUp.createdAt)}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── grouped related-to select (None / Agency leads / SaaS leads) ── */
function RelatedSelect({
  value, onChange, leads, saasLeads,
}: {
  value: string
  onChange: (v: string) => void
  leads: Lead[]
  saasLeads: SaasLead[]
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Related to</Label>
      <Select value={value} onValueChange={onChange}>
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
  )
}
