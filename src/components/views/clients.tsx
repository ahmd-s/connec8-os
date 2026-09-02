'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Client, FollowUp, Meeting, Project, Contact } from '@/lib/types'
import { CLIENT_STATUS, PROJECT_STATUS, FOLLOWUP_STATUS, METHODS, metaOf } from '@/lib/labels'
import { fmtDate, fmtDateTime, fmtDayLabel, isOverdue } from '@/lib/format'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Briefcase, Users, UserPlus, Plus, Search, Building2, Mail, Phone, Globe,
  FolderKanban, CalendarDays, BookUser, ChevronRight, Loader2, ArrowRight, AlarmClock,
} from 'lucide-react'

type ClientRow = Client & { _count?: { projects: number; contacts: number } }

/** Contract rule: OVERDUE / DUE_TODAY are derived client-side from dueDate. */
function derivedFuStatus(f: FollowUp): string {
  if (f.status === 'COMPLETED' || f.status === 'CANCELLED') return f.status
  if (isOverdue(f.dueDate)) return 'OVERDUE'
  if (fmtDayLabel(f.dueDate) === 'Today') return 'DUE_TODAY'
  return 'UPCOMING'
}

export function ClientsView({ query }: { query?: string }) {
  const { navigate } = useHashRoute()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: clients, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => api.list<ClientRow>('clients') })

  // selection lives in the URL: #/clients?selected=<id> opens the detail dialog
  const selected = useMemo(() => new URLSearchParams(query || '').get('selected'), [query])

  const all = useMemo(() => clients || [], [clients])
  const active = all.filter((c) => c.status === 'ACTIVE').length
  const prospects = all.filter((c) => c.status === 'PROSPECT').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter((c) => `${c.name} ${c.industry || ''} ${c.contactPerson || ''}`.toLowerCase().includes(q))
  }, [all, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Agency clients — everything about the relationship in one place."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> New client
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active clients" value={active} icon={Briefcase} tone="good" loading={isLoading} />
        <StatCard label="Prospects" value={prospects} icon={UserPlus} tone="accent" loading={isLoading} />
        <StatCard label="Total clients" value={all.length} icon={Users} loading={isLoading} />
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…" className="h-8 pl-8 text-xs"
        />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={all.length === 0 ? 'No clients yet' : 'No clients match your search'}
          description={all.length === 0 ? 'When a deal is won, add the client here to keep projects, meetings and contacts connected.' : 'Try a different search term.'}
          action={
            <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> New client
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`#/clients?selected=${c.id}`)}
              className="text-left rounded-xl border bg-card p-4 hover:border-emerald-300 hover:shadow-sm transition-all group flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-emerald-700 transition-colors">{c.name}</p>
                  {c.contactPerson && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.contactPerson}</p>}
                </div>
                <StatusBadge map={CLIENT_STATUS} value={c.status} size="sm" />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {c.industry && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/40 text-muted-foreground">{c.industry}</span>
                )}
                {c.website && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Globe className="h-3 w-3" /> {c.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                {c.email && <span className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</span>}
                {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {c.phone}</span>}
              </div>

              {c.notes && <p className="text-[11px] text-muted-foreground line-clamp-2">{c.notes}</p>}

              <div className="mt-auto flex items-center justify-between text-[11px] pt-2 border-t">
                <span className="text-muted-foreground flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" /> {c._count?.projects ?? 0} project{(c._count?.projects ?? 0) === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-0.5 font-medium text-emerald-700">
                  Details <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <ClientDetailDialog id={selected} open={!!selected} onOpenChange={(o) => { if (!o) navigate('#/clients') }} />
      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

/* ── create dialog ── */

function CreateClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setIndustry(''); setContactPerson(''); setEmail(''); setPhone(''); setStatus('ACTIVE'); setNotes('') }
  }, [open])

  const submit = async () => {
    if (!name.trim()) { toast.error('Client name is required'); return }
    setSaving(true)
    try {
      await api.create('clients', { name: name.trim(), industry, contactPerson, email, phone, status, notes })
      toast.success('Client added')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create client')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">New client</DialogTitle>
          <DialogDescription className="text-xs">Add an agency client. Projects, meetings and contacts attach to this record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bloom & Co Furniture" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Food Export" className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact person</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Who we deal with" className="text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(CLIENT_STATUS).map((s) => (
                  <SelectItem key={s} value={s}>{metaOf(CLIENT_STATUS, s).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Relationship context, preferences, landmines to avoid…" className="min-h-[60px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── detail dialog ── */

function ClientDetailDialog({
  id, open, onOpenChange,
}: {
  id: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { navigate } = useHashRoute()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', industry: '', website: '', contactPerson: '', email: '', phone: '', status: 'ACTIVE', notes: '',
  })

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>('clients', id!),
    enabled: open && !!id,
  })

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        industry: client.industry || '',
        website: client.website || '',
        contactPerson: client.contactPerson || '',
        email: client.email || '',
        phone: client.phone || '',
        status: client.status,
        notes: client.notes || '',
      })
    }
  }, [client])

  const save = async () => {
    if (!client) return
    if (!form.name.trim()) { toast.error('Client name is required'); return }
    setSaving(true)
    try {
      await api.update('clients', client.id, { ...form, name: form.name.trim() })
      toast.success('Client updated')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update client')
    } finally {
      setSaving(false)
    }
  }

  const go = (hash: string) => {
    onOpenChange(false)
    navigate(hash)
  }

  const projects = client?.projects || []
  const meetings = client?.meetings || []
  const contacts = client?.contacts || []
  const openFollowUps = (client?.followUps || []).filter((f) => f.status === 'UPCOMING')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-600" /> {isLoading ? 'Client' : client?.name || 'Client'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Everything about this relationship — edit fields, review projects, meetings, contacts and follow-ups.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !client ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* editable fields */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Industry</Label>
                <Input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(CLIENT_STATUS).map((s) => (
                      <SelectItem key={s} value={s}>{metaOf(CLIENT_STATUS, s).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Relationship context, preferences, who's who…"
                className="min-h-[70px] text-sm"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
              </Button>
            </div>

            {/* originated from lead */}
            {client.lead && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3" /> This client originated from a won lead
                </p>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => go(`#/leads/${client.lead!.id}`)}>
                  {client.lead.businessName} <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* projects */}
            <Section title="Projects" count={projects.length} icon={FolderKanban}>
              {projects.length === 0 ? (
                <SectionEmpty text="No projects for this client yet." />
              ) : (
                projects.map((p: Project) => (
                  <button
                    key={p.id}
                    onClick={() => go(`#/projects/${p.id}`)}
                    className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{p.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {(p as Project & { _count?: { tasks: number } })._count?.tasks ?? 0} tasks
                        {p.deadline ? ` · due ${fmtDate(p.deadline, 'MMM d')}` : ''}
                      </span>
                    </span>
                    <StatusBadge map={PROJECT_STATUS} value={p.status} size="sm" />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </Section>

            {/* meetings */}
            <Section title="Meetings" count={meetings.length} icon={CalendarDays}>
              {meetings.length === 0 ? (
                <SectionEmpty text="No meetings recorded with this client." />
              ) : (
                meetings.slice(0, 5).map((m: Meeting) => (
                  <button
                    key={m.id}
                    onClick={() => go(`#/meetings?selected=${m.id}`)}
                    className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{m.title}</span>
                      {m.purpose && <span className="block text-[10px] text-muted-foreground truncate">{m.purpose}</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDateTime(m.dateTime)}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </Section>

            {/* contacts */}
            <Section title="Contacts" count={contacts.length} icon={BookUser}>
              {contacts.length === 0 ? (
                <SectionEmpty text="No contacts saved for this client." />
              ) : (
                contacts.map((ct: Contact) => (
                  <button
                    key={ct.id}
                    onClick={() => go(`#/contacts?selected=${ct.id}`)}
                    className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{ct.name}</span>
                      {ct.role && <span className="block text-[10px] text-muted-foreground truncate">{ct.role}</span>}
                    </span>
                    {ct.email && (
                      <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[160px]">{ct.email}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </Section>

            {/* open follow-ups */}
            <Section title="Open follow-ups" count={openFollowUps.length} icon={AlarmClock}>
              {openFollowUps.length === 0 ? (
                <SectionEmpty text="Nothing pending — all follow-ups are completed." />
              ) : (
                openFollowUps.map((f: FollowUp) => (
                  <button
                    key={f.id}
                    onClick={() => go('#/followups')}
                    className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{f.title}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {fmtDateTime(f.dueDate)} · {metaOf(METHODS, f.method).label}
                      </span>
                    </span>
                    <StatusBadge map={FOLLOWUP_STATUS} value={derivedFuStatus(f)} size="sm" />
                  </button>
                ))
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── small dialog helpers ── */

function Section({
  title, count, icon: Icon, children,
}: {
  title: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {title}
        <span className="tabular-nums opacity-70">({count})</span>
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SectionEmpty({ text }: { text: string }) {
  return <p className="text-[11px] text-muted-foreground py-2 px-1">{text}</p>
}
