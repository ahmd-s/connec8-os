'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Lead, Pitch, SaasLead } from '@/lib/types'
import { PITCH_STATUS, PITCH_TYPES } from '@/lib/labels'
import { avatarColor, fmtDate, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ExternalLink, FileText, Pencil, Plus, Presentation, Rocket, Trophy, XCircle } from 'lucide-react'

const IN_PLAY = ['SENT', 'VIEWED', 'DISCUSSING']

function relatedOf(p: Pitch): { name: string; href: string } | null {
  if (p.lead) return { name: p.lead.businessName, href: `#/leads/${p.lead.id}` }
  if (p.saasLead) return { name: p.saasLead.businessName, href: `#/products?lead=${p.saasLead.id}` }
  if (p.product) return { name: p.product.name, href: `#/products/${p.product.id}` }
  return null
}

interface PitchForm {
  title: string
  type: string
  status: string
  link: string
  notes: string
  rel: string // 'none' | 'lead:<id>' | 'saas:<id>'
}

const blankForm = (): PitchForm => ({ title: '', type: 'WEBSITE_CONCEPT', status: 'DRAFT', link: '', notes: '', rel: 'none' })

function formFrom(p: Pitch): PitchForm {
  return {
    title: p.title,
    type: p.type || 'WEBSITE_CONCEPT',
    status: p.status || 'DRAFT',
    link: p.link || '',
    notes: p.notes || '',
    rel: p.leadId ? `lead:${p.leadId}` : p.saasLeadId ? `saas:${p.saasLeadId}` : 'none',
  }
}

