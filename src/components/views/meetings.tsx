'use client'

/**
 * Meetings module — Upcoming/Past/All tabs, detail dialog with decisions &
 * actionable items checklist, action-item → follow-up/task conversion, and a
 * rich "Log meeting" dialog.
 *
 * Deep-linking: `#/meetings?selected=<id>` opens the detail dialog. The
 * selection is DERIVED from the hash query every render (URL-as-source-of-
 * truth, no setState-in-effect). Closing the dialog navigates back to
 * `#/meetings`, which clears the param.
 */

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Meeting } from '@/lib/types'
import { parseJsonArray, parseJsonObjects } from '@/lib/labels'
import { fmtDate, fmtDateTime, fmtDayLabel, fmtRelative, initials, avatarColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  ArrowRight, Building2, CalendarDays, CalendarPlus, ChevronRight, ClipboardList,
  Clock, Gavel, Globe, ListChecks, Loader2, Package, SquarePen, StickyNote, Users,
} from 'lucide-react'

// ── payload shims (list include shape) ──
interface PickLead { id: string; businessName: string }
interface PickClient { id: string; name: string }
interface PickProject { id: string; name: string }
interface PickProduct { id: string; name: string }
type MeetingRow = Meeting

interface ActionItem { text: string; done?: boolean }
type RelatedKind = 'leadId' | 'saasLeadId' | 'clientId' | 'productId' | 'projectId'
type RelatedMap = Partial<Record<RelatedKind, string>>

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
] as const
type TabKey = (typeof TABS)[number]['key']

// ── helpers ──

function toLocalInput(d?: string | Date | null): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function defaultDateTimeLocal(): string {
  const dt = new Date(Date.now() + 60 * 60 * 1000)
  dt.setMinutes(0, 0, 0)
  return toLocalInput(dt)
}

function relatedValueOf(m: Meeting): string {
  if (m.leadId) return `lead:${m.leadId}`
  if (m.saasLeadId) return `saas:${m.saasLeadId}`
  if (m.clientId) return `client:${m.clientId}`
  if (m.productId) return `product:${m.productId}`
  if (m.projectId) return `project:${m.projectId}`
  return 'none'
}

function parseRelatedValue(v: string): RelatedMap {
  const [kind, id] = v.split(':')
  if (!id) return {}
  switch (kind) {
    case 'lead': return { leadId: id }
    case 'saas': return { saasLeadId: id }
    case 'client': return { clientId: id }
    case 'product': return { productId: id }
    case 'project': return { projectId: id }
    default: return {}
  }
}

function relatedChip(m: Meeting): { label: string; name: string; href: string } | null {
  if (m.lead) return { label: 'Lead', name: m.lead.businessName, href: `#/leads/${m.lead.id}` }
  if (m.saasLead) return { label: 'SaaS lead', name: m.saasLead.businessName, href: `#/products?lead=${m.saasLead.id}` }
  if (m.client) return { label: 'Client', name: m.client.name, href: `#/clients?selected=${m.client.id}` }
  if (m.product) return { label: 'Product', name: m.product.name, href: `#/products/${m.product.id}` }
  if (m.project) return { label: 'Project', name: m.project.name, href: `#/projects/${m.project.id}` }
  return null
}

// ── grouped related-entity select (shared by Log + Edit) ──

