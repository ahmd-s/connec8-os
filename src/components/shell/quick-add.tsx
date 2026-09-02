'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi, QuickAddType } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users, BookUser, Send, AlarmClock, CalendarDays, Presentation,
  FolderKanban, Package, Wrench, Briefcase, CheckSquare, StickyNote, Loader2, Plus,
} from 'lucide-react'

const TYPES: { key: QuickAddType; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { key: 'lead', label: 'Lead', icon: Users, hint: 'Agency opportunity' },
  { key: 'contact', label: 'Contact', icon: BookUser, hint: 'A person' },
  { key: 'outreach', label: 'Outreach', icon: Send, hint: 'Contact attempt' },
  { key: 'followup', label: 'Follow-up', icon: AlarmClock, hint: 'Never forget one' },
  { key: 'meeting', label: 'Meeting', icon: CalendarDays, hint: 'Log a meeting' },
  { key: 'pitch', label: 'Pitch', icon: Presentation, hint: 'Concept / proposal' },
  { key: 'project', label: 'Project', icon: FolderKanban, hint: 'Client or internal' },
  { key: 'product', label: 'SaaS Product', icon: Package, hint: 'Product workspace' },
  { key: 'feature', label: 'Feature', icon: Wrench, hint: 'For a SaaS product' },
  { key: 'client', label: 'Client', icon: Briefcase, hint: 'Agency client' },
  { key: 'task', label: 'Task', icon: CheckSquare, hint: 'For a project' },
  { key: 'note', label: 'Note', icon: StickyNote, hint: 'Knowledge & ideas' },
]

const inputCls = 'bg-background'

