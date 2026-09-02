'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import {
  Activity, FollowUp, FunnelStep, KnowledgeItem, Outreach, Pitch, SaasClient, SaasFeature,
  SaasLead, SaasProduct, User,
} from '@/lib/types'
import {
  CLIENT_STATUS, EFFORT_WEIGHT, FEATURE_STATUS, FEATURE_STATUS_ORDER, FOLLOWUP_STATUS,
  KNOWLEDGE_CATEGORIES, METHODS, OUTREACH_CHANNELS, OUTREACH_STATUS, PITCH_STATUS, PITCH_TYPES,
  PRIORITY, SAAS_FUNNEL_ORDER, SAAS_FUNNEL_STAGES, WHY_NOT_COMPLETED, EnumMeta, metaOf,
  parseJsonArray,
} from '@/lib/labels'
import { avatarColor, fmtDate, fmtDateTime, fmtRelative, initials, isOverdue } from '@/lib/format'
import { cn } from '@/lib/utils'

import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Timeline } from '@/components/shared/timeline'
import { ActivityComposer } from '@/components/shared/activity-composer'
import { AttachmentSection } from '@/components/shared/attachment-section'
import { FunnelBars } from '@/components/shared/funnel-bars'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  AlarmClock, AlertTriangle, ArrowLeft, ArrowRight, Briefcase, Building2, CalendarPlus,
  CheckCircle2, ExternalLink, Globe, History, Layers, Loader2, Mail, MapPin, Package, Phone,
  Pin, Plus, Presentation, Quote, Send, Sparkles, StickyNote, Trash2, TrendingDown,
  User as UserIcon, Users, Wrench,
} from 'lucide-react'

/* ══════════════════════════════ shared bits ══════════════════════════════ */

const ACCENTS = ['#0d9488', '#059669', '#d97706', '#e11d48', '#0891b2']

const PRODUCT_STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  PAUSED: 'bg-amber-500',
  ARCHIVED: 'bg-zinc-400',
}