function RelatedSelect({
  value, onChange, leads, clients, saasLeads, projects, products, includeProducts, id,
}: {
  value: string
  onChange: (v: string) => void
  leads?: PickLead[]
  clients?: PickClient[]
  saasLeads?: (PickLead & { productId?: string })[]
  projects?: PickProject[]
  products?: PickProduct[]
  includeProducts?: boolean
  id?: string
}) {
  return (
    <Select value={value || 'none'} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Related to…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {(leads?.length ?? 0) > 0 && (
          <SelectGroup>
            <SelectLabel>Agency leads</SelectLabel>
            {leads!.map((l) => <SelectItem key={l.id} value={`lead:${l.id}`}>{l.businessName}</SelectItem>)}
          </SelectGroup>
        )}
        {(clients?.length ?? 0) > 0 && (
          <SelectGroup>
            <SelectLabel>Clients</SelectLabel>
            {clients!.map((c) => <SelectItem key={c.id} value={`client:${c.id}`}>{c.name}</SelectItem>)}
          </SelectGroup>
        )}
        {(saasLeads?.length ?? 0) > 0 && (
          <SelectGroup>
            <SelectLabel>SaaS leads</SelectLabel>
            {saasLeads!.map((s) => <SelectItem key={s.id} value={`saas:${s.id}`}>{s.businessName}</SelectItem>)}
          </SelectGroup>
        )}
        {includeProducts && (products?.length ?? 0) > 0 && (
          <SelectGroup>
            <SelectLabel>Products</SelectLabel>
            {products!.map((p) => <SelectItem key={p.id} value={`product:${p.id}`}>{p.name}</SelectItem>)}
          </SelectGroup>
        )}
        {(projects?.length ?? 0) > 0 && (
          <SelectGroup>
            <SelectLabel>Projects</SelectLabel>
            {projects!.map((p) => <SelectItem key={p.id} value={`project:${p.id}`}>{p.name}</SelectItem>)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}

// ── main view ──

export function MeetingsView({ query }: { query?: string }) {
  void query // hash query (read via useHashRoute) is the source of truth; prop mirrors it
  const { navigate, query: routeQuery } = useHashRoute()
  const qc = useQueryClient()
  const { currentUserId } = useUi()

  const selectedId = routeQuery.get('selected')

  const [tab, setTab] = useState<TabKey>('upcoming')
  const [logOpen, setLogOpen] = useState(false)

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.list<MeetingRow>('meetings'),
  })
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => api.list<PickLead>('leads') })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.list<PickClient>('clients') })
  const { data: saasLeads } = useQuery({ queryKey: ['saas-leads'], queryFn: () => api.list<PickLead & { productId?: string }>('saas-leads') })
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => api.list<PickProject>('projects') })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.list<PickProduct>('products') })

  const now = Date.now()
  const { upcoming, past, all } = useMemo(() => {
    const list = meetings || []
    const up = list.filter((m) => new Date(m.dateTime).getTime() >= now).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    const pa = list.filter((m) => new Date(m.dateTime).getTime() < now).sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
    return { upcoming: up, past: pa, all: [...up, ...pa] }
  }, [meetings, now])

  const rows = tab === 'upcoming' ? upcoming : tab === 'past' ? past : all
  const selected = selectedId ? all.find((m) => m.id === selectedId) : undefined

  const openActionItems = (m: MeetingRow) => parseJsonObjects<ActionItem>(m.actionItems).filter((i) => !i.done).length

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Notes, decisions and action items — meetings that turn into work."
        actions={
          <Button onClick={() => setLogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CalendarPlus className="h-4 w-4" /> Log meeting
          </Button>
        }
      />

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        {TABS.map((t) => {
          const count = t.key === 'upcoming' ? upcoming.length : t.key === 'past' ? past.length : all.length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors inline-flex items-center gap-1.5',
                tab === t.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {t.label}
              <span className={cn('tabular-nums', tab === t.key ? 'text-zinc-300' : 'text-muted-foreground/70')}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* list */}
      {isLoading && !meetings ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === 'upcoming' ? 'No upcoming meetings' : tab === 'past' ? 'No past meetings' : 'No meetings yet'}
          description={
            tab === 'upcoming'
              ? 'Log the next one so decisions and action items have a home.'
              : tab === 'past'
                ? 'Everything logged so far is upcoming — past meetings will appear here.'
                : 'Log your first meeting to capture purpose, decisions and action items.'
          }
          action={
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setLogOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Log meeting
            </Button>
          }
        />
      ) : (
        <Card className="py-0">
          <CardContent className="p-2.5 max-h-[620px] overflow-y-auto space-y-1.5">
            {rows.map((m) => {
              const chip = relatedChip(m)
              const participants = parseJsonArray(m.participants)
              const open = openActionItems(m)
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`#/meetings?selected=${m.id}`)}
                  className="w-full text-left flex gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 hover:border-emerald-300/60 transition-colors group"
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <CalendarDays className="h-4 w-4 text-teal-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.title}</span>
                      {open > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                          <ListChecks className="h-3 w-3" /> {open} open
                        </span>
                      )}
                    </span>
                    {m.purpose && <span className="block text-xs text-muted-foreground truncate mt-0.5">{m.purpose}</span>}
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDayLabel(m.dateTime)} · {fmtDate(m.dateTime, 'h:mm a')}
                      </span>
                      {chip && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate"><span className="font-medium text-foreground/70">{chip.label}:</span> {chip.name}</span>
                        </span>
                      )}
                      {participants.length > 0 && (
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {participants.length} participant{participants.length === 1 ? '' : 's'}</span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="self-center h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 transition-colors" />
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* detail dialog (deep-linkable via ?selected=) */}
      <Dialog open={!!selectedId} onOpenChange={(o) => { if (!o) navigate('#/meetings') }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected ? (
            <MeetingDetail
              key={selected.id}
              meeting={selected}
              leads={leads}
              clients={clients}
              saasLeads={saasLeads}
              projects={projects}
              products={products}
            />
          ) : isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Meeting not found" description="It may have been removed." className="border-none bg-transparent" />
          )}
        </DialogContent>
      </Dialog>

      {/* log meeting dialog */}
      {logOpen && (
        <LogMeetingDialog
          leads={leads}
          clients={clients}
          saasLeads={saasLeads}
          projects={projects}
          currentUserId={currentUserId}
          onClose={() => setLogOpen(false)}
          onCreated={(id) => { qc.invalidateQueries(); navigate(`#/meetings?selected=${id}`) }}
        />
      )}
    </div>
  )
}

