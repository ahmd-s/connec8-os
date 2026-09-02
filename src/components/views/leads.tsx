'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Lead, User, FollowUp, Outreach, Pitch, Meeting, Contact } from '@/lib/types'
import {
  LEAD_STAGES, LEAD_STAGE_ORDER, PRIORITY, METHODS, FOLLOWUP_STATUS, OUTREACH_CHANNELS,
  OUTREACH_STATUS, PITCH_STATUS, LEAD_SOURCES, metaOf, parseJsonArray,
} from '@/lib/labels'
import { fmtDate, fmtDateTime, fmtRelative, fmtDayLabel, isOverdue, initials, avatarColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Timeline } from '@/components/shared/timeline'
import { ActivityComposer } from '@/components/shared/activity-composer'
import { AttachmentSection } from '@/components/shared/attachment-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlarmClock, ArrowLeft, Building2, CalendarDays, CalendarPlus, CheckCircle2, Clock,
  ExternalLink, Globe, Hourglass, Instagram, LayoutGrid, Linkedin, Loader2, Mail, MapPin,
  MessageCircle, MessageSquare, Pencil, Phone, Plus, Search, Send, Table2, Trophy,
  User as UserIcon, Users, X,
} from 'lucide-react'

/* ─────────────────────────── constants & helpers ─────────────────────────── */

const ACTIVE_CONV_STAGES = ['REPLIED', 'ACTIVE_CONVERSATION', 'MEETING', 'PROPOSAL_SENT', 'NEGOTIATING']
const STANDARD_PROBLEMS = ['No website', 'Outdated website', 'Poor mobile experience']

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  COLD_EMAIL: Mail, LINKEDIN: Linkedin, WHATSAPP: MessageCircle, INSTAGRAM: Instagram,
  REDDIT: MessageSquare, PHONE: Phone, REFERRAL: Users, VISIT: MapPin, OTHER: Globe,
}

function httpsUrl(u?: string | null): string | null {
  if (!u) return null
  return u.startsWith('http') ? u : `https://${u}`
}

/** ISO date → value usable by <input type="datetime-local"> */
function toLocalInput(d?: string | null): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

/** Derived follow-up status (OVERDUE / DUE_TODAY derived client-side per contract). */
function followUpStatusKey(f: FollowUp): string {
  if (f.status === 'COMPLETED' || f.status === 'CANCELLED') return f.status
  if (isOverdue(f.dueDate)) return 'OVERDUE'
  if (fmtDayLabel(f.dueDate) === 'Today') return 'DUE_TODAY'
  return 'UPCOMING'
}

/* ─────────────────────────── tiny shared pieces ─────────────────────────── */