const PLAN_META: Record<string, EnumMeta> = {
  TRIAL: { label: 'Trial', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  BASIC: { label: 'Basic', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  PRO: { label: 'Pro', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  ANNUAL: { label: 'Annual', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const ONBOARDING_META: Record<string, EnumMeta> = {
  NOT_STARTED: { label: 'Not started', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  IN_PROGRESS: { label: 'Onboarding', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Onboarded', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const INTEREST_META: Record<string, EnumMeta> = {
  YES: { label: 'Interested', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MAYBE: { label: 'Maybe', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  NO: { label: 'Not interested', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const ORIGIN_META: Record<string, EnumMeta> = {
  ONLINE: { label: 'Online', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  OFFLINE: { label: 'Offline', color: 'bg-orange-50 text-orange-700 border-orange-200' },
}

/** Product list rows carry server-computed stats (progress, counts, last activity). */
interface ProductWithStats extends SaasProduct {
  stats?: {
    progress: number
    features: number
    byStatus: Record<string, number>
    leads: number
    clients: number
    lastActivityAt: string
  }
}

/** Product detail payload bundles the whole workspace (relations beyond the base type). */
type ProductDetail = SaasProduct & {
  followUps?: FollowUp[]
  outreaches?: Outreach[]
  pitches?: Pitch[]
  knowledge?: KnowledgeItem[]
}

const EMERALD_BTN = 'bg-emerald-600 hover:bg-emerald-700 text-white'

const SCROLL_Y =
  'max-h-[36rem] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent'

const SCROLL_SM =
  'max-h-36 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent'

function nowLocalInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Weighted build progress: completed weight / weight of non-rejected features. */
function weightedProgress(features: SaasFeature[]): number {
  const active = (features || []).filter((f) => f.status !== 'REJECTED')
  const total = active.reduce((s, f) => s + (f.weight || 3), 0)
  if (!total) return 0
  const done = active.filter((f) => f.status === 'COMPLETED').reduce((s, f) => s + (f.weight || 3), 0)
  return Math.round((done / total) * 100)
}

function effortChip(f: SaasFeature): string {
  if (f.effort) return `${f.effort} · ${EFFORT_WEIGHT[f.effort] ?? f.weight}pt`
  return `${f.weight}pt`
}

function fuDerived(f: FollowUp): 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' {
  const d = new Date(f.dueDate)
  const now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  if (isOverdue(f.dueDate) && d.getTime() < day(now)) return 'OVERDUE'
  if (day(d) === day(now)) return 'DUE_TODAY'
  return 'UPCOMING'
}

function channelToActivityType(channel: string): string {
  switch (channel) {
    case 'COLD_EMAIL': return 'EMAIL_SENT'
    case 'WHATSAPP': return 'WHATSAPP_SENT'
    case 'LINKEDIN': return 'LINKEDIN_SENT'
    case 'PHONE': return 'CALL'
    case 'VISIT': return 'VISIT_LOGGED'
    default: return 'OUTREACH'
  }
}

function MiniAvatar({ name }: { name?: string | null }) {
  if (!name) return null
  return (
    <Avatar className="h-5 w-5">
      <AvatarFallback style={{ background: avatarColor(name) }} className="text-[8px] text-white">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap',
        active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted border'
      )}
    >
      {children}
    </button>
  )
}

function F({ label, required, hint, children, className }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionTitle({ icon: Icon, children, right }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {children}
      </p>
      {right}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 text-xs min-w-0">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  )
}

/** Editable labelled textarea with inline save — used in detail dialogs. */
function FieldEditor({ label, value, onSave, hint, placeholder, rows = 3 }: {
  label: string
  value?: string | null
  onSave: (v: string) => Promise<void>
  hint?: string
  placeholder?: string
  rows?: number
}) {
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setVal(value ?? '') }, [value])
  const dirty = val !== (value ?? '')
  const save = async () => {
    setSaving(true)
    try { await onSave(val) } finally { setSaving(false) }
  }
  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {dirty && (
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Save
          </Button>
        )}
      </div>
      <Textarea
        value={val}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        className="min-h-[52px] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* ══════════════════════════════ Products list ══════════════════════════════ */

export function ProductsView() {
  const { navigate, query } = useHashRoute()
  const [newOpen, setNewOpen] = useState(false)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.list<ProductWithStats>('products'),
  })

  // Notifications/search link to #/products?lead=… — resolve the product and hop to its workspace.
  const qstr = query.toString()
  useEffect(() => {
    if (!qstr) return
    const p = new URLSearchParams(qstr)
    const key = ['lead', 'feature', 'client'].find((k) => p.get(k))
    if (!key) return
    const eid = p.get(key)!
    const entity = key === 'lead' ? 'saas-leads' : key === 'feature' ? 'features' : 'saas-clients'
    let alive = true
    api.get<any>(entity, eid)
      .then((row) => {
        if (alive && row?.productId) navigate(`#/products/${row.productId}?${key}=${eid}`)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [qstr, navigate])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & SaaS"
        description="Connec8's own products — each one gets a complete dedicated workspace: features, leads, outreach, follow-ups, clients and knowledge."
        actions={
          <Button onClick={() => setNewOpen(true)} className={EMERALD_BTN}>
            <Plus className="h-4 w-4" /> New product
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : !products?.length ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Create your first SaaS product — it immediately gets its own workspace inside the OS."
          action={<Button className={EMERALD_BTN} onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New product</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} onOpen={() => navigate(`#/products/${p.id}`)} />)}
        </div>
      )}

      <NewProductDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function ProductCard({ product: p, onOpen }: { product: ProductWithStats; onOpen: () => void }) {
  const s = p.stats
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-xl border bg-card p-5 flex flex-col gap-3 hover:border-emerald-300 hover:shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0 border border-black/10" style={{ background: p.accent || '#0d9488' }} />
          <p className="text-lg font-semibold leading-tight truncate">{p.name}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span className={cn('h-1.5 w-1.5 rounded-full', PRODUCT_STATUS_DOT[p.status] || 'bg-zinc-400')} />
          {p.status.toLowerCase()}
        </span>
      </div>
      {p.tagline && <p className="text-sm text-muted-foreground line-clamp-2">{p.tagline}</p>}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Build progress (weighted)</span>
          <span className="text-sm font-semibold tabular-nums">{s?.progress ?? 0}%</span>
        </div>
        <Progress value={s?.progress ?? 0} className="h-2" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{s?.features ?? 0} features</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s?.leads ?? 0} leads</span>
        <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{s?.clients ?? 0} clients</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2.5 mt-auto">
        <span>Last activity {fmtRelative(s?.lastActivityAt)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
      </div>
    </button>
  )
}

const PRODUCT_DEFAULTS = { name: '', tagline: '', description: '', accent: ACCENTS[0] }

function NewProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(PRODUCT_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setForm(PRODUCT_DEFAULTS) }, [open])

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Give the product a name'); return }
    setSaving(true)
    try {
      await api.create('products', { ...form, name: form.name.trim(), status: 'ACTIVE' })
      toast.success('Product created')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create product')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>Every SaaS gets a complete dedicated workspace the moment it exists.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <F label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DentOS" autoFocus />
          </F>
          <F label="Tagline">
            <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="One line on what it is" />
          </F>
          <F label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Who it's for, what it does, where it's going…" rows={3} />
          </F>
          <F label="Accent color">
            <div className="flex items-center gap-2 pt-1">
              {ACCENTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Accent ${hex}`}
                  onClick={() => setForm({ ...form, accent: hex })}
                  className={cn(
                    'h-7 w-7 rounded-full border transition-all',
                    form.accent === hex ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'hover:scale-105'
                  )}
                  style={{ background: hex }}
                />
              ))}
            </div>
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create product
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ══════════════════════════════ Product workspace ══════════════════════════════ */

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'features', label: 'Features' },
  { value: 'leads', label: 'Leads' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'followups', label: 'Follow-ups' },
  { value: 'pitches', label: 'Pitches' },
  { value: 'clients', label: 'Clients' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'funnel', label: 'Funnel' },
]

export function ProductWorkspaceView({ id, query }: { id: string; query?: string }) {
  const { navigate } = useHashRoute()
  const [tab, setTab] = useState('overview')

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<ProductDetail>('products', id),
  })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list<User>('users') })

  // Deep links (?lead=<id> ?feature=<id> ?client=<id>) drive the detail dialogs directly
  // from the URL — shareable, back-button friendly, no state syncing needed.
  const deepParams = new URLSearchParams(query)
  const deepLead = deepParams.get('lead')
  const deepFeature = deepParams.get('feature')
  const deepClient = deepParams.get('client')
  const activeTab = deepFeature ? 'features' : deepLead ? 'leads' : deepClient ? 'clients' : tab

  const openFeature = (fid: string) => navigate(`#/products/${id}?feature=${fid}`)
  const closeDeep = (t: string) => { setTab(t); navigate(`#/products/${id}`) }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-9 w-full max-w-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('#/products')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Products
        </button>
        <EmptyState icon={Package} title="Product not found" description="It may have been deleted." />
      </div>
    )
  }

  const features = product.features || []
  const pct = weightedProgress(features)

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('#/products')}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Products
      </button>

      {/* header */}
      <div className="rounded-xl border bg-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="h-3 w-3 rounded-full border border-black/10 shrink-0" style={{ background: product.accent || '#0d9488' }} />
            <h1 className="text-xl font-semibold tracking-tight truncate">{product.name}</h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', PRODUCT_STATUS_DOT[product.status] || 'bg-zinc-400')} />
              {product.status.toLowerCase()}
            </span>
          </div>
          {product.tagline && <p className="text-sm text-muted-foreground mt-1">{product.tagline}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{features.length} features</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{(product.saasLeads || []).length} leads</span>
            <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{(product.saasClients || []).length} clients</span>
            <span>Created {fmtDate(product.createdAt)}</span>
          </div>
        </div>
        <div className="w-full lg:w-64 shrink-0">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Weighted build progress</span>
            <span className="text-lg font-semibold tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Sum of completed feature weights ÷ all non-rejected weights
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex-none h-auto rounded-full border px-3 py-1.5 text-xs font-medium bg-background text-muted-foreground hover:bg-muted data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab product={product} onOpenFeature={openFeature} />
        </TabsContent>
        <TabsContent value="features">
          <FeaturesTab
            productId={id}
            features={features}
            users={users || []}
            onOpenFeature={openFeature}
            openFeatureId={deepFeature}
            onCloseFeature={() => closeDeep('features')}
          />
        </TabsContent>
        <TabsContent value="leads">
          <LeadsTab
            productId={id}
            leads={product.saasLeads || []}
            openLeadId={deepLead}
            onOpenLead={(lid) => navigate(`#/products/${id}?lead=${lid}`)}
            onCloseLead={() => closeDeep('leads')}
          />
        </TabsContent>
        <TabsContent value="outreach">
          <OutreachTab productId={id} outreaches={product.outreaches || []} leads={product.saasLeads || []} />
        </TabsContent>
        <TabsContent value="followups">
          <FollowUpsTab productId={id} bundleFollowUps={product.followUps || []} />
        </TabsContent>
        <TabsContent value="pitches">
          <PitchesTab productId={id} pitches={product.pitches || []} leads={product.saasLeads || []} />
        </TabsContent>
        <TabsContent value="clients">
          <ClientsTab
            productId={id}
            clients={product.saasClients || []}
            leads={product.saasLeads || []}
            features={features}
            openClientId={deepClient}
            onOpenClient={(cid) => navigate(`#/products/${id}?client=${cid}`)}
            onCloseClient={() => closeDeep('clients')}
          />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab productId={id} knowledge={product.knowledge || []} />
        </TabsContent>
        <TabsContent value="funnel">
          <FunnelTab leads={product.saasLeads || []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ══════════════════════════════ Overview ══════════════════════════════ */

function OverviewTab({ product, onOpenFeature }: { product: ProductDetail; onOpenFeature: (fid: string) => void }) {
  const features = product.features || []
  const leads = product.saasLeads || []
  const clients = product.saasClients || []
  const outreaches = product.outreaches || []
  const pendingFu = product.followUps || []

  const { data: activities } = useQuery({
    queryKey: ['activities', 'product', product.id],
    queryFn: () => api.list<Activity>('activities', { productId: product.id }),
  })

  const completed = features.filter((f) => f.status === 'COMPLETED').length
  const inDev = features.filter((f) => f.status === 'IN_DEVELOPMENT').length
  const blocked = features.filter((f) => f.status === 'BLOCKED').length
  const remaining = features.filter((f) => !['COMPLETED', 'REJECTED', 'IN_DEVELOPMENT', 'BLOCKED'].includes(f.status)).length
  const blockedList = features.filter((f) => f.status === 'BLOCKED')

  const atLeast = (stages: string[]) => leads.filter((l) => stages.includes(l.funnelStage)).length
  const visits = outreaches.filter((o) => o.mode === 'OFFLINE').length
  const offlineOrigin = leads.filter((l) => l.origin === 'OFFLINE').length
  const replies = outreaches.filter((o) => ['REPLIED', 'POSITIVE', 'NEGATIVE', 'MEETING_BOOKED'].includes(o.status)).length

  return (
    <div className="space-y-4">
      {/* product stats */}
      <div>
        <SectionTitle icon={Wrench}>Product build</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <StatCard label="Features completed" value={completed} icon={CheckCircle2} tone="good" />
          <StatCard label="In development" value={inDev} icon={Wrench} tone="warn" />
          <StatCard label="Blocked" value={blocked} icon={AlertTriangle} tone={blocked > 0 ? 'bad' : 'default'} />
          <StatCard label="Remaining" value={remaining} icon={Layers} sub="backlog & testing" />
        </div>
      </div>

      {/* business stats */}
      <div>
        <SectionTitle icon={Briefcase}>Business</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <StatCard label="Total leads" value={leads.length} icon={Users} />
          <StatCard
            label="Businesses visited"
            value={visits}
            icon={MapPin}
            tone="accent"
            sub={`latest 20 outreach records · ${offlineOrigin} offline-origin leads overall`}
          />
          <StatCard label="Replies received" value={replies} icon={Send} tone="good" sub="in latest outreach records" />
          <StatCard label="Interested" value={atLeast(['INTERESTED', 'DEMO', 'TRIAL', 'CLIENT'])} icon={Users} />
          <StatCard label="Demos" value={atLeast(['DEMO', 'TRIAL', 'CLIENT'])} icon={Presentation} />
          <StatCard label="Trials" value={atLeast(['TRIAL', 'CLIENT'])} icon={Sparkles} />
          <StatCard label="Clients onboarded" value={clients.length} icon={Briefcase} tone="accent" />
          <StatCard label="Follow-ups pending" value={pendingFu.length} icon={AlarmClock} tone={pendingFu.length > 0 ? 'warn' : 'default'} />
        </div>
      </div>

      {/* blocked features alert */}
      {blockedList.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> Blocked features ({blockedList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {blockedList.map((f) => (
              <button
                key={f.id}
                onClick={() => onOpenFeature(f.id)}
                className="w-full text-left rounded-lg border border-rose-200 bg-background px-3 py-2 hover:border-rose-400 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{f.name}</span>
                  {f.whyNotCompleted && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      Why? {WHY_NOT_COMPLETED[f.whyNotCompleted] || f.whyNotCompleted.replaceAll('_', ' ').toLowerCase()}
                    </span>
                  )}
                </div>
                {f.blockingDetail && <p className="text-xs text-muted-foreground mt-0.5">{f.blockingDetail}</p>}
                {f.nextStep && <p className="text-xs text-emerald-700 mt-0.5">Next: {f.nextStep}</p>}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-teal-600" /> Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline activities={(activities || []).slice(0, 8)} />
        </CardContent>
      </Card>
    </div>
  )
}

/* ══════════════════════════════ Features ══════════════════════════════ */

const FEATURE_DEFAULTS = {
  name: '', description: '', whyItMatters: '', area: '',
  priority: 'MEDIUM', effort: 'M', dependencies: '', assigneeId: '',
}

function FeaturesTab({ productId, features, users, onOpenFeature, openFeatureId, onCloseFeature }: {
  productId: string
  features: SaasFeature[]
  users: User[]
  onOpenFeature: (fid: string) => void
  openFeatureId: string | null
  onCloseFeature: () => void
}) {
  const [filter, setFilter] = useState('ALL')
  const [newOpen, setNewOpen] = useState(false)

  const counts: Record<string, number> = {}
  features.forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1 })

  const activeStatuses = FEATURE_STATUS_ORDER.filter((s) => (counts[s] || 0) > 0)
  const groups = filter === 'ALL'
    ? activeStatuses.map((st) => ({ status: st, items: features.filter((f) => f.status === st) }))
    : [{ status: filter, items: features.filter((f) => f.status === filter) }]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill active={filter === 'ALL'} onClick={() => setFilter('ALL')}>All · {features.length}</Pill>
        {activeStatuses.map((st) => (
          <Pill key={st} active={filter === st} onClick={() => setFilter(st)}>
            {metaOf(FEATURE_STATUS, st).label} · {counts[st]}
          </Pill>
        ))}
        <Button size="sm" className={cn(EMERALD_BTN, 'ml-auto')} onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New feature
        </Button>
      </div>

      {features.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No features yet"
          description="Track everything this product should do — the roadmap doubles as a weighted progress meter."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> New feature</Button>}
        />
      ) : (
        <div className={SCROLL_Y + ' space-y-5'}>
          {groups.map((g) => (
            <div key={g.status}>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge map={FEATURE_STATUS} value={g.status} />
                <span className="text-xs text-muted-foreground tabular-nums">{g.items.length}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-1.5">
                {g.items.map((f) => <FeatureRow key={f.id} feature={f} onOpenFeature={onOpenFeature} />)}
              </div>
            </div>
          ))}
          {filter !== 'ALL' && groups[0]?.items.length === 0 && (
            <EmptyState icon={Wrench} title={`No ${metaOf(FEATURE_STATUS, filter).label.toLowerCase()} features`} />
          )}
        </div>
      )}

      <NewFeatureDialog open={newOpen} onClose={() => setNewOpen(false)} productId={productId} users={users} />
      <FeatureDetailDialog featureId={openFeatureId} bundle={features.find((x) => x.id === openFeatureId)} users={users} onClose={onCloseFeature} />
    </div>
  )
}

function FeatureRow({ feature: f, onOpenFeature }: { feature: SaasFeature; onOpenFeature: (fid: string) => void }) {
  return (
    <button
      onClick={() => onOpenFeature(f.id)}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3',
        f.status === 'BLOCKED' && 'border-l-4 border-l-rose-500 bg-rose-50/30'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium truncate">{f.name}</span>
          {f.area && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">{f.area}</span>
          )}
          {f.status === 'BLOCKED' && f.whyNotCompleted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-medium">
              Why? {WHY_NOT_COMPLETED[f.whyNotCompleted] || f.whyNotCompleted.replaceAll('_', ' ').toLowerCase()}
            </span>
          )}
        </div>
        {f.dependencies && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Depends on: {f.dependencies}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge map={PRIORITY} value={f.priority} size="sm" />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{effortChip(f)}</span>
        <MiniAvatar name={f.assignee?.name} />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden md:inline">{fmtDate(f.dateAdded, 'MMM d')}</span>
      </div>
    </button>
  )
}

function NewFeatureDialog({ open, onClose, productId, users }: { open: boolean; onClose: () => void; productId: string; users: User[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(FEATURE_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setForm(FEATURE_DEFAULTS) }, [open])

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Name the feature'); return }
    setSaving(true)
    try {
      await api.create('features', {
        productId,
        name: form.name.trim(),
        description: form.description,
        whyItMatters: form.whyItMatters,
        area: form.area,
        priority: form.priority,
        effort: form.effort,
        weight: EFFORT_WEIGHT[form.effort] ?? 3,
        dependencies: form.dependencies,
        assigneeId: form.assigneeId || undefined,
      })
      toast.success('Feature added to the roadmap')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create feature')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New feature</DialogTitle>
          <DialogDescription>Effort sets the feature&apos;s weight in the progress meter (XS 1pt → XL 8pt).</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Recall reminders" autoFocus />
          </F>
          <F label="What does it do?" className="sm:col-span-2">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </F>
          <F label="Why does it matter?" className="sm:col-span-2">
            <Textarea value={form.whyItMatters} onChange={(e) => setForm({ ...form, whyItMatters: e.target.value })} rows={2} placeholder="The business reason — useful when you come back weeks later." />
          </F>
          <F label="Area">
            <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Appointments, Billing…" />
          </F>
          <F label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                <SelectItem key={p} value={p}>{metaOf(PRIORITY, p).label}</SelectItem>
              ))}</SelectContent>
            </Select>
          </F>
          <F label="Effort">
            <Select value={form.effort} onValueChange={(v) => setForm({ ...form, effort: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(EFFORT_WEIGHT).map((e) => (
                <SelectItem key={e} value={e}>{e} · {EFFORT_WEIGHT[e]}pt</SelectItem>
              ))}</SelectContent>
            </Select>
          </F>
          <F label="Depends on">
            <Input value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: e.target.value })} placeholder="Other features, third parties…" />
          </F>
          <F label="Assignee" className="sm:col-span-2">
            <Select value={form.assigneeId || 'UNASSIGNED'} onValueChange={(v) => setForm({ ...form, assigneeId: v === 'UNASSIGNED' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add feature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FeatureDetailDialog({ featureId, bundle, users, onClose }: {
  featureId: string | null
  bundle?: SaasFeature
  users: User[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: fetched } = useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => api.get<SaasFeature>('features', featureId!),
    enabled: !!featureId,
  })
  const f = fetched || bundle

  const patch = async (data: Record<string, unknown>) => {
    if (!f) return
    try {
      await api.update('features', f.id, data)
      toast.success('Feature updated')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
  }

  const del = async () => {
    if (!f) return
    try {
      await api.remove('features', f.id)
      toast.success('Feature deleted')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete')
    }
  }

  return (
    <Dialog open={!!featureId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {!f ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {f.name}
                <StatusBadge map={FEATURE_STATUS} value={f.status} size="sm" />
                {f.area && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">{f.area}</span>}
              </DialogTitle>
              <DialogDescription>Added {fmtDate(f.dateAdded)}{f.completedAt ? ` · completed ${fmtDate(f.completedAt)}` : ''}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {(f.description || f.whyItMatters) && (
                <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                  {f.description && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">What it does</p>
                      <p className="text-sm whitespace-pre-wrap">{f.description}</p>
                    </div>
                  )}
                  {f.whyItMatters && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Why it matters
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{f.whyItMatters}</p>
                    </div>
                  )}
                </div>
              )}

              {/* quick controls — patch immediately */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <F label="Status">
                  <Select value={f.status} onValueChange={(v) => patch({ status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FEATURE_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{metaOf(FEATURE_STATUS, s).label}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
                <F label="Priority">
                  <Select value={f.priority} onValueChange={(v) => patch({ priority: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                      <SelectItem key={p} value={p}>{metaOf(PRIORITY, p).label}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
                <F label="Effort">
                  <Select value={f.effort || 'M'} onValueChange={(v) => patch({ effort: v, weight: EFFORT_WEIGHT[v] ?? 3 })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(EFFORT_WEIGHT).map((e) => (
                      <SelectItem key={e} value={e}>{e} · {EFFORT_WEIGHT[e]}pt</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
                <F label="Assignee">
                  <Select value={f.assigneeId || 'UNASSIGNED'} onValueChange={(v) => patch({ assigneeId: v === 'UNASSIGNED' ? '' : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
              </div>

              {f.status !== 'COMPLETED' && f.status !== 'REJECTED' && (
                <WhySection key={f.id} feature={f} onSave={patch} />
              )}

              {f.dependencies && (
                <InfoRow icon={AlertTriangle} label="Depends on" value={f.dependencies} />
              )}

              <FieldEditor
                label="Notes"
                value={f.notes}
                onSave={async (v) => patch({ notes: v })}
                placeholder="Internal notes, links, context…"
                rows={2}
              />

              <AttachmentSection entityType="SAAS_FEATURE" entityId={f.id} attachments={f.attachments} />

              <div className="flex justify-end border-t pt-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" /> Delete feature
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{f.name}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the feature and its attachments permanently. Weighted progress is recalculated.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white" onClick={del}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function WhySection({ feature: f, onSave }: { feature: SaasFeature; onSave: (data: Record<string, unknown>) => Promise<void> }) {
  const [why, setWhy] = useState(f.whyNotCompleted || 'UNSET')
  const [detail, setDetail] = useState(f.blockingDetail || '')
  const [nextStep, setNextStep] = useState(f.nextStep || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ whyNotCompleted: why === 'UNSET' ? '' : why, blockingDetail: detail, nextStep })
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-3">
      <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" /> Why is this not built yet?
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <F label="Reason" className="sm:col-span-2">
          <Select value={why} onValueChange={setWhy}>
            <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Select a reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UNSET">Not set</SelectItem>
              {Object.entries(WHY_NOT_COMPLETED).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="What exactly is blocking it?" className="sm:col-span-2">
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} className="bg-background" placeholder="Be specific — future-you will thank present-you." />
        </F>
        <F label="Next step to unblock" className="sm:col-span-2">
          <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} className="bg-background" placeholder="One concrete action" />
        </F>
      </div>
      <div className="flex justify-end">
        <Button size="sm" className={EMERALD_BTN} onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  )
}

/* ══════════════════════════════ Leads ══════════════════════════════ */

const LEAD_DEFAULTS = {
  businessName: '', location: '', contactPerson: '', role: '', phone: '', email: '',
  origin: 'OFFLINE', notes: '',
}

const SAY_SECTIONS: { field: string; label: string; hint?: string; placeholder?: string }[] = [
  { field: 'requirements', label: 'Requirements', placeholder: 'What they need, in their words.' },
  { field: 'problems', label: 'Problems', hint: 'One problem per line — saved as a list.', placeholder: 'Long queue at reception…' },
  { field: 'featuresRequested', label: 'Features requested' },
  { field: 'objections', label: 'Objections', placeholder: 'Price, timing, trust…' },
  { field: 'feedback', label: 'Feedback' },
  { field: 'questions', label: 'Questions' },
  { field: 'importantStatements', label: 'Important statements', placeholder: 'Quotes worth remembering.' },
  { field: 'notes', label: 'Notes' },
]

function LeadsTab({ productId, leads, openLeadId, onOpenLead, onCloseLead }: {
  productId: string
  leads: SaasLead[]
  openLeadId: string | null
  onOpenLead: (id: string) => void
  onCloseLead: () => void
}) {
  const [origin, setOrigin] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL')
  const [stage, setStage] = useState('ALL')
  const [newOpen, setNewOpen] = useState(false)

  const filtered = leads
    .filter((l) => origin === 'ALL' || l.origin === origin)
    .filter((l) => stage === 'ALL' || l.funnelStage === stage)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill active={origin === 'ALL'} onClick={() => setOrigin('ALL')}>All · {leads.length}</Pill>
        <Pill active={origin === 'ONLINE'} onClick={() => setOrigin('ONLINE')}>Online · {leads.filter((l) => l.origin === 'ONLINE').length}</Pill>
        <Pill active={origin === 'OFFLINE'} onClick={() => setOrigin('OFFLINE')}>Offline · {leads.filter((l) => l.origin === 'OFFLINE').length}</Pill>
        <div className="ml-auto flex items-center gap-2">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Funnel stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All stages</SelectItem>
              {[...SAAS_FUNNEL_ORDER, 'LOST'].map((s) => (
                <SelectItem key={s} value={s}>{metaOf(SAAS_FUNNEL_STAGES, s).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New lead
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="Clinics, practices, businesses — every prospect for this product lives here."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> New lead</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No leads match this filter" description="Try a different origin or funnel stage." />
      ) : (
        <div className={cn('grid md:grid-cols-2 gap-3', SCROLL_Y)}>
          {filtered.map((l) => <LeadCard key={l.id} lead={l} onOpenLead={onOpenLead} />)}
        </div>
      )}

      <NewLeadDialog open={newOpen} onClose={() => setNewOpen(false)} productId={productId} />
      <LeadDetailDialog leadId={openLeadId} leads={leads} productId={productId} onClose={onCloseLead} />
    </div>
  )
}

function LeadCard({ lead: l, onOpenLead }: { lead: SaasLead; onOpenLead: (id: string) => void }) {
  const originMeta = metaOf(ORIGIN_META, l.origin)
  return (
    <button
      onClick={() => onOpenLead(l.id)}
      className="text-left rounded-xl border bg-card p-4 space-y-2.5 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{l.businessName}</p>
          {l.location && <p className="text-xs text-muted-foreground truncate">{l.location}</p>}
        </div>
        <StatusBadge map={SAAS_FUNNEL_STAGES} value={l.funnelStage} size="sm" />
      </div>
      {(l.contactPerson || l.role) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <UserIcon className="h-3 w-3" /> {[l.contactPerson, l.role].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-medium', originMeta.color)}>
          {l.origin === 'ONLINE' ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
          {originMeta.label}
        </span>
        {l.interested === 'YES' && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Interested
          </span>
        )}
        {l.interested === 'MAYBE' && (
          <span className="inline-flex items-center gap-1.5 text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Maybe
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
        {l.nextFollowUpAt ? (
          <span className={cn(isOverdue(l.nextFollowUpAt) && 'text-amber-600 font-medium')}>
            Next follow-up {fmtRelative(l.nextFollowUpAt)}
          </span>
        ) : <span>No follow-up scheduled</span>}
        <span>Last activity {fmtRelative(l.lastActivityAt)}</span>
      </div>
    </button>
  )
}

function NewLeadDialog({ open, onClose, productId }: { open: boolean; onClose: () => void; productId: string }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(LEAD_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setForm(LEAD_DEFAULTS) }, [open])

  const submit = async () => {
    if (!form.businessName.trim()) { toast.error('Business name is required'); return }
    setSaving(true)
    try {
      await api.create('saas-leads', { ...form, businessName: form.businessName.trim(), productId })
      toast.success('Lead added')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create lead')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Add a prospect for this product — walk-ins, map searches, referrals, anything.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Business name" required className="sm:col-span-2">
            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} autoFocus />
          </F>
          <F label="Location">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City / area" />
          </F>
          <F label="Origin">
            <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OFFLINE">Offline</SelectItem>
                <SelectItem value="ONLINE">Online</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Contact person">
            <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </F>
          <F label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Owner, manager…" />
          </F>
          <F label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </F>
          <F label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </F>
          <F label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LeadDetailDialog({ leadId, leads, productId, onClose }: {
  leadId: string | null
  leads: SaasLead[]
  productId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: fetched } = useQuery({
    queryKey: ['saas-lead', leadId],
    queryFn: () => api.get<SaasLead>('saas-leads', leadId!),
    enabled: !!leadId,
  })
  const lead = fetched || leads.find((l) => l.id === leadId)
  const [visitOpen, setVisitOpen] = useState(false)
  const [fuOpen, setFuOpen] = useState(false)

  const saveField = (field: string, value: unknown) => async () => {
    try {
      await api.update('saas-leads', leadId!, { [field]: value })
      toast.success('Saved')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
  }

  const history: Activity[] = lead ? [
    ...(lead.followUps || []).map((f) => ({
      id: `fu-${f.id}`, date: f.dueDate,
      type: f.status === 'COMPLETED' ? 'FOLLOW_UP_DONE' : 'FOLLOW_UP',
      title: `Follow-up: ${f.title}`,
      description: [f.reason, f.context].filter(Boolean).join(' — ') || f.method.replaceAll('_', ' ').toLowerCase(),
    })),
    ...(lead.outreaches || []).map((o) => ({
      id: `o-${o.id}`, date: o.date, type: channelToActivityType(o.channel),
      title: `${metaOf(OUTREACH_CHANNELS, o.channel).label} — ${metaOf(OUTREACH_STATUS, o.status).label}`,
      description: o.whatWasDiscussed || o.message || o.response || '',
    })),
    ...(lead.pitches || []).map((p) => ({
      id: `p-${p.id}`, date: p.date, type: 'PITCH_CREATED',
      title: `Pitch: ${p.title}`,
      description: p.notes || metaOf(PITCH_TYPES, p.type).label,
    })),
  ] : []

  return (
    <Dialog open={!!leadId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {!lead ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {lead.businessName}
                <StatusBadge map={SAAS_FUNNEL_STAGES} value={lead.funnelStage} size="sm" />
              </DialogTitle>
              <DialogDescription>
                {[lead.location, lead.contactPerson && lead.role ? `${lead.contactPerson} (${lead.role})` : lead.contactPerson].filter(Boolean).join(' · ') || 'Prospect'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* stage + interest */}
              <div className="grid sm:grid-cols-2 gap-3">
                <F label="Funnel stage">
                  <Select
                    value={lead.funnelStage}
                    onValueChange={(v) => { saveField('funnelStage', v)() }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...SAAS_FUNNEL_ORDER, 'LOST'].map((s) => (
                        <SelectItem key={s} value={s}>{metaOf(SAAS_FUNNEL_STAGES, s).label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Interested?">
                  <Select value={lead.interested || 'UNSET'} onValueChange={(v) => { saveField('interested', v === 'UNSET' ? '' : v)() }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNSET">Not set</SelectItem>
                      <SelectItem value="YES">Yes</SelectItem>
                      <SelectItem value="MAYBE">Maybe</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
              </div>

              {/* contact info */}
              <div className="rounded-xl border bg-muted/30 p-3 grid sm:grid-cols-2 gap-x-4 gap-y-2">
                <InfoRow icon={UserIcon} label="Contact" value={[lead.contactPerson, lead.role].filter(Boolean).join(' · ')} />
                <InfoRow icon={MapPin} label="Location" value={lead.location} />
                <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                <InfoRow icon={Mail} label="Email" value={lead.email} />
                <InfoRow icon={Globe} label="Website" value={lead.website} />
                <InfoRow icon={Globe} label="Social" value={lead.social} />
                <InfoRow
                  icon={AlarmClock}
                  label="Next follow-up"
                  value={lead.nextFollowUpAt ? fmtDateTime(lead.nextFollowUpAt) : null}
                />
              </div>

              {/* what did they say? */}
              <div>
                <SectionTitle icon={Quote}>What did they say?</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-2.5 mt-2">
                  {SAY_SECTIONS.map((s) => (
                    <FieldEditor
                      key={s.field}
                      label={s.label}
                      hint={s.hint}
                      placeholder={s.placeholder}
                      rows={3}
                      value={s.field === 'problems' ? parseJsonArray(lead.problems).join('\n') : (lead as any)[s.field]}
                      onSave={async (v) => {
                        const value = s.field === 'problems'
                          ? JSON.stringify(v.split('\n').map((x) => x.trim()).filter(Boolean))
                          : v
                        await saveField(s.field, value)()
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* quick actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setVisitOpen(true)}>
                  <MapPin className="h-3.5 w-3.5" /> Log visit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFuOpen(true)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Schedule follow-up
                </Button>
              </div>

              {/* history */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-teal-600" /> History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Timeline activities={history} />
                  <ActivityComposer saasLeadId={lead.id} productId={productId} />
                </CardContent>
              </Card>

              <AttachmentSection entityType="SAAS_LEAD" entityId={lead.id} attachments={lead.attachments} />
            </div>

            <VisitDialog open={visitOpen} onClose={() => setVisitOpen(false)} productId={productId} leads={leads} fixedLeadId={lead.id} />
            <FollowUpDialog open={fuOpen} onClose={() => setFuOpen(false)} productId={productId} leads={leads} fixedLeadId={lead.id} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ══════════════════════════════ Visit & follow-up dialogs (shared) ══════════════════════════════ */

const visitDefaults = () => ({
  saasLeadId: '', date: nowLocalInput(), whoMet: '', whatWasDiscussed: '', whatTheySaid: '',
  problemsIdentified: '', objections: '', featuresLiked: '', featuresRequested: '',
  interest: 'UNSET', nextAction: '',
})

function VisitDialog({ open, onClose, productId, leads, fixedLeadId }: {
  open: boolean
  onClose: () => void
  productId: string
  leads: SaasLead[]
  fixedLeadId?: string
}) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [f, setF] = useState(visitDefaults)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setF({ ...visitDefaults(), saasLeadId: fixedLeadId || '' })
  }, [open, fixedLeadId])

  const submit = async () => {
    if (!f.saasLeadId) { toast.error('Pick the business you visited'); return }
    if (!f.whoMet.trim()) { toast.error('Who did you meet?'); return }
    setSaving(true)
    try {
      await api.create('outreach', {
        channel: 'VISIT', mode: 'OFFLINE', productId,
        saasLeadId: f.saasLeadId,
        userId: currentUserId || undefined,
        date: new Date(f.date).toISOString(),
        whoMet: f.whoMet,
        whatWasDiscussed: f.whatWasDiscussed,
        whatTheySaid: f.whatTheySaid,
        problemsIdentified: f.problemsIdentified,
        objections: f.objections,
        featuresLiked: f.featuresLiked,
        featuresRequested: f.featuresRequested,
        interest: f.interest === 'UNSET' ? '' : f.interest,
        nextAction: f.nextAction,
      })
      toast.success('Visit logged')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to log visit')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a visit</DialogTitle>
          <DialogDescription>Everything you saw, heard and agreed — recorded while it&apos;s fresh.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Business visited" required className="sm:col-span-2">
            <Select value={f.saasLeadId || undefined} onValueChange={(v) => setF({ ...f, saasLeadId: v })} disabled={!!fixedLeadId}>
              <SelectTrigger><SelectValue placeholder="Select a lead" /></SelectTrigger>
              <SelectContent>
                {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.businessName}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Date & time">
            <Input type="datetime-local" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </F>
          <F label="Who met" required>
            <Input value={f.whoMet} onChange={(e) => setF({ ...f, whoMet: e.target.value })} placeholder="Dr. Silva, owner" />
          </F>
          <F label="What was discussed" className="sm:col-span-2">
            <Textarea value={f.whatWasDiscussed} onChange={(e) => setF({ ...f, whatWasDiscussed: e.target.value })} rows={2} />
          </F>
          <F label="What they said" className="sm:col-span-2">
            <Textarea value={f.whatTheySaid} onChange={(e) => setF({ ...f, whatTheySaid: e.target.value })} rows={2} placeholder="Quotes, in their words" />
          </F>
          <F label="Problems identified">
            <Textarea value={f.problemsIdentified} onChange={(e) => setF({ ...f, problemsIdentified: e.target.value })} rows={2} />
          </F>
          <F label="Objections">
            <Textarea value={f.objections} onChange={(e) => setF({ ...f, objections: e.target.value })} rows={2} />
          </F>
          <F label="Features they liked">
            <Textarea value={f.featuresLiked} onChange={(e) => setF({ ...f, featuresLiked: e.target.value })} rows={2} />
          </F>
          <F label="Features requested">
            <Textarea value={f.featuresRequested} onChange={(e) => setF({ ...f, featuresRequested: e.target.value })} rows={2} />
          </F>
          <F label="Interest">
            <Select value={f.interest} onValueChange={(v) => setF({ ...f, interest: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UNSET">Not set</SelectItem>
                <SelectItem value="YES">Yes</SelectItem>
                <SelectItem value="MAYBE">Maybe</SelectItem>
                <SelectItem value="NO">No</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Next action">
            <Input value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} placeholder="Send proposal Friday" />
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            Log visit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const fuDefaults = () => ({
  saasLeadId: '', title: '', dueDate: nowLocalInput(), method: 'WHATSAPP', reason: '',
})

function FollowUpDialog({ open, onClose, productId, leads, fixedLeadId }: {
  open: boolean
  onClose: () => void
  productId: string
  leads: SaasLead[]
  fixedLeadId?: string
}) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [f, setF] = useState(fuDefaults)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) setF({ ...fuDefaults(), saasLeadId: fixedLeadId || '' })
  }, [open, fixedLeadId])

  const submit = async () => {
    if (!f.title.trim()) { toast.error('Give the follow-up a title'); return }
    if (!f.dueDate) { toast.error('Pick a due date'); return }
    setSaving(true)
    try {
      await api.create('followups', {
        title: f.title.trim(),
        dueDate: new Date(f.dueDate).toISOString(),
        method: f.method,
        reason: f.reason,
        saasLeadId: fixedLeadId || f.saasLeadId || undefined,
        productId,
        createdById: currentUserId || undefined,
      })
      toast.success('Follow-up scheduled')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to schedule follow-up')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>It lands in the Follow-ups module and on this prospect&apos;s history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!fixedLeadId && (
            <F label="Prospect" required>
              <Select value={f.saasLeadId || undefined} onValueChange={(v) => setF({ ...f, saasLeadId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.businessName}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          )}
          <F label="Title" required>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Send pricing, confirm demo…" autoFocus />
          </F>
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Due" required>
              <Input type="datetime-local" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </F>
            <F label="Method">
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(METHODS).map((m) => (
                  <SelectItem key={m} value={m}>{metaOf(METHODS, m).label}</SelectItem>
                ))}</SelectContent>
              </Select>
            </F>
          </div>
          <F label="Reason">
            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Why this follow-up matters" />
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ══════════════════════════════ Outreach ══════════════════════════════ */

function OutreachTab({ productId, outreaches, leads }: { productId: string; outreaches: Outreach[]; leads: SaasLead[] }) {
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [visitOpen, setVisitOpen] = useState(false)

  const online = outreaches.filter((o) => o.mode !== 'OFFLINE')
  const visits = outreaches.filter((o) => o.mode === 'OFFLINE')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill active={mode === 'ONLINE'} onClick={() => setMode('ONLINE')}>Online · {online.length}</Pill>
        <Pill active={mode === 'OFFLINE'} onClick={() => setMode('OFFLINE')}>Visits · {visits.length}</Pill>
        <Button size="sm" className={cn(EMERALD_BTN, 'ml-auto')} onClick={() => setVisitOpen(true)}>
          <MapPin className="h-3.5 w-3.5" /> Log visit
        </Button>
      </div>

      {mode === 'ONLINE' ? (
        online.length === 0 ? (
          <EmptyState icon={Send} title="No online outreach yet" description="Emails, LinkedIn messages and calls for this product show up here." />
        ) : (
          <div className={cn('space-y-1.5', SCROLL_Y)}>
            {online.map((o) => (
              <div key={o.id} className="rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge map={OUTREACH_CHANNELS} value={o.channel} size="sm" />
                  <span className="text-sm font-medium">{o.saasLead?.businessName || '—'}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(o.date)}</span>
                  <span className="ml-auto"><StatusBadge map={OUTREACH_STATUS} value={o.status} size="sm" /></span>
                </div>
                {(o.message || o.response) && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{o.message}{o.response ? ` → ${o.response}` : ''}</p>
                )}
              </div>
            ))}
          </div>
        )
      ) : visits.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No visits logged yet"
          description="Every walk-in and on-site meeting becomes a visit record with what was said and agreed."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setVisitOpen(true)}><MapPin className="h-3.5 w-3.5" /> Log visit</Button>}
        />
      ) : (
        <div className={cn('space-y-3', SCROLL_Y)}>
          {visits.map((v) => (
            <Card key={v.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{v.saasLead?.businessName || 'Visit'}</span>
                <span className="text-[11px] text-muted-foreground">{fmtDateTime(v.date)}</span>
                {v.interest && <span className="ml-auto"><StatusBadge map={INTEREST_META} value={v.interest} size="sm" /></span>}
              </div>
              {v.whatTheySaid && (
                <blockquote className="border-l-2 border-emerald-300 pl-3 text-sm italic text-foreground/90">
                  <Quote className="h-3 w-3 inline mr-1 text-emerald-600" aria-hidden />
                  {v.whatTheySaid}
                </blockquote>
              )}
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <InfoLine label="Who met" value={v.whoMet} />
                <InfoLine label="Next action" value={v.nextAction} />
                <InfoLine label="Discussed" value={v.whatWasDiscussed} />
                <InfoLine label="Problems identified" value={v.problemsIdentified} />
                <InfoLine label="Objections" value={v.objections} />
                <InfoLine label="Features liked" value={v.featuresLiked} />
                <InfoLine label="Features requested" value={v.featuresRequested} />
                <InfoLine label="Outcome" value={v.outcome} />
              </dl>
            </Card>
          ))}
        </div>
      )}

      <VisitDialog open={visitOpen} onClose={() => setVisitOpen(false)} productId={productId} leads={leads} />
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm mt-0.5 whitespace-pre-wrap break-words">{value}</dd>
    </div>
  )
}

/* ══════════════════════════════ Follow-ups ══════════════════════════════ */

function FollowUpsTab({ productId, bundleFollowUps }: { productId: string; bundleFollowUps: FollowUp[] }) {
  const qc = useQueryClient()
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const { data: all } = useQuery({
    queryKey: ['followups', 'product', productId],
    queryFn: () => api.list<FollowUp>('followups', { productId }),
  })
  const rows = all || bundleFollowUps

  const pending = rows.filter((f) => f.status === 'UPCOMING')
  const overdue = pending.filter((f) => fuDerived(f) === 'OVERDUE')
  const dueToday = pending.filter((f) => fuDerived(f) === 'DUE_TODAY')
  const upcoming = pending.filter((f) => fuDerived(f) === 'UPCOMING')
  const done = rows.filter((f) => f.status === 'COMPLETED' || f.status === 'CANCELLED')

  const act = async (id: string, data: Record<string, unknown>, msg: string) => {
    try {
      await api.update('followups', id, data)
      toast.success(msg)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  const sections: { label: string; tone: 'bad' | 'warn' | 'default'; items: FollowUp[] }[] = [
    { label: 'Overdue', tone: 'bad', items: overdue },
    { label: 'Due today', tone: 'warn', items: dueToday },
    { label: 'Upcoming', tone: 'default', items: upcoming },
  ]

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState
          icon={AlarmClock}
          title="No pending follow-ups for this product."
          description="Schedule one from any prospect's page — it lands here automatically."
        />
      ) : (
        <>
          {pending.length === 0 && (
            <EmptyState
              icon={CheckCircle2}
              title="No pending follow-ups for this product."
              description="All caught up — scheduled ones will appear here."
            />
          )}
          {sections.map((s) => s.items.length === 0 ? null : (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className={cn(
                  'text-sm flex items-center gap-2',
                  s.tone === 'bad' && 'text-rose-600',
                  s.tone === 'warn' && 'text-amber-600'
                )}>
                  <AlarmClock className="h-4 w-4" /> {s.label} ({s.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {s.items.map((f) => (
                  <div key={f.id} className="rounded-lg border px-2.5 py-2 flex flex-wrap items-center gap-2 hover:bg-muted/50 transition-colors">
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0',
                      s.tone === 'bad' ? 'bg-rose-500' : s.tone === 'warn' ? 'bg-amber-500' : 'bg-sky-500')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {f.saasLead?.businessName || 'Product'} · {metaOf(METHODS, f.method).label} · {fmtDateTime(f.dueDate)}
                      </p>
                    </div>
                    <StatusBadge map={FOLLOWUP_STATUS} value={fuDerived(f)} size="sm" />
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => act(f.id, { status: 'COMPLETED' }, 'Follow-up completed')}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setRescheduleId(f.id)}>
                        Reschedule
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {done.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" /> Completed & cancelled ({done.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className={cn('space-y-1', SCROLL_Y)}>
                  {done.map((f) => (
                    <div key={f.id} className="rounded-lg border px-2.5 py-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">{f.title}</span>
                      <span className="text-muted-foreground">{f.saasLead?.businessName}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {f.completedAt ? `done ${fmtRelative(f.completedAt)}` : metaOf(FOLLOWUP_STATUS, f.status).label.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <RescheduleDialog followUp={rows.find((r) => r.id === rescheduleId) || null} onClose={() => setRescheduleId(null)} />
    </div>
  )
}

function RescheduleDialog({ followUp, onClose }: { followUp: FollowUp | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [dueDate, setDueDate] = useState(nowLocalInput())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (followUp) setDueDate(followUp.dueDate ? nowLocalInputFromDate(followUp.dueDate) : nowLocalInput())
  }, [followUp])

  const submit = async () => {
    if (!followUp || !dueDate) return
    setSaving(true)
    try {
      await api.update('followups', followUp.id, { dueDate: new Date(dueDate).toISOString(), status: 'UPCOMING' })
      toast.success('Follow-up rescheduled')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to reschedule')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={!!followUp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Reschedule follow-up</DialogTitle>
          <DialogDescription>{followUp?.title || ''}</DialogDescription>
        </DialogHeader>
        <F label="New due date & time" required>
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </F>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Reschedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function nowLocalInputFromDate(d: string): string {
  const dt = new Date(d)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().slice(0, 16)
}

/* ══════════════════════════════ Pitches ══════════════════════════════ */

const PITCH_DEFAULTS = { title: '', type: 'SOFTWARE_IDEA', link: '', notes: '', saasLeadId: '' }

function PitchesTab({ productId, pitches, leads }: { productId: string; pitches: Pitch[]; leads: SaasLead[] }) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(PITCH_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (newOpen) setForm(PITCH_DEFAULTS) }, [newOpen])

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title the pitch'); return }
    setSaving(true)
    try {
      await api.create('pitches', {
        productId,
        creatorId: currentUserId || undefined,
        title: form.title.trim(),
        type: form.type,
        link: form.link,
        notes: form.notes,
        saasLeadId: form.saasLeadId || undefined,
      })
      toast.success('Pitch created')
      qc.invalidateQueries()
      setNewOpen(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create pitch')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New pitch
        </Button>
      </div>

      {pitches.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="No pitches yet"
          description="Concepts, proposals and presentations tailored for this product's prospects."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> New pitch</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {pitches.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug">{p.title}</p>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-emerald-600 shrink-0" aria-label="Open pitch link">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge map={PITCH_TYPES} value={p.type} size="sm" />
                <StatusBadge map={PITCH_STATUS} value={p.status} size="sm" />
              </div>
              {p.notes && <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 mt-auto">
                <span className="truncate">{p.saasLead?.businessName || 'No lead linked'}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <MiniAvatar name={p.creator?.name} />
                  {fmtDate(p.date, 'MMM d')}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={(v) => !v && setNewOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New pitch</DialogTitle>
            <DialogDescription>Link it to a prospect so it shows on their history too.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <F label="Title" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            </F>
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Type">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(PITCH_TYPES).map((t) => (
                    <SelectItem key={t} value={t}>{metaOf(PITCH_TYPES, t).label}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </F>
              <F label="Prospect">
                <Select value={form.saasLeadId || 'NONE'} onValueChange={(v) => setForm({ ...form, saasLeadId: v === 'NONE' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.businessName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <F label="Link">
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
            </F>
            <F label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </F>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create pitch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ══════════════════════════════ Clients ══════════════════════════════ */

const CLIENT_DEFAULTS = {
  businessName: '', contactPerson: '', email: '', phone: '', plan: 'TRIAL',
  onboardingStatus: 'NOT_STARTED', saasLeadId: '', customRequirements: '',
}

function ClientsTab({ productId, clients, leads, features, openClientId, onOpenClient, onCloseClient }: {
  productId: string
  clients: SaasClient[]
  leads: SaasLead[]
  features: SaasFeature[]
  openClientId: string | null
  onOpenClient: (id: string) => void
  onCloseClient: () => void
}) {
  const [onboardOpen, setOnboardOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className={EMERALD_BTN} onClick={() => setOnboardOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Onboard client
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients onboarded yet"
          description="Convert a warm prospect or add a clinic directly — plans, onboarding and feedback live here."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setOnboardOpen(true)}><Plus className="h-3.5 w-3.5" /> Onboard client</Button>}
        />
      ) : (
        <div className={cn('grid md:grid-cols-2 xl:grid-cols-3 gap-3', SCROLL_Y)}>
          {clients.map((c) => <ClientCard key={c.id} client={c} onOpenClient={onOpenClient} />)}
        </div>
      )}

      <OnboardClientDialog
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        productId={productId}
        leads={leads}
        features={features}
      />
      <ClientDetailDialog
        clientId={openClientId}
        clients={clients}
        leads={leads}
        productId={productId}
        onClose={onCloseClient}
      />
    </div>
  )
}

function ClientCard({ client: c, onOpenClient }: { client: SaasClient; onOpenClient: (id: string) => void }) {
  const plan = metaOf(PLAN_META, c.plan)
  const onb = metaOf(ONBOARDING_META, c.onboardingStatus)
  return (
    <button
      onClick={() => onOpenClient(c.id)}
      className="cursor-pointer text-left rounded-xl border bg-card p-4 space-y-2.5 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate">{c.businessName}</p>
        <StatusBadge map={CLIENT_STATUS} value={c.status} size="sm" />
      </div>
      {c.contactPerson && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <UserIcon className="h-3 w-3" /> {c.contactPerson}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {c.plan && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', plan.color)}>{plan.label}</span>}
        {c.onboardingStatus && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', onb.color)}>{onb.label}</span>}
      </div>
      {(c.issues || c.feedback || c.complaints) && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{c.issues || c.feedback || c.complaints}</p>
      )}
    </button>
  )
}

function OnboardClientDialog({ open, onClose, productId, leads, features }: {
  open: boolean
  onClose: () => void
  productId: string
  leads: SaasLead[]
  features: SaasFeature[]
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(CLIENT_DEFAULTS)
  const [enabled, setEnabled] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) { setForm(CLIENT_DEFAULTS); setEnabled([]) }
  }, [open])

  const convertible = leads.filter((l) => ['TRIAL', 'INTERESTED', 'DEMO'].includes(l.funnelStage))
  const featureNames = features.filter((f) => f.status !== 'REJECTED').map((f) => f.name)

  const submit = async () => {
    if (!form.businessName.trim()) { toast.error('Business name is required'); return }
    setSaving(true)
    try {
      await api.create('saas-clients', {
        productId,
        businessName: form.businessName.trim(),
        contactPerson: form.contactPerson,
        email: form.email,
        phone: form.phone,
        plan: form.plan,
        onboardingStatus: form.onboardingStatus,
        status: form.plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
        saasLeadId: form.saasLeadId || undefined,
        featuresEnabled: enabled.length ? JSON.stringify(enabled) : '',
        customRequirements: form.customRequirements,
      })
      toast.success('Client onboarded')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to onboard client')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onboard client</DialogTitle>
          <DialogDescription>
            Converting from a lead moves it to the Client stage automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Business name" required className="sm:col-span-2">
            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} autoFocus />
          </F>
          <F label="Contact person">
            <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </F>
          <F label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </F>
          <F label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </F>
          <F label="Plan">
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(PLAN_META).map((p) => (
                <SelectItem key={p} value={p}>{metaOf(PLAN_META, p).label}</SelectItem>
              ))}</SelectContent>
            </Select>
          </F>
          <F label="Onboarding status">
            <Select value={form.onboardingStatus} onValueChange={(v) => setForm({ ...form, onboardingStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(ONBOARDING_META).map((s) => (
                <SelectItem key={s} value={s}>{metaOf(ONBOARDING_META, s).label}</SelectItem>
              ))}</SelectContent>
            </Select>
          </F>
          <F label="Convert from lead" hint="Trial / interested / demo prospects only">
            <Select value={form.saasLeadId || 'NONE'} onValueChange={(v) => setForm({ ...form, saasLeadId: v === 'NONE' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Not converting" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Not converting</SelectItem>
                {convertible.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.businessName} ({metaOf(SAAS_FUNNEL_STAGES, l.funnelStage).label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Features enabled" className="sm:col-span-2">
            <div className={cn('rounded-lg border p-2 space-y-1', SCROLL_SM)}>
              {featureNames.length === 0 ? (
                <p className="text-xs text-muted-foreground p-1">No features defined yet.</p>
              ) : featureNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-xs rounded px-1 py-0.5 hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={enabled.includes(name)}
                    onCheckedChange={(v) => setEnabled(v ? [...enabled, name] : enabled.filter((n) => n !== name))}
                  />
                  {name}
                </label>
              ))}
            </div>
          </F>
          <F label="Custom requirements" className="sm:col-span-2">
            <Textarea value={form.customRequirements} onChange={(e) => setForm({ ...form, customRequirements: e.target.value })} rows={2} />
          </F>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Onboard client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const CLIENT_EDIT_FIELDS: { field: string; label: string; placeholder?: string }[] = [
  { field: 'issues', label: 'Issues', placeholder: 'Anything going wrong for them right now.' },
  { field: 'complaints', label: 'Complaints' },
  { field: 'feedback', label: 'Feedback' },
  { field: 'featureRequests', label: 'Feature requests' },
  { field: 'notes', label: 'Notes' },
]

function ClientDetailDialog({ clientId, clients, leads, productId, onClose }: {
  clientId: string | null
  clients: SaasClient[]
  leads: SaasLead[]
  productId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { navigate } = useHashRoute()
  const { data: fetched } = useQuery({
    queryKey: ['saas-client', clientId],
    queryFn: () => api.get<SaasClient>('saas-clients', clientId!),
    enabled: !!clientId,
  })
  const c = fetched || clients.find((x) => x.id === clientId)
  const linkedLead = c?.saasLeadId ? (leads.find((l) => l.id === c.saasLeadId) || c.saasLead || null) : null

  const patch = async (data: Record<string, unknown>) => {
    if (!c) return
    try {
      await api.update('saas-clients', c.id, data)
      toast.success('Saved')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
  }

  return (
    <Dialog open={!!clientId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {!c ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {c.businessName}
                <StatusBadge map={CLIENT_STATUS} value={c.status} size="sm" />
                {c.plan && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', metaOf(PLAN_META, c.plan).color)}>
                    {metaOf(PLAN_META, c.plan).label}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                Onboarded {c.onboardedAt ? fmtDate(c.onboardedAt) : 'not yet'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <F label="Plan">
                  <Select value={c.plan || 'NONE'} onValueChange={(v) => patch({ plan: v === 'NONE' ? '' : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      {Object.keys(PLAN_META).map((p) => <SelectItem key={p} value={p}>{metaOf(PLAN_META, p).label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <F label="Status">
                  <Select value={c.status} onValueChange={(v) => patch({ status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{['TRIAL', 'ACTIVE', 'PAUSED', 'CHURNED'].map((s) => (
                      <SelectItem key={s} value={s}>{metaOf(CLIENT_STATUS, s).label}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
                <F label="Onboarding">
                  <Select value={c.onboardingStatus || 'NOT_STARTED'} onValueChange={(v) => patch({ onboardingStatus: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(ONBOARDING_META).map((s) => (
                      <SelectItem key={s} value={s}>{metaOf(ONBOARDING_META, s).label}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 grid sm:grid-cols-2 gap-x-4 gap-y-2">
                <InfoRow icon={UserIcon} label="Contact" value={c.contactPerson} />
                <InfoRow icon={Mail} label="Email" value={c.email} />
                <InfoRow icon={Phone} label="Phone" value={c.phone} />
                <InfoRow icon={CheckCircle2} label="Onboarded" value={c.onboardedAt ? fmtDate(c.onboardedAt) : null} />
              </div>

              {linkedLead && (
                <button
                  onClick={() => { onClose(); navigate(`#/products/${productId}?lead=${linkedLead.id}`) }}
                  className="w-full text-left rounded-lg border px-3 py-2 text-xs hover:bg-muted/50 transition-colors inline-flex items-center gap-2"
                >
                  <Users className="h-3.5 w-3.5 text-teal-600" />
                  Converted from lead: <span className="font-medium">{linkedLead.businessName}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </button>
              )}

              {parseJsonArray(c.featuresEnabled).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parseJsonArray(c.featuresEnabled).map((name) => (
                    <span key={name} className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{name}</span>
                  ))}
                </div>
              )}

              {c.customRequirements && <InfoRow icon={StickyNote} label="Custom requirements" value={c.customRequirements} />}

              <div className="grid sm:grid-cols-2 gap-2.5">
                {CLIENT_EDIT_FIELDS.map((s) => (
                  <FieldEditor
                    key={s.field}
                    label={s.label}
                    placeholder={s.placeholder}
                    rows={3}
                    value={(c as any)[s.field]}
                    onSave={async (v) => patch({ [s.field]: v })}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ══════════════════════════════ Knowledge ══════════════════════════════ */

const KNOWLEDGE_DEFAULTS = {
  title: '', content: '', category: 'GENERAL', tags: '', link: '', pinned: false,
}

function KnowledgeTab({ productId, knowledge }: { productId: string; knowledge: KnowledgeItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const sorted = [...knowledge].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New note
        </Button>
      </div>

      {knowledge.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No knowledge yet"
          description="Research, competitor notes, decisions — the product's brain lives here."
          action={<Button size="sm" className={EMERALD_BTN} onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> New note</Button>}
        />
      ) : (
        <div className={cn('grid md:grid-cols-2 xl:grid-cols-3 gap-3', SCROLL_Y)}>
          {sorted.map((k) => (
            <button
              key={k.id}
              onClick={() => setOpenId(k.id)}
              className="text-left rounded-xl border bg-card p-4 space-y-2 hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{k.title}</p>
                {k.pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 rotate-45" aria-label="Pinned" />}
              </div>
              <StatusBadge map={KNOWLEDGE_CATEGORIES} value={k.category} size="sm" />
              {parseJsonArray(k.tags).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parseJsonArray(k.tags).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">#{t}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{k.content}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t pt-2">
                <MiniAvatar name={k.author?.name} />
                <span className="truncate">{k.author?.name || 'Unknown'}</span>
                <span className="ml-auto shrink-0">updated {fmtRelative(k.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <NewKnowledgeDialog open={newOpen} onClose={() => setNewOpen(false)} productId={productId} />
      <KnowledgeDetailDialog knowledgeId={openId} knowledge={knowledge} onClose={() => setOpenId(null)} />
    </div>
  )
}

function NewKnowledgeDialog({ open, onClose, productId }: { open: boolean; onClose: () => void; productId: string }) {
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [form, setForm] = useState(KNOWLEDGE_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setForm(KNOWLEDGE_DEFAULTS) }, [open])

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      await api.create('knowledge', {
        productId,
        authorId: currentUserId || undefined,
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags: JSON.stringify(form.tags.split(',').map((t) => t.trim()).filter(Boolean)),
        link: form.link,
        pinned: form.pinned,
      })
      toast.success('Note saved')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save note')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <F label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </F>
          <F label="Content" required>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} />
          </F>
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(KNOWLEDGE_CATEGORIES).map((c) => (
                  <SelectItem key={c} value={c}>{metaOf(KNOWLEDGE_CATEGORIES, c).label}</SelectItem>
                ))}</SelectContent>
              </Select>
            </F>
            <F label="Tags" hint="Comma separated">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="pricing, dentists" />
            </F>
          </div>
          <F label="Link">
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
          </F>
          <div className="flex items-center gap-2">
            <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} id="pin-note" />
            <Label htmlFor="pin-note" className="text-xs">Pin to top</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className={EMERALD_BTN} onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function KnowledgeDetailDialog({ knowledgeId, knowledge, onClose }: {
  knowledgeId: string | null
  knowledge: KnowledgeItem[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: fetched } = useQuery({
    queryKey: ['knowledge', knowledgeId],
    queryFn: () => api.get<KnowledgeItem>('knowledge', knowledgeId!),
    enabled: !!knowledgeId,
  })
  const item = fetched || knowledge.find((k) => k.id === knowledgeId)
  const [form, setForm] = useState(KNOWLEDGE_DEFAULTS)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (item) {
      setForm({
        title: item.title, content: item.content, category: item.category,
        tags: parseJsonArray(item.tags).join(', '), link: item.link || '', pinned: item.pinned,
      })
    }
  }, [item])

  const patch = async (data: Record<string, unknown>, msg = 'Saved') => {
    if (!item) return
    try {
      await api.update('knowledge', item.id, data)
      toast.success(msg)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      await patch({
        title: form.title, content: form.content, category: form.category,
        tags: JSON.stringify(form.tags.split(',').map((t) => t.trim()).filter(Boolean)),
        link: form.link,
      })
    } finally { setSaving(false) }
  }

  const del = async () => {
    if (!item) return
    try {
      await api.remove('knowledge', item.id)
      toast.success('Note deleted')
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete')
    }
  }

  return (
    <Dialog open={!!knowledgeId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {!item ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {item.pinned && <Pin className="h-3.5 w-3.5 text-amber-500 rotate-45" />}
                Edit note
              </DialogTitle>
              <DialogDescription>
                {item.author?.name ? `By ${item.author.name} · ` : ''}updated {fmtRelative(item.updatedAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <F label="Title" required>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </F>
              <F label="Content" required>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} />
              </F>
              <div className="grid sm:grid-cols-2 gap-3">
                <F label="Category">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(KNOWLEDGE_CATEGORIES).map((c) => (
                      <SelectItem key={c} value={c}>{metaOf(KNOWLEDGE_CATEGORIES, c).label}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </F>
                <F label="Tags" hint="Comma separated">
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                </F>
              </div>
              <F label="Link">
                <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </F>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.pinned}
                  onCheckedChange={(v) => { setForm({ ...form, pinned: v }); patch({ pinned: v }, v ? 'Pinned' : 'Unpinned') }}
                  id="pin-edit"
                />
                <Label htmlFor="pin-edit" className="text-xs">Pinned</Label>
              </div>

              <AttachmentSection entityType="KNOWLEDGE" entityId={item.id} attachments={item.attachments} />

              <div className="flex items-center justify-between border-t pt-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{item.title}”?</AlertDialogTitle>
                      <AlertDialogDescription>This note and its attachments will be gone for good.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white" onClick={del}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" className={EMERALD_BTN} onClick={saveAll} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save changes
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ══════════════════════════════ Funnel ══════════════════════════════ */

function FunnelTab({ leads }: { leads: SaasLead[] }) {
  const steps: FunnelStep[] = SAAS_FUNNEL_ORDER.map((stage, i) => {
    const count = leads.filter((l) => l.funnelStage === stage).length
    const prev = i === 0 ? 0 : leads.filter((l) => l.funnelStage === SAAS_FUNNEL_ORDER[i - 1]).length
    return {
      stage,
      label: metaOf(SAAS_FUNNEL_STAGES, stage).label,
      count,
      convFromPrev: i === 0 || prev === 0 ? null : Math.round((count / prev) * 100),
    }
  })

  const online = leads.filter((l) => l.origin === 'ONLINE').length
  const offline = leads.filter((l) => l.origin === 'OFFLINE').length
  const total = online + offline
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  let bottleneck: { label: string; conv: number } | null = null
  for (let i = 1; i < steps.length; i++) {
    const conv = steps[i].convFromPrev
    if (conv === null) continue
    if (!bottleneck || conv < bottleneck.conv) {
      bottleneck = { label: `${steps[i - 1].label} → ${steps[i].label}`, conv }
    }
  }

  return (
    <div className="space-y-4">
      {leads.length === 0 ? (
        <EmptyState icon={TrendingDown} title="No leads to build a funnel yet" description="Add prospects and the funnel fills itself." />
      ) : (
        <>
          <Card className="p-5">
            <SectionTitle icon={TrendingDown}>Sales funnel</SectionTitle>
            <FunnelBars steps={steps} barTone="bg-teal-600" className="mt-4" />
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Online-sourced leads
                </p>
                <p className="text-2xl font-semibold tabular-nums">{online}</p>
              </div>
              <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${Math.max(pct(online), online > 0 ? 4 : 0)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{pct(online)}% of {total} leads</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Offline-sourced leads
                </p>
                <p className="text-2xl font-semibold tabular-nums">{offline}</p>
              </div>
              <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(pct(offline), offline > 0 ? 4 : 0)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{pct(offline)}% of {total} leads</p>
            </Card>
          </div>

          {bottleneck && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex gap-3">
                <TrendingDown className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Biggest drop-off: {bottleneck.label} ({bottleneck.conv}%)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Leads stall here more than anywhere else — tighten the hand-off: clearer next step, faster demo scheduling, stronger proof.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