export function PitchesView({ query }: { query?: string }) {
  const { currentUserId } = useUi()
  const { navigate, query: hashQuery } = useHashRoute()
  const qc = useQueryClient()

  const [status, setStatus] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [manualId, setManualId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: pitches, isLoading } = useQuery({
    queryKey: ['pitches'],
    queryFn: () => api.list<Pitch>('pitches'),
  })
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => api.list<Lead>('leads') })
  const { data: saasLeads } = useQuery({ queryKey: ['saas-leads'], queryFn: () => api.list<SaasLead>('saas-leads') })

  const list = useMemo(() => pitches || [], [pitches])

  /* hash query ?selected=<id> → open that pitch's edit dialog on load (derived, no effect) */
  const selectedId = (query ? new URLSearchParams(query) : hashQuery).get('selected')
  const selectedPitch = useMemo(
    () => (selectedId ? list.find((p) => p.id === selectedId) ?? null : null),
    [list, selectedId]
  )
  const manualPitch = useMemo(
    () => (manualId ? list.find((p) => p.id === manualId) ?? null : null),
    [list, manualId]
  )
  const editTarget = manualPitch ?? selectedPitch

  const closeDialogs = () => {
    setManualId(null)
    setCreateOpen(false)
    if (selectedId) navigate('#/pitches')
  }

  const createM = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.create('pitches', data),
    onSuccess: () => { toast.success('Pitch created'); qc.invalidateQueries(); closeDialogs() },
    onError: (e: Error) => toast.error(e.message),
  })
  const updateM = useMutation({
    mutationFn: (v: { id: string; data: Record<string, unknown>; msg: string }) => api.update('pitches', v.id, v.data),
    onSuccess: (_r, v) => { toast.success(v.msg); qc.invalidateQueries(); closeDialogs() },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── stats ── */
  const inPlay = list.filter((p) => IN_PLAY.includes(p.status)).length
  const won = list.filter((p) => p.status === 'WON').length
  const lost = list.filter((p) => p.status === 'LOST').length

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    list.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1 })
    return c
  }, [list])

  /* ── filtering ── */
  const filtered = useMemo(() => {
    let rows = list
    if (status !== 'ALL') rows = rows.filter((p) => p.status === status)
    if (type !== 'ALL') rows = rows.filter((p) => p.type === type)
    return rows
  }, [list, status, type])

  const handleDialogSubmit = (data: Record<string, unknown>) => {
    if (editTarget) updateM.mutate({ id: editTarget.id, data, msg: 'Pitch updated' })
    else createM.mutate({ ...data, creatorId: currentUserId ?? undefined })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pitches"
        description="Personalised concepts and proposals, connected to their leads."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> New pitch
          </Button>
        }
      />

      {/* ── stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total pitches" value={list.length} icon={Presentation} loading={isLoading} />
        <StatCard label="In play" value={inPlay} icon={Rocket} tone="accent" loading={isLoading} sub="sent · viewed · discussing" />
        <StatCard label="Won" value={won} icon={Trophy} tone="good" loading={isLoading} />
        <StatCard label="Lost" value={lost} icon={XCircle} tone="bad" loading={isLoading} />
      </div>

      {/* ── filters: status pills + type select ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatus('ALL')}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
              status === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            All <span className="text-[10px] font-semibold tabular-nums">{list.length}</span>
          </button>
          {Object.keys(PITCH_STATUS).map((k) => {
            const count = statusCounts[k] || 0
            return (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
                  status === k ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {PITCH_STATUS[k].label} <span className="text-[10px] font-semibold tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-44 text-xs sm:ml-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.keys(PITCH_TYPES).map((k) => (
              <SelectItem key={k} value={k}>{PITCH_TYPES[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── grid ── */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={list.length === 0 ? FileText : Presentation}
          title={list.length === 0 ? 'No pitches yet' : 'Nothing matches these filters'}
          description={list.length === 0
            ? 'Create your first website concept or proposal — every pitch is one step closer to a signed deal.'
            : 'Try a different status or type to see more pitches.'}
          action={list.length === 0 ? (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New pitch
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const related = relatedOf(p)
            const creatorName = p.creator?.name
            return (
              <Card
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`Open pitch: ${p.title}`}
                onClick={() => setManualId(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setManualId(p.id) } }}
                className="p-4 flex flex-col gap-2.5 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium leading-snug min-w-0">{p.title}</h3>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open pitch link"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border text-muted-foreground hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge map={PITCH_TYPES} value={p.type} size="sm" />
                  <StatusBadge map={PITCH_STATUS} value={p.status} size="sm" />
                </div>
                {p.notes && <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>}
                {related && (
                  <button
                    aria-label={`Go to ${related.name}`}
                    onClick={(e) => { e.stopPropagation(); navigate(related.href) }}
                    className="w-fit max-w-full truncate text-xs font-medium text-emerald-700 hover:underline underline-offset-2"
                  >
                    {related.name}
                  </button>
                )}
                <div className="mt-auto pt-2.5 border-t flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {creatorName ? (
                      <>
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] text-white" style={{ background: avatarColor(creatorName) }}>
                            {initials(creatorName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {creatorName} · {fmtDate(p.date)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{fmtDate(p.date)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Edit pitch" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setManualId(p.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Select value={p.status} onValueChange={(v) => updateM.mutate({ id: p.id, data: { status: v }, msg: 'Pitch status updated' })}>
                      <SelectTrigger className="h-7 w-[112px] text-xs px-2" aria-label={`Change status of ${p.title}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(PITCH_STATUS).map((k) => (
                          <SelectItem key={k} value={k}>{PITCH_STATUS[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── create / edit dialog (keyed → fresh form state per target) ── */}
      {(createOpen || editTarget) && (
        <PitchDialog
          key={editTarget?.id ?? 'create'}
          pitch={editTarget}
          leads={leads || []}
          saasLeads={saasLeads || []}
          saving={createM.isPending || updateM.isPending}
          onClose={closeDialogs}
          onSubmit={handleDialogSubmit}
        />
      )}
    </div>
  )
}

/* ── create / edit dialog ── */
function PitchDialog({
  pitch, leads, saasLeads, saving, onClose, onSubmit,
}: {
  pitch: Pitch | null // null → create mode
  leads: Lead[]
  saasLeads: SaasLead[]
  saving: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
}) {
  const isEdit = !!pitch
  const [form, setForm] = useState<PitchForm>(() => (pitch ? formFrom(pitch) : blankForm()))
  const setF = (patch: Partial<PitchForm>) => setForm((prev) => ({ ...prev, ...patch }))

  const submit = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    const [relKind, relId] = form.rel.split(':')
    onSubmit({
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      link: form.link || null,
      notes: form.notes || null,
      leadId: relKind === 'lead' ? relId : null,
      saasLeadId: relKind === 'saas' ? relId : null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit pitch' : 'New pitch'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the concept, link, or move it along the pipeline.' : 'A personalised concept or proposal, tied to a lead.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setF({ title: e.target.value })} placeholder="e.g. Bloom Cafe — website concept" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setF({ type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PITCH_TYPES).map((k) => (
                    <SelectItem key={k} value={k}>{PITCH_TYPES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setF({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PITCH_STATUS).map((k) => (
                      <SelectItem key={k} value={k}>{PITCH_STATUS[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link</Label>
            <Input value={form.link} onChange={(e) => setF({ link: e.target.value })} placeholder="https://… (deck, concept, proposal)" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setF({ notes: e.target.value })} placeholder="Angle, pricing, what to emphasise…" />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create pitch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