function MiniAvatar({ name, className }: { name?: string | null; className?: string }) {
  if (!name) {
    return (
      <span
        className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed bg-muted/30 text-muted-foreground', className)}
        title="Unassigned"
      >
        <UserIcon className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span
      className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', className)}
      style={{ background: avatarColor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

function Chip({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}

function StageSelect({ value, onValueChange, triggerClassName }: { value: string; onValueChange: (v: string) => void; triggerClassName?: string }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className={triggerClassName} aria-label="Lead stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STAGE_ORDER.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{LEAD_STAGES[s].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ─────────────────────────── kanban pieces ─────────────────────────── */

function LeadCard({ lead, onOpen, onMove }: { lead: Lead; onOpen: () => void; onMove: (stage: string) => void }) {
  const [dragging, setDragging] = useState(false)
  const fu = lead.nextFollowUpAt
  const fuOverdue = !!fu && isOverdue(fu) && lead.stage !== 'WON' && lead.stage !== 'LOST'
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lead.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      tabIndex={0}
      aria-label={`Open lead ${lead.businessName}`}
      className={cn(
        'rounded-lg border bg-card p-3 space-y-1.5 cursor-grab active:cursor-grabbing transition-all hover:border-emerald-300 hover:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-5 truncate flex-1">{lead.businessName}</p>
        <StatusBadge map={PRIORITY} value={lead.priority} size="sm" />
      </div>
      {lead.contactPerson && <p className="text-xs text-muted-foreground truncate">{lead.contactPerson}</p>}
      {lead.whyTargeted && <p className="text-[11px] text-muted-foreground/80 truncate italic">{lead.whyTargeted}</p>}
      <div className="flex items-center gap-3 pt-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 min-w-0">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{fmtRelative(lead.lastActivityAt)}</span>
        </span>
        {fu && (
          <span className={cn('inline-flex items-center gap-1 min-w-0', fuOverdue && 'text-amber-600 font-medium')}>
            <AlarmClock className="h-3 w-3 shrink-0" />
            <span className="truncate">{fuOverdue ? 'Follow-up overdue' : fmtRelative(fu)}</span>
          </span>
        )}
      </div>
      <div
        className="flex items-center justify-between gap-2 pt-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <StageSelect
          value={lead.stage}
          onValueChange={onMove}
          triggerClassName="h-6! w-[124px] text-[10px]! px-1.5 bg-background"
        />
        <MiniAvatar name={lead.assignedTo?.name} />
      </div>
    </div>
  )
}

function KanbanColumn({
  stage, leads, onOpenLead, onMoveLead,
}: {
  stage: string
  leads: Lead[]
  onOpenLead: (id: string) => void
  onMoveLead: (leadId: string, stage: string) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onMoveLead(id, stage)
      }}
      className={cn(
        'w-[268px] shrink-0 rounded-xl border bg-muted/30 flex flex-col transition-colors',
        over && 'border-emerald-400 bg-emerald-50/50'
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
        <span className="text-xs font-semibold truncate">{LEAD_STAGES[stage].label}</span>
        <span className="text-[10px] font-semibold text-muted-foreground bg-background border rounded-full px-1.5 tabular-nums">
          {leads.length}
        </span>
      </div>
      <div className="p-2 space-y-2 min-h-[96px] max-h-[560px] overflow-y-auto">
        {leads.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">Drop leads here</p>
        ) : (
          leads.map((l) => (
            <LeadCard key={l.id} lead={l} onOpen={() => onOpenLead(l.id)} onMove={(s) => onMoveLead(l.id, s)} />
          ))
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── lead form dialog (create + edit) ─────────────────────────── */

interface LeadFormValues {
  businessName: string; contactPerson: string; jobTitle: string; website: string
  industry: string; location: string; companySize: string; source: string
  stage: string; priority: string; whyTargeted: string; pitchAngle: string
  notes: string; email: string; phone: string; whatsapp: string
  linkedin: string; instagram: string; otherContact: string
  nextFollowUpAt: string; assignedToId: string
}

const EMPTY_LEAD_FORM: LeadFormValues = {
  businessName: '', contactPerson: '', jobTitle: '', website: '', industry: '', location: '',
  companySize: '', source: '', stage: 'LEAD_FOUND', priority: 'MEDIUM', whyTargeted: '',
  pitchAngle: '', notes: '', email: '', phone: '', whatsapp: '', linkedin: '', instagram: '',
  otherContact: '', nextFollowUpAt: '', assignedToId: '',
}

function LeadFormDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead | null }) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list<User>('users') })
  const [form, setForm] = useState<LeadFormValues>(EMPTY_LEAD_FORM)
  const [problems, setProblems] = useState<string[]>([])
  const [customProblem, setCustomProblem] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (lead) {
      setForm({
        businessName: lead.businessName || '', contactPerson: lead.contactPerson || '', jobTitle: lead.jobTitle || '',
        website: lead.website || '', industry: lead.industry || '', location: lead.location || '',
        companySize: lead.companySize || '', source: lead.source || '', stage: lead.stage, priority: lead.priority,
        whyTargeted: lead.whyTargeted || '', pitchAngle: lead.pitchAngle || '', notes: lead.notes || '',
        email: lead.email || '', phone: lead.phone || '', whatsapp: lead.whatsapp || '',
        linkedin: lead.linkedin || '', instagram: lead.instagram || '', otherContact: lead.otherContact || '',
        nextFollowUpAt: toLocalInput(lead.nextFollowUpAt), assignedToId: lead.assignedToId || '',
      })
      setProblems(parseJsonArray(lead.problems))
    } else {
      setForm({ ...EMPTY_LEAD_FORM, assignedToId: currentUserId || '' })
      setProblems([])
    }
    setCustomProblem('')
  }, [open, lead, currentUserId])

  const set = (k: keyof LeadFormValues) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const toggleProblem = (p: string) => setProblems((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]))
  const addCustomProblem = () => {
    const v = customProblem.trim()
    if (!v) return
    if (!problems.includes(v)) setProblems((arr) => [...arr, v])
    setCustomProblem('')
  }
  const removeProblem = (p: string) => setProblems((arr) => arr.filter((x) => x !== p))
  const customProblems = problems.filter((p) => !STANDARD_PROBLEMS.includes(p))

  const submit = async () => {
    if (!form.businessName.trim()) { toast.error('Business name is required'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        businessName: form.businessName.trim(),
        contactPerson: form.contactPerson, jobTitle: form.jobTitle, website: form.website,
        industry: form.industry, location: form.location, companySize: form.companySize,
        source: form.source || null, stage: form.stage, priority: form.priority,
        whyTargeted: form.whyTargeted, pitchAngle: form.pitchAngle, notes: form.notes,
        email: form.email, phone: form.phone, whatsapp: form.whatsapp,
        linkedin: form.linkedin, instagram: form.instagram, otherContact: form.otherContact,
        problems: JSON.stringify(problems),
        assignedToId: form.assignedToId || null,
      }
      if (lead) payload.nextFollowUpAt = form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null
      if (lead) await api.update('leads', lead.id, payload)
      else await api.create('leads', payload)
      toast.success(lead ? 'Lead updated' : 'Lead created')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit lead' : 'Add lead'}</DialogTitle>
          <DialogDescription>
            {lead ? 'Update the record — every change stays connected to its history.' : 'Capture the essentials now; you can enrich everything later from the lead page.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* basics */}
          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Basics</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Business name *</Label>
                <Input value={form.businessName} onChange={(e) => set('businessName')(e.target.value)} placeholder="Bloom & Co" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact person</Label>
                <Input value={form.contactPerson} onChange={(e) => set('contactPerson')(e.target.value)} placeholder="Sara Ahmed" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job title</Label>
                <Input value={form.jobTitle} onChange={(e) => set('jobTitle')(e.target.value)} placeholder="Owner" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source</Label>
                <Select value={form.source || 'UNSET'} onValueChange={(v) => set('source')(v === 'UNSET' ? '' : v)}>
                  <SelectTrigger size="sm" className="w-full bg-background"><SelectValue placeholder="Where did they come from?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNSET">Not set</SelectItem>
                    {Object.keys(LEAD_SOURCES).map((s) => (
                      <SelectItem key={s} value={s}>{LEAD_SOURCES[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={set('priority')}>
                  <SelectTrigger size="sm" className="w-full bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned to</Label>
                <Select value={form.assignedToId || 'UNSET'} onValueChange={(v) => set('assignedToId')(v === 'UNSET' ? '' : v)}>
                  <SelectTrigger size="sm" className="w-full bg-background"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNSET">Unassigned</SelectItem>
                    {(users || []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Industry</Label>
                <Input value={form.industry} onChange={(e) => set('industry')(e.target.value)} placeholder="Restaurant" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input value={form.location} onChange={(e) => set('location')(e.target.value)} placeholder="Colombo" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company size</Label>
                <Input value={form.companySize} onChange={(e) => set('companySize')(e.target.value)} placeholder="10-50" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Website</Label>
                <Input value={form.website} onChange={(e) => set('website')(e.target.value)} placeholder="bloomco.com" className="h-9" />
              </div>
              {lead && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Stage</Label>
                    <Select value={form.stage} onValueChange={set('stage')}>
                      <SelectTrigger size="sm" className="w-full bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEAD_STAGE_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{LEAD_STAGES[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Next follow-up</Label>
                    <Input type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => set('nextFollowUpAt')(e.target.value)} className="h-9" />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* targeting */}
          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Why we targeted them</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Why this business?</Label>
              <Textarea value={form.whyTargeted} onChange={(e) => set('whyTargeted')(e.target.value)} placeholder="No online ordering, strong reviews, busy location…" className="min-h-[64px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pitch angle</Label>
              <Textarea value={form.pitchAngle} onChange={(e) => set('pitchAngle')(e.target.value)} placeholder="Lead with a booking-focused landing page…" className="min-h-[56px] text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Problems we can solve</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {STANDARD_PROBLEMS.map((p) => (
                  <label
                    key={p}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-colors hover:bg-muted/50',
                      problems.includes(p) && 'border-emerald-200 bg-emerald-50/60'
                    )}
                  >
                    <Checkbox checked={problems.includes(p)} onCheckedChange={() => toggleProblem(p)} />
                    <span className="min-w-0">{p}</span>
                  </label>
                ))}
              </div>
              {customProblems.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customProblems.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
                      {p}
                      <button type="button" onClick={() => removeProblem(p)} className="text-muted-foreground hover:text-rose-600" aria-label={`Remove problem: ${p}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={customProblem}
                  onChange={(e) => setCustomProblem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomProblem() } }}
                  placeholder="Other problem — press Enter to add"
                  className="h-8 flex-1 text-xs bg-background"
                />
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCustomProblem}>Add</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Anything worth remembering…" className="min-h-[56px] text-sm" />
            </div>
          </section>

          {/* contact details */}
          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Contact details</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="hello@bloomco.com" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="+94 77 123 4567" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => set('whatsapp')(e.target.value)} placeholder="+94 77 123 4567" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">LinkedIn</Label>
                <Input value={form.linkedin} onChange={(e) => set('linkedin')(e.target.value)} placeholder="linkedin.com/company/…" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Instagram</Label>
                <Input value={form.instagram} onChange={(e) => set('instagram')(e.target.value)} placeholder="instagram.com/…" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Other contact</Label>
                <Input value={form.otherContact} onChange={(e) => set('otherContact')(e.target.value)} placeholder="Anything else" className="h-9" />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {lead ? 'Save changes' : 'Create lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────── follow-up & outreach dialogs (detail page) ─────────────────────────── */

function ScheduleFollowUpDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [method, setMethod] = useState('EMAIL')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(`Follow up with ${lead.businessName}`)
    setDueDate(toLocalInput(new Date(Date.now() + 24 * 3600 * 1000).toISOString()))
    setMethod('EMAIL')
    setReason('')
  }, [open, lead])

  const submit = async () => {
    if (!dueDate) { toast.error('Pick a date and time'); return }
    setSaving(true)
    try {
      await api.create('followups', {
        title: title.trim() || `Follow up with ${lead.businessName}`,
        dueDate: new Date(dueDate).toISOString(),
        method,
        reason: reason.trim() || null,
        status: 'UPCOMING',
        leadId: lead.id,
        createdById: currentUserId || undefined,
      })
      toast.success('Follow-up scheduled')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to schedule follow-up')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>For {lead.businessName} — it shows up on the dashboard when due.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">When *</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger size="sm" className="w-full bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(METHODS).map((m) => (
                    <SelectItem key={m} value={m}>{METHODS[m].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason / what to say</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nudge about the proposal…" className="min-h-[56px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LogOutreachDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [channel, setChannel] = useState('COLD_EMAIL')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('SENT')
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setChannel('COLD_EMAIL')
    setDate(fmtDate(new Date(), 'yyyy-MM-dd'))
    setStatus('SENT')
    setMessage('')
    setResponse('')
  }, [open])

  const submit = async () => {
    setSaving(true)
    try {
      await api.create('outreach', {
        channel,
        status,
        date: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString(),
        message: message.trim() || null,
        response: response.trim() || null,
        leadId: lead.id,
        userId: currentUserId || undefined,
      })
      toast.success('Outreach logged')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to log outreach')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log outreach</DialogTitle>
          <DialogDescription>Record a touchpoint with {lead.businessName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger size="sm" className="w-full bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(OUTREACH_CHANNELS).map((c) => (
                    <SelectItem key={c} value={c}>{OUTREACH_CHANNELS[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-full bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(OUTREACH_STATUS).map((s) => (
                  <SelectItem key={s} value={s}>{OUTREACH_STATUS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message / what happened</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Sent the intro email…" className="min-h-[64px] text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Response (if any)</Label>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="They replied asking for pricing…" className="min-h-[56px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Log outreach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReschedulePopover({ followUp }: { followUp: FollowUp }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!value) { toast.error('Pick a new date and time'); return }
    setSaving(true)
    try {
      await api.update('followups', followUp.id, { dueDate: new Date(value).toISOString() })
      toast.success('Follow-up rescheduled')
      setOpen(false)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to reschedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(toLocalInput(followUp.dueDate)) }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground">
          <Clock className="h-3 w-3" /> Reschedule
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2.5" align="end">
        <Label className="text-xs">New date &amp; time</Label>
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="h-9" />
        <Button size="sm" className="w-full" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Reschedule
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/* ─────────────────────────── LeadsView ─────────────────────────── */

export function LeadsView() {
  const qc = useQueryClient()
  const { query, navigate } = useHashRoute()
  const stageParam = query.get('stage')

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState('ALL')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [addOpen, setAddOpen] = useState(false)

  // Support #/leads?stage=X (Dashboard pipeline chips) — pre-set the stage filter from the hash.
  // Render-time state adjustment (React-recommended pattern for reacting to prop/route changes).
  const [prevStageParam, setPrevStageParam] = useState(stageParam)
  if (stageParam !== prevStageParam) {
    setPrevStageParam(stageParam)
    setStageFilter(stageParam && LEAD_STAGES[stageParam] ? stageParam : 'ALL')
  }

  const { data: leads, isLoading } = useQuery({ queryKey: ['leads'], queryFn: () => api.list<Lead>('leads') })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list<User>('users') })

  const all = useMemo(() => leads || [], [leads])
  const q = search.trim().toLowerCase()

  const base = useMemo(() => all.filter((l) =>
    (!q || l.businessName?.toLowerCase().includes(q) || l.contactPerson?.toLowerCase().includes(q)) &&
    (priorityFilter === 'ALL' || l.priority === priorityFilter) &&
    (assigneeFilter === 'ALL' || l.assignedToId === assigneeFilter)
  ), [all, q, priorityFilter, assigneeFilter])

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of LEAD_STAGE_ORDER) c[s] = 0
    for (const l of base) if (c[l.stage] !== undefined) c[l.stage]++
    return c
  }, [base])

  const filtered = useMemo(
    () => (stageFilter === 'ALL' ? base : base.filter((l) => l.stage === stageFilter)),
    [base, stageFilter]
  )

  const stats = useMemo(() => ({
    total: all.length,
    won: all.filter((l) => l.stage === 'WON').length,
    active: all.filter((l) => ACTIVE_CONV_STAGES.includes(l.stage)).length,
    overdue: all.filter((l) => l.nextFollowUpAt && isOverdue(l.nextFollowUpAt) && l.stage !== 'WON' && l.stage !== 'LOST').length,
  }), [all])

  const moveLead = async (leadId: string, stage: string) => {
    const lead = all.find((l) => l.id === leadId)
    if (!lead || lead.stage === stage) return
    try {
      await api.update('leads', leadId, { stage })
      toast.success(`${lead.businessName} → ${metaOf(LEAD_STAGES, stage).label}`)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to move lead')
    }
  }

  const clearFilters = () => { setSearch(''); setStageFilter('ALL'); setPriorityFilter('ALL'); setAssigneeFilter('ALL') }
  const hasFilters = search !== '' || stageFilter !== 'ALL' || priorityFilter !== 'ALL' || assigneeFilter !== 'ALL'
  const pillCls = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
      active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
    )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Agency opportunities — from first discovery to won deals."
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        }
      />

      {/* overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={stats.total} icon={Users} loading={isLoading} />
        <StatCard label="Won" value={stats.won} icon={Trophy} tone="good" loading={isLoading} />
        <StatCard label="Active Conversations" value={stats.active} icon={MessageSquare} tone="accent" loading={isLoading} />
        <StatCard label="Overdue Follow-ups" value={stats.overdue} icon={AlarmClock} tone={stats.overdue > 0 ? 'bad' : 'good'} loading={isLoading} />
      </div>

      {/* toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search business or contact…"
              className="pl-8 h-9"
              aria-label="Search leads"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger size="sm" className="h-9! w-[150px] bg-background" aria-label="Filter by priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger size="sm" className="h-9! w-[160px] bg-background" aria-label="Filter by assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All assignees</SelectItem>
              {(users || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center rounded-lg border p-0.5 bg-muted/30">
            <button
              onClick={() => setView('kanban')}
              aria-pressed={view === 'kanban'}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'kanban' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Table2 className="h-3.5 w-3.5" /> Table
            </button>
          </div>
        </div>

        {/* stage filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStageFilter('ALL')} className={pillCls(stageFilter === 'ALL')}>
            All <span className="tabular-nums opacity-70">{base.length}</span>
          </button>
          {LEAD_STAGE_ORDER.map((s) => (
            <button key={s} onClick={() => setStageFilter(s)} className={pillCls(stageFilter === s)}>
              {LEAD_STAGES[s].label} <span className="tabular-nums opacity-70">{stageCounts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* board / table */}
      {isLoading ? (
        <div className="kanban-scroll flex gap-3 overflow-x-auto pb-2">
          {LEAD_STAGE_ORDER.slice(0, 6).map((s) => (
            <div key={s} className="w-[268px] shrink-0 rounded-xl border bg-muted/30 p-3 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-[104px] rounded-lg" />
              <Skeleton className="h-[104px] rounded-lg" />
            </div>
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Add your first agency lead and start building the pipeline — research, outreach and deals all live here."
          action={
            <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> Add lead
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No leads match these filters"
          description="Try a different search, stage, priority or assignee."
          action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : view === 'kanban' ? (
        <div className="kanban-scroll flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {LEAD_STAGE_ORDER.map((s) => (
            <KanbanColumn
              key={s}
              stage={s}
              leads={filtered.filter((l) => l.stage === s)}
              onOpenLead={(leadId) => navigate(`#/leads/${leadId}`)}
              onMoveLead={moveLead}
            />
          ))}
        </div>
      ) : (
        <Card className="py-0 overflow-hidden">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Next follow-up</TableHead>
                  <TableHead className="pr-4">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const fu = l.nextFollowUpAt
                  const fuOverdue = !!fu && isOverdue(fu) && l.stage !== 'WON' && l.stage !== 'LOST'
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => navigate(`#/leads/${l.id}`)}>
                      <TableCell className="pl-4">
                        <p className="text-sm font-medium">{l.businessName}</p>
                        {l.whyTargeted && <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{l.whyTargeted}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.contactPerson || '—'}</TableCell>
                      <TableCell><StatusBadge map={LEAD_STAGES} value={l.stage} size="sm" /></TableCell>
                      <TableCell><StatusBadge map={PRIORITY} value={l.priority} size="sm" /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.source ? (LEAD_SOURCES[l.source] || l.source) : '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtRelative(l.lastActivityAt)}</TableCell>
                      <TableCell className={cn('text-sm whitespace-nowrap', fuOverdue ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                        {fu ? fmtDate(fu, 'MMM d') : '—'}
                      </TableCell>
                      <TableCell className="pr-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MiniAvatar name={l.assignedTo?.name} className="h-5 w-5 text-[8px]" />
                          <span className="truncate max-w-[110px]">{l.assignedTo?.name || '—'}</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <LeadFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}

/* ─────────────────────────── LeadDetailView ─────────────────────────── */

export function LeadDetailView({ id }: { id: string }) {
  const qc = useQueryClient()
  const { navigate } = useHashRoute()
  const { data: lead, isLoading, isError } = useQuery({ queryKey: ['lead', id], queryFn: () => api.get<Lead>('leads', id) })

  const [editOpen, setEditOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [outreachOpen, setOutreachOpen] = useState(false)

  const changeStage = async (stage: string) => {
    if (!lead || lead.stage === stage) return
    try {
      await api.update('leads', lead.id, { stage })
      toast.success(`Stage → ${metaOf(LEAD_STAGES, stage).label}`)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to change stage')
    }
  }

  const completeFollowUp = async (f: FollowUp) => {
    try {
      await api.update('followups', f.id, { status: 'COMPLETED' })
      toast.success('Follow-up completed')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to complete follow-up')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !lead) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('#/leads')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Leads
        </button>
        <EmptyState
          icon={Search}
          title="Lead not found"
          description="It may have been deleted or the link is out of date."
          action={<Button variant="outline" onClick={() => navigate('#/leads')}>Back to leads</Button>}
        />
      </div>
    )
  }

  const followUps = lead.followUps || []
  const activeFu = followUps
    .filter((f) => f.status === 'UPCOMING')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  const pitches = lead.pitches || []
  const meetings = lead.meetings || []
  const contacts = lead.contacts || []
  const outreaches = lead.outreaches || []
  const problems = parseJsonArray(lead.problems)

  const nextFu = lead.nextFollowUpAt
  const nextOverdue = !!nextFu && isOverdue(nextFu) && lead.stage !== 'WON' && lead.stage !== 'LOST'

  const site = httpsUrl(lead.website)
  const contactLinks: { icon: React.ComponentType<{ className?: string }>; href: string; label: string; external: boolean }[] = []
  if (lead.email) contactLinks.push({ icon: Mail, href: `mailto:${lead.email}`, label: lead.email, external: false })
  if (lead.phone) contactLinks.push({ icon: Phone, href: `tel:${lead.phone}`, label: lead.phone, external: false })
  if (lead.whatsapp) contactLinks.push({ icon: MessageCircle, href: `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`, label: 'WhatsApp', external: true })
  const li = httpsUrl(lead.linkedin)
  if (li) contactLinks.push({ icon: Linkedin, href: li, label: 'LinkedIn', external: true })
  const ig = httpsUrl(lead.instagram)
  if (ig) contactLinks.push({ icon: Instagram, href: ig, label: 'Instagram', external: true })

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('#/leads')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Leads
      </button>

      {/* header card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight">{lead.businessName}</h1>
                <StatusBadge map={PRIORITY} value={lead.priority} size="sm" />
                <StatusBadge map={LEAD_STAGES} value={lead.stage} size="sm" />
              </div>
              {(lead.contactPerson || lead.jobTitle) && (
                <p className="text-sm text-muted-foreground">
                  {[lead.contactPerson, lead.jobTitle].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {lead.industry && <Chip icon={Building2}>{lead.industry}</Chip>}
                {lead.location && <Chip icon={MapPin}>{lead.location}</Chip>}
                {lead.companySize && <Chip icon={Users}>{lead.companySize} people</Chip>}
                {lead.source && <Chip icon={Search}>{LEAD_SOURCES[lead.source] || lead.source}</Chip>}
                {site && (
                  <a href={site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-emerald-700 hover:border-emerald-300 transition-colors">
                    <ExternalLink className="h-3 w-3" /> {lead.website}
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <MiniAvatar name={lead.assignedTo?.name} className="h-7 w-7 text-[10px]" />
                  <div className="leading-tight">
                    <p className="text-xs font-medium">{lead.assignedTo?.name || 'Unassigned'}</p>
                    <p className="text-[10px] text-muted-foreground">Owner</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Stage</span>
                <StageSelect value={lead.stage} onValueChange={changeStage} triggerClassName="w-[190px] bg-background" />
              </div>
              <p className="text-[11px] text-muted-foreground">Last activity {fmtRelative(lead.lastActivityAt)}</p>
            </div>
          </div>

          {contactLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {contactLinks.map((c, i) => (
                <a
                  key={`${c.label}-${i}`}
                  href={c.href}
                  target={c.external ? '_blank' : undefined}
                  rel={c.external ? 'noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-emerald-300 transition-colors max-w-[240px]"
                >
                  <c.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />
      <ScheduleFollowUpDialog lead={lead} open={scheduleOpen} onOpenChange={setScheduleOpen} />
      <LogOutreachDialog lead={lead} open={outreachOpen} onOpenChange={setOutreachOpen} />

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* why we targeted them */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Why we targeted them</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.whyTargeted ? (
                <p className="text-sm leading-6 whitespace-pre-wrap">{lead.whyTargeted}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No targeting notes yet — add why this business is worth pursuing.</p>
              )}
              {lead.pitchAngle && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pitch angle</p>
                  <p className="text-sm whitespace-pre-wrap">{lead.pitchAngle}</p>
                </div>
              )}
              {problems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Problems we can solve</p>
                  <div className="flex flex-wrap gap-1.5">
                    {problems.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/60 px-2.5 py-0.5 text-xs text-amber-800">
                        <AlarmClock className="h-3 w-3" /> {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {lead.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* complete activity timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Complete activity timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Schedule follow-up
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOutreachOpen(true)}>
                  <Send className="h-3.5 w-3.5" /> Log outreach
                </Button>
              </div>
              <ActivityComposer leadId={lead.id} />
              <Timeline activities={lead.activities || []} />
            </CardContent>
          </Card>
        </div>

        {/* right column */}
        <div className="space-y-4">
          {/* next follow-up */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlarmClock className="h-4 w-4 text-amber-600" /> Next follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* waiting-for derived line */}
              <div className={cn('rounded-lg border p-3 text-sm', nextOverdue ? 'border-amber-200 bg-amber-50/60' : 'bg-muted/30')}>
                {nextFu ? (
                  <div>
                    <p className="font-medium">Follow-up scheduled for {fmtDateTime(nextFu)}</p>
                    {nextOverdue && <p className="text-xs text-amber-700 mt-0.5">Overdue — it might be time to nudge them.</p>}
                  </div>
                ) : lead.stage === 'AWAITING_REPLY' ? (
                  <p className="font-medium flex items-center gap-2"><Hourglass className="h-4 w-4 text-amber-600" /> Waiting for their reply</p>
                ) : (
                  <div>
                    <p className="text-muted-foreground">Nothing scheduled — schedule a follow-up.</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setScheduleOpen(true)}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Schedule follow-up
                    </Button>
                  </div>
                )}
              </div>

              {/* active follow-ups */}
              {activeFu.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active follow-ups for this lead.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeFu.map((f: FollowUp) => (
                    <div key={f.id} className="rounded-lg border px-2.5 py-2 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{f.title}</p>
                          <p className={cn('text-[11px] mt-0.5', followUpStatusKey(f) === 'OVERDUE' ? 'text-rose-600 font-medium' : 'text-muted-foreground')}>
                            {fmtDateTime(f.dueDate)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge map={METHODS} value={f.method} size="sm" />
                          <StatusBadge map={FOLLOWUP_STATUS} value={followUpStatusKey(f)} size="sm" />
                        </div>
                      </div>
                      {f.reason && <p className="text-[11px] text-muted-foreground line-clamp-2">{f.reason}</p>}
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => completeFollowUp(f)}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </Button>
                        <ReschedulePopover followUp={f} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* related */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Related</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Pitches ({pitches.length})</p>
                {pitches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No pitches yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {pitches.map((p: Pitch) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{p.title}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDate(p.date)}{p.link ? ' · has link' : ''}</p>
                        </div>
                        <StatusBadge map={PITCH_STATUS} value={p.status} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Meetings ({meetings.length})</p>
                {meetings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No meetings yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {meetings.map((m: Meeting) => (
                      <button
                        key={m.id}
                        onClick={() => navigate(`#/meetings?selected=${m.id}`)}
                        className="w-full text-left flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{m.title}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDateTime(m.dateTime)}</p>
                        </div>
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Contacts ({contacts.length})</p>
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contacts saved yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {contacts.map((c: Contact) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.role || c.company || '—'}</p>
                        </div>
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-emerald-600 shrink-0" aria-label={`Email ${c.name}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* files */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Files</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentSection entityType="LEAD" entityId={lead.id} attachments={lead.attachments} />
            </CardContent>
          </Card>

          {/* outreach history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                Outreach history
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOutreachOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Log
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outreaches.length === 0 ? (
                <p className="text-xs text-muted-foreground">No outreach yet — log the first touchpoint.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {outreaches.map((o: Outreach) => {
                    const Icon = CHANNEL_ICONS[o.channel] || Globe
                    return (
                      <div key={o.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{metaOf(OUTREACH_CHANNELS, o.channel).label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {fmtDate(o.date)}{o.user ? ` · ${o.user.name}` : ''}
                          </p>
                        </div>
                        <StatusBadge map={OUTREACH_STATUS} value={o.status} size="sm" />
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