export function QuickAdd() {
  const { quickAddOpen, quickAddType, closeQuickAdd } = useUi()
  const qc = useQueryClient()
  const [type, setType] = useState<QuickAddType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  // reference lists
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => api.list('leads'), enabled: quickAddOpen })
  const { data: saasLeads } = useQuery({ queryKey: ['saas-leads'], queryFn: () => api.list('saas-leads'), enabled: quickAddOpen })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.list('products'), enabled: quickAddOpen })
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => api.list('projects'), enabled: quickAddOpen })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.list('clients'), enabled: quickAddOpen })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list('users'), enabled: quickAddOpen })

  const effectiveType = type || quickAddType

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const open = (t: QuickAddType) => { setType(t); setForm({}) }

  const submit = async () => {
    if (!effectiveType) return
    setSaving(true)
    try {
      const payload = buildPayload(effectiveType, form)
      const entityKey: Record<QuickAddType, string> = {
        lead: 'leads', contact: 'contacts', outreach: 'outreach', followup: 'followups',
        meeting: 'meetings', pitch: 'pitches', project: 'projects', product: 'products',
        feature: 'features', client: 'clients', task: 'tasks', note: 'knowledge',
      }
      await api.create(entityKey[effectiveType], payload)
      toast.success(`${TYPES.find((t) => t.key === effectiveType)?.label} added`)
      qc.invalidateQueries()
      closeQuickAdd(); setType(null); setForm({})
    } catch (e: any) {
      toast.error(e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={quickAddOpen} onOpenChange={(o) => { if (!o) { closeQuickAdd(); setType(null); setForm({}) } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-600" /> Quick add</DialogTitle>
          <DialogDescription>Capture first, organize later — details can be filled in on its page.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* type picker */}
          <div className="sm:w-52 shrink-0 border-r p-3 overflow-y-auto max-h-40 sm:max-h-none">
            <div className="grid grid-cols-3 sm:grid-cols-1 gap-1">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => open(t.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                    effectiveType === t.key ? 'bg-zinc-900 text-white' : 'hover:bg-muted'
                  )}
                >
                  <t.icon className={cn('h-4 w-4 shrink-0', effectiveType === t.key ? 'text-emerald-400' : 'text-muted-foreground')} />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* form */}
          <div className="flex-1 min-w-0 overflow-y-auto p-5">
            {!effectiveType ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <Plus className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">What are you capturing?</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Pick a type on the left. Most things take under a minute.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3.5" key={effectiveType}>
                {formFor(effectiveType, form, set, { leads, saasLeads, products, projects, clients, users })}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { closeQuickAdd(); setType(null); setForm({}) }}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Add {TYPES.find((t) => t.key === effectiveType)?.label.toLowerCase()}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Refs = {
  leads?: any[]; saasLeads?: any[]; products?: any[]; projects?: any[]; clients?: any[]; users?: any[]
}

function buildPayload(t: QuickAddType, f: Record<string, string>): any {
  const p: any = { ...f }
  if (t === 'lead' && !p.stage) p.stage = 'LEAD_FOUND'
  if (t === 'lead' && !p.priority) p.priority = 'MEDIUM'
  if (t === 'outreach') { p.mode = p.channel === 'VISIT' ? 'OFFLINE' : 'ONLINE'; if (!p.status) p.status = 'SENT' }
  if (t === 'followup') { p.status = 'UPCOMING' }
  if (t === 'pitch' && !p.status) p.status = 'DRAFT'
  if (t === 'feature' && !p.priority) p.priority = 'MEDIUM'
  if (t === 'project' && !p.status) p.status = 'PLANNING'
  if (t === 'task' && !p.status) p.status = 'TODO'
  if (t === 'note') { p.category = p.category || 'GENERAL' }
  if (t === 'product') p.accent = '#0d9488'
  // numeric
  if (t === 'project' && p.budget) p.budget = Number(p.budget)
  return p
}

function formFor(t: QuickAddType, f: Record<string, string>, set: (k: string, v: string) => void, refs: Refs) {
  const F = ({ children }: { children: React.ReactNode }) => <div className="space-y-1.5">{children}</div>
  const L = ({ children }: { children: React.ReactNode }) => <Label className="text-xs text-muted-foreground">{children}</Label>
  const relLead = (
    <F><L>Related lead (optional)</L>
      <Select value={f.leadId || 'none'} onValueChange={(v) => set('leadId', v === 'none' ? '' : v)}>
        <SelectTrigger className={inputCls}><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {(refs.leads || []).map((l) => <SelectItem key={l.id} value={l.id}>{l.businessName}</SelectItem>)}
        </SelectContent>
      </Select>
    </F>
  )
  const relProduct = (
    <F><L>Product</L>
      <Select value={f.productId || ''} onValueChange={(v) => set('productId', v)}>
        <SelectTrigger className={inputCls}><SelectValue placeholder="Select product" /></SelectTrigger>
        <SelectContent>
          {(refs.products || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </F>
  )

  switch (t) {
    case 'lead': return (
      <>
        <F><L>Business name *</L><Input autoFocus required className={inputCls} value={f.businessName || ''} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Bloom & Co Furniture" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Contact person</L><Input className={inputCls} value={f.contactPerson || ''} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Name" /></F>
          <F><L>Source</L>
            <Select value={f.source || 'OTHER'} onValueChange={(v) => set('source', v)}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOGLE_MAPS">Google Maps</SelectItem><SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                <SelectItem value="REFERRAL">Referral</SelectItem><SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="WALK_IN">Walk-in</SelectItem><SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="REDDIT">Reddit</SelectItem><SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        <F><L>Why did we target them?</L><Textarea className={inputCls} value={f.whyTargeted || ''} onChange={(e) => set('whyTargeted', e.target.value)} placeholder="e.g. Ranks high on Google but website is outdated…" /></F>
      </>
    )
    case 'contact': return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Name *</L><Input autoFocus required className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></F>
          <F><L>Company</L><Input className={inputCls} value={f.company || ''} onChange={(e) => set('company', e.target.value)} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Email</L><Input type="email" className={inputCls} value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></F>
          <F><L>Phone</L><Input className={inputCls} value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></F>
        </div>
      </>
    )
    case 'outreach': return (
      <>
        <F><L>Channel</L>
          <Select value={f.channel || 'COLD_EMAIL'} onValueChange={(v) => set('channel', v)}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COLD_EMAIL">Cold Email</SelectItem><SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem><SelectItem value="INSTAGRAM">Instagram</SelectItem>
              <SelectItem value="REDDIT">Reddit</SelectItem><SelectItem value="PHONE">Phone Call</SelectItem>
              <SelectItem value="REFERRAL">Referral</SelectItem><SelectItem value="VISIT">Physical Visit</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </F>
        {relLead}
        <F><L>Message / what was sent</L><Textarea className={inputCls} value={f.message || ''} onChange={(e) => set('message', e.target.value)} placeholder="What did you send or say?" /></F>
      </>
    )
    case 'followup': return (
      <>
        <F><L>What needs to happen? *</L><Input autoFocus required className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Send pricing to ABC Dental" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F><L>When *</L><Input required type="datetime-local" className={inputCls} value={f.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} /></F>
          <F><L>Method</L>
            <Select value={f.method || 'EMAIL'} onValueChange={(v) => set('method', v)}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">Email</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="PHONE">Phone</SelectItem><SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                <SelectItem value="VISIT">Visit</SelectItem><SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="DEMO">Demo</SelectItem><SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </div>
        {relLead}
      </>
    )
    case 'meeting': return (
      <>
        <F><L>Title *</L><Input autoFocus required className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Bloom & Co — design review" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F><L>When *</L><Input required type="datetime-local" className={inputCls} value={f.dateTime || ''} onChange={(e) => set('dateTime', e.target.value)} /></F>
          <F><L>Purpose</L><Input className={inputCls} value={f.purpose || ''} onChange={(e) => set('purpose', e.target.value)} /></F>
        </div>
      </>
    )
    case 'pitch': return (
      <>
        <F><L>Pitch title *</L><Input autoFocus required className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Bloom & Co — Luxury Catalogue Website" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Type</L>
            <Select value={f.type || 'WEBSITE_CONCEPT'} onValueChange={(v) => set('type', v)}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WEBSITE_CONCEPT">Website Concept</SelectItem><SelectItem value="WEBSITE_REDESIGN">Website Redesign</SelectItem>
                <SelectItem value="SOFTWARE_IDEA">Software Idea</SelectItem><SelectItem value="AI_SOLUTION">AI Solution</SelectItem>
                <SelectItem value="LANDING_PAGE">Landing Page</SelectItem><SelectItem value="PRESENTATION">Presentation</SelectItem>
                <SelectItem value="PROPOSAL">Proposal</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F><L>Link (Figma / Doc)</L><Input className={inputCls} value={f.link || ''} onChange={(e) => set('link', e.target.value)} placeholder="https://" /></F>
        </div>
        {relLead}
      </>
    )
    case 'project': return (
      <>
        <F><L>Project name *</L><Input autoFocus required className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Client (optional)</L>
            <Select value={f.clientId || 'none'} onValueChange={(v) => set('clientId', v === 'none' ? '' : v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (internal)</SelectItem>
                {(refs.clients || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F><L>Deadline</L><Input type="date" className={inputCls} value={f.deadline || ''} onChange={(e) => set('deadline', e.target.value)} /></F>
        </div>
      </>
    )
    case 'product': return (
      <>
        <F><L>Product name *</L><Input autoFocus required className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. DentOS" /></F>
        <F><L>Tagline</L><Input className={inputCls} value={f.tagline || ''} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Practice management for dental clinics" /></F>
      </>
    )
    case 'feature': return (
      <>
        <F><L>Feature name *</L><Input autoFocus required className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></F>
        {relProduct}
        <F><L>Why it matters</L><Textarea className={inputCls} value={f.whyItMatters || ''} onChange={(e) => set('whyItMatters', e.target.value)} placeholder="The future-you will thank you for this context" /></F>
      </>
    )
    case 'client': return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <F><L>Client name *</L><Input autoFocus required className={inputCls} value={f.name || ''} onChange={(e) => set('name', e.target.value)} /></F>
          <F><L>Industry</L><Input className={inputCls} value={f.industry || ''} onChange={(e) => set('industry', e.target.value)} /></F>
        </div>
        <F><L>Contact person</L><Input className={inputCls} value={f.contactPerson || ''} onChange={(e) => set('contactPerson', e.target.value)} /></F>
      </>
    )
    case 'task': return (
      <>
        <F><L>Task *</L><Input autoFocus required className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></F>
        <F><L>Project *</L>
          <Select value={f.projectId || ''} onValueChange={(v) => set('projectId', v)}>
            <SelectTrigger className={inputCls}><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {(refs.projects || []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
      </>
    )
    case 'note': return (
      <>
        <F><L>Title *</L><Input autoFocus required className={inputCls} value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></F>
        <F><L>Content *</L><Textarea required className={inputCls} minRows={4} value={f.content || ''} onChange={(e) => set('content', e.target.value)} placeholder="Research, ideas, decisions, discoveries…" /></F>
        <F><L>Category</L>
          <Select value={f.category || 'GENERAL'} onValueChange={(v) => set('category', v)}>
            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RESEARCH">Research</SelectItem><SelectItem value="IDEA">Idea</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem><SelectItem value="COMPETITOR">Competitor</SelectItem>
              <SelectItem value="SALES">Sales</SelectItem><SelectItem value="TECHNICAL">Technical</SelectItem>
              <SelectItem value="RESOURCE">Resource</SelectItem><SelectItem value="DECISION">Decision</SelectItem>
              <SelectItem value="GENERAL">General</SelectItem>
            </SelectContent>
          </Select>
        </F>
      </>
    )
    default: return null
  }
}