// ── detail dialog (view ⇄ edit) ──

function MeetingDetail({
  meeting, leads, clients, saasLeads, projects, products,
}: {
  meeting: MeetingRow
  leads?: PickLead[]
  clients?: PickClient[]
  saasLeads?: (PickLead & { productId?: string })[]
  projects?: PickProject[]
  products?: PickProduct[]
}) {
  const { navigate } = useHashRoute()
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const items = parseJsonObjects<ActionItem>(meeting.actionItems)
  const participants = parseJsonArray(meeting.participants)
  const chip = relatedChip(meeting)

  const [form, setForm] = useState({
    title: meeting.title,
    dateTime: toLocalInput(meeting.dateTime),
    purpose: meeting.purpose || '',
    participants: participants.join(', '),
    related: relatedValueOf(meeting),
    notes: meeting.notes || '',
    decisions: meeting.decisions || '',
    actionItems: items.map((i) => i.text).join('\n'),
    nextMeetingAt: toLocalInput(meeting.nextMeetingAt),
  })

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // rewrite the full action-items JSON (checklist toggle / convert marks done)
  const saveActionItems = async (updated: ActionItem[], message: string) => {
    setBusy(true)
    try {
      await api.update('meetings', meeting.id, { actionItems: updated.map((i) => ({ text: i.text, done: !!i.done })) })
      toast.success(message)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  const toggleItem = (idx: number, done: boolean) =>
    saveActionItems(items.map((it, i) => (i === idx ? { ...it, done } : it)), done ? 'Action item completed' : 'Action item reopened')

  const convertToFollowUp = async (idx: number) => {
    const text = items[idx]?.text
    if (!text) return
    try {
      await api.create('followups', {
        title: text,
        dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        method: 'OTHER',
        leadId: meeting.leadId ?? undefined,
        saasLeadId: meeting.saasLeadId ?? undefined,
        clientId: meeting.clientId ?? undefined,
        productId: meeting.productId ?? undefined,
        projectId: meeting.projectId ?? undefined,
        createdById: currentUserId || undefined,
      })
      await saveActionItems(items.map((it, i) => (i === idx ? { ...it, done: true } : it)), 'Follow-up created from action item')
    } catch (e: any) {
      toast.error(e.message || 'Failed to create follow-up')
    }
  }

  const convertToTask = async (idx: number) => {
    const text = items[idx]?.text
    if (!text || !meeting.projectId) return
    try {
      await api.create('tasks', { title: text, projectId: meeting.projectId, status: 'TODO' })
      await saveActionItems(items.map((it, i) => (i === idx ? { ...it, done: true } : it)), 'Task created from action item')
    } catch (e: any) {
      toast.error(e.message || 'Failed to create task')
    }
  }

  const saveEdit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.dateTime) { toast.error('Date & time are required'); return }
    const dt = new Date(form.dateTime)
    if (isNaN(dt.getTime())) { toast.error('Invalid date & time'); return }
    const rel = parseRelatedValue(form.related)
    const participantArr = form.participants.split(',').map((s) => s.trim()).filter(Boolean)
    const lines = form.actionItems.split('\n').map((s) => s.trim()).filter(Boolean)
    setBusy(true)
    try {
      await api.update('meetings', meeting.id, {
        title: form.title.trim(),
        dateTime: dt.toISOString(),
        purpose: form.purpose,
        participants: participantArr,
        notes: form.notes,
        decisions: form.decisions,
        actionItems: lines.map((line) => ({ text: line, done: items.find((i) => i.text === line)?.done ?? false })),
        nextMeetingAt: form.nextMeetingAt ? new Date(form.nextMeetingAt).toISOString() : null,
        // '' coerces to null server-side → clears relations not selected
        leadId: rel.leadId ?? '',
        saasLeadId: rel.saasLeadId ?? '',
        clientId: rel.clientId ?? '',
        productId: rel.productId ?? '',
        projectId: rel.projectId ?? '',
      })
      toast.success('Meeting updated')
      qc.invalidateQueries()
      setEditing(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update meeting')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg leading-snug">{meeting.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDayLabel(meeting.dateTime)} · {fmtDateTime(meeting.dateTime)}</span>
              <span>· {fmtRelative(meeting.dateTime)}</span>
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => (editing ? setEditing(false) : setEditing(true))}>
            <SquarePen className="h-3.5 w-3.5" /> {editing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </DialogHeader>

      {editing ? (
        <div className="space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date & time *</Label>
              <Input type="datetime-local" value={form.dateTime} onChange={(e) => setField('dateTime', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purpose</Label>
            <Input value={form.purpose} onChange={(e) => setField('purpose', e.target.value)} placeholder="What is this meeting about?" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participants (comma-separated)</Label>
            <Input value={form.participants} onChange={(e) => setField('participants', e.target.value)} placeholder="Ahmd, Prasanna, …" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Related to</Label>
            <RelatedSelect
              value={form.related}
              onChange={(v) => setField('related', v)}
              leads={leads}
              clients={clients}
              saasLeads={saasLeads}
              projects={projects}
              products={products}
              includeProducts
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Decisions</Label>
            <Textarea rows={3} value={form.decisions} onChange={(e) => setField('decisions', e.target.value)} placeholder="What was decided?" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action items (one per line)</Label>
            <Textarea rows={3} value={form.actionItems} onChange={(e) => setField('actionItems', e.target.value)} placeholder={'Send the proposal\nUpdate the scope'} />
            <p className="text-[11px] text-muted-foreground">Existing items keep their done state; each line becomes one item.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={4} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next meeting</Label>
            <Input type="datetime-local" value={form.nextMeetingAt} onChange={(e) => setField('nextMeetingAt', e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <div className="space-y-4">
          {meeting.purpose && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1">Purpose</p>
              <p className="text-sm whitespace-pre-wrap">{meeting.purpose}</p>
            </section>
          )}

          {chip && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Related</p>
              <button
                onClick={() => navigate(chip.href)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted transition-colors"
              >
                {chip.label === 'Product' ? <Package className="h-3 w-3 text-teal-600" /> : chip.label === 'SaaS lead' ? <Globe className="h-3 w-3 text-teal-600" /> : <Building2 className="h-3 w-3 text-teal-600" />}
                <span className="font-medium">{chip.label}:</span> {chip.name}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </button>
            </section>
          )}

          {participants.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Participants</p>
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <span key={`${p}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background pl-0.5 pr-2.5 py-0.5 text-xs">
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: avatarColor(p) }}
                    >
                      {initials(p)}
                    </span>
                    {p}
                  </span>
                ))}
              </div>
            </section>
          )}

          {meeting.decisions && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"><Gavel className="h-3 w-3" /> Decisions</p>
              <blockquote className="rounded-r-lg border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 text-sm italic whitespace-pre-wrap">
                {meeting.decisions}
              </blockquote>
            </section>
          )}

          <section>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> Action items
              {items.length > 0 && <span className="font-normal">({items.filter((i) => i.done).length}/{items.length} done)</span>}
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">No action items yet — add them via Edit.</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item, idx) => (
                  <div
                    key={`${item.text}-${idx}`}
                    className={cn('flex items-center gap-2.5 rounded-lg border px-2.5 py-2', item.done && 'bg-muted/40')}
                  >
                    <Checkbox
                      checked={!!item.done}
                      disabled={busy}
                      onCheckedChange={(v) => toggleItem(idx, v === true)}
                      aria-label={`Mark "${item.text}" ${item.done ? 'not done' : 'done'}`}
                    />
                    <span className={cn('text-sm min-w-0 flex-1', item.done && 'line-through text-muted-foreground')}>{item.text}</span>
                    {!item.done && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-emerald-700 transition-colors"
                            title="Turn this into…"
                            aria-label="Convert action item"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => convertToFollowUp(idx)}>
                            <CalendarPlus className="h-4 w-4 text-teal-600" /> Create follow-up
                          </DropdownMenuItem>
                          {meeting.projectId && (
                            <DropdownMenuItem onClick={() => convertToTask(idx)}>
                              <ListChecks className="h-4 w-4 text-violet-600" /> Create task
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {meeting.notes && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><StickyNote className="h-3 w-3" /> Notes</p>
              <p className="text-sm whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2">{meeting.notes}</p>
            </section>
          )}

          {meeting.nextMeetingAt && (
            <p className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-lg px-2.5 py-2">
              <CalendarDays className="h-3.5 w-3.5" />
              Next meeting: {fmtDateTime(meeting.nextMeetingAt)}
            </p>
          )}
        </div>
      )}
    </>
  )
}

// ── log meeting dialog ──

function LogMeetingDialog({
  leads, clients, saasLeads, projects, currentUserId, onClose, onCreated,
}: {
  leads?: PickLead[]
  clients?: PickClient[]
  saasLeads?: (PickLead & { productId?: string })[]
  projects?: PickProject[]
  currentUserId: string | null
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [form, setForm] = useState({
    title: '',
    dateTime: defaultDateTimeLocal(),
    purpose: '',
    participants: '',
    related: 'none',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.dateTime) { toast.error('Date & time are required'); return }
    const dt = new Date(form.dateTime)
    if (isNaN(dt.getTime())) { toast.error('Invalid date & time'); return }
    const rel = parseRelatedValue(form.related)
    const participantArr = form.participants.split(',').map((s) => s.trim()).filter(Boolean)
    setBusy(true)
    try {
      const created = await api.create<MeetingRow>('meetings', {
        title: form.title.trim(),
        dateTime: dt.toISOString(),
        purpose: form.purpose,
        participants: participantArr,
        notes: form.notes,
        ...rel,
      })
      toast.success('Meeting logged')
      onCreated(created.id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to log meeting')
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log meeting</DialogTitle>
          <DialogDescription>Capture what happened — the server files an activity automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Weekly sync with Northwind" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date & time *</Label>
            <Input type="datetime-local" value={form.dateTime} onChange={(e) => setField('dateTime', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Purpose</Label>
            <Input value={form.purpose} onChange={(e) => setField('purpose', e.target.value)} placeholder="Scope review / demo / planning…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participants (comma-separated)</Label>
            <Input value={form.participants} onChange={(e) => setField('participants', e.target.value)} placeholder="Ahmd, Prasanna, Sara" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Related to</Label>
            <RelatedSelect value={form.related} onChange={(v) => setField('related', v)} leads={leads} clients={clients} saasLeads={saasLeads} projects={projects} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Key points, context, links…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
