'use client'

/**
 * Settings module — team & roles, products, live workspace counts, current
 * user switcher (persisted via zustand) and the About card.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { SaasProduct, User } from '@/lib/types'
import { USER_ROLES } from '@/lib/labels'
import { initials, avatarColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BookOpen, Briefcase, CalendarDays, FolderKanban, Info, ListChecks, Loader2,
  Package, UserPlus, Users,
} from 'lucide-react'

const ROLE_DOT_FALLBACK = 'bg-zinc-400'
const PRODUCT_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  PAUSED: 'bg-amber-500',
  ARCHIVED: 'bg-zinc-400',
}

export function SettingsView() {
  const { navigate } = useHashRoute()
  const qc = useQueryClient()

  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.list<User>('users') })
  const { data: products, isLoading: productsLoading } = useQuery({ queryKey: ['products'], queryFn: () => api.list<SaasProduct>('products') })
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['settings-counts'],
    queryFn: async () => {
      const [leads, clients, projects, tasks, meetings, knowledge] = await Promise.all([
        api.list('leads'), api.list('clients'), api.list('projects'),
        api.list('tasks'), api.list('meetings'), api.list('knowledge'),
      ])
      return {
        leads: leads.length, clients: clients.length, projects: projects.length,
        tasks: tasks.length, meetings: meetings.length, knowledge: knowledge.length,
      }
    },
  })

  const [addOpen, setAddOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)

  const changeRole = async (u: User, role: string) => {
    if (role === u.role) return
    try {
      await api.update('users', u.id, { role })
      toast.success(`${u.name} → ${USER_ROLES[role]?.label ?? role}`)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update role')
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Team, roles and workspace configuration."
        actions={
          <Button onClick={() => setAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <UserPlus className="h-4 w-4" /> Add member
          </Button>
        }
      />

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* ── team ── */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600" /> Team
              <span className="text-xs font-normal text-muted-foreground">{users?.length ?? 0} member{(users?.length ?? 0) === 1 ? '' : 's'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading && !users ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : (users || []).length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members"
                description="Add the people working in Connec8 OS."
                action={<Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Add member</Button>}
              />
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {users!.map((u) => {
                  const roleMeta = USER_ROLES[u.role]
                  return (
                    <div key={u.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-lg border px-2.5 py-2">
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(u.name) }}
                        aria-hidden
                      >
                        {initials(u.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium truncate">{u.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background font-medium cursor-default">
                                {roleMeta?.label ?? u.role}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>{roleMeta?.desc ?? 'Role'}</TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="block text-xs text-muted-foreground truncate">
                          {u.email}{u.title ? ` · ${u.title}` : ''}
                        </span>
                      </div>
                      <Select value={u.role} onValueChange={(role) => changeRole(u, role)}>
                        <SelectTrigger size="sm" className="w-[140px] text-xs shrink-0" aria-label={`Role for ${u.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(USER_ROLES).map(([key, meta]) => (
                            <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── products ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" /> Products
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setProductOpen(true)}>
                <Package className="h-3 w-3" /> New product
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading && !products ? (
              <div className="space-y-2">
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </div>
            ) : (products || []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No products yet — create your first SaaS product.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {products!.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`#/products/${p.id}`)}
                    className="w-full text-left flex items-center gap-2.5 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors group"
                  >
                    <span className={cn('h-2 w-2 rounded-full shrink-0', PRODUCT_DOT[p.status] ?? ROLE_DOT_FALLBACK)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate group-hover:text-emerald-700 transition-colors">{p.name}</span>
                      {p.tagline && <span className="block text-[11px] text-muted-foreground truncate">{p.tagline}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── workspace ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-teal-600" /> Workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <CountRow icon={Users} label="Agency leads" value={counts?.leads} loading={countsLoading} />
              <CountRow icon={Briefcase} label="Clients" value={counts?.clients} loading={countsLoading} />
              <CountRow icon={FolderKanban} label="Projects" value={counts?.projects} loading={countsLoading} />
              <CountRow icon={ListChecks} label="Project tasks" value={counts?.tasks} loading={countsLoading} />
              <CountRow icon={CalendarDays} label="Meetings" value={counts?.meetings} loading={countsLoading} />
              <CountRow icon={BookOpen} label="Knowledge notes" value={counts?.knowledge} loading={countsLoading} />
            </div>
          </CardContent>
        </Card>

        {/* ── current user ── */}
        <CurrentUserCard users={users} usersLoading={usersLoading} />

        {/* ── about ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-teal-600" /> About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold">
                Connec8 OS <span className="text-xs font-normal text-muted-foreground">v1</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Internal business operating system — agency pipeline, SaaS workspaces, projects and shared memory in one place.
              </p>
            </div>
            <div className="text-xs">
              <p className="font-medium text-foreground mb-1">Stack</p>
              <p className="text-muted-foreground">Next.js 16 · Prisma + SQLite · file uploads on disk via /api/files</p>
            </div>
            <blockquote className="border-l-2 border-emerald-500 pl-3 text-xs italic text-muted-foreground">
              “The founders should not need to carry the business inside their heads.”
            </blockquote>
          </CardContent>
        </Card>
      </div>

      {/* add member dialog */}
      {addOpen && (
        <AddMemberDialog onClose={() => setAddOpen(false)} />
      )}

      {/* new product dialog */}
      {productOpen && (
        <NewProductDialog onClose={() => setProductOpen(false)} />
      )}
    </div>
  )
}

// ── current user switcher ──

function CurrentUserCard({ users, usersLoading }: { users?: User[]; usersLoading: boolean }) {
  const { currentUserId, setCurrentUserId } = useUi()
  const effective = currentUserId && users?.some((u) => u.id === currentUserId) ? currentUserId : users?.[0]?.id

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600" /> Current user
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="space-y-1.5">
          <Label className="text-xs">Acting as</Label>
          {usersLoading && !users ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select value={effective ?? ''} onValueChange={(id) => { setCurrentUserId(id); toast.success(`Now acting as ${users?.find((u) => u.id === id)?.name ?? 'user'}`) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {(users || []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} — {USER_ROLES[u.role]?.label ?? u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Activity, follow-ups and notes you create are attributed to this team member. Saved across sessions.
        </p>
      </CardContent>
    </Card>
  )
}

// ── small pieces ──

function CountRow({
  icon: Icon, label, value, loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-background">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <span className="text-sm flex-1">{label}</span>
      {loading && value === undefined ? (
        <Skeleton className="h-4 w-8" />
      ) : (
        <span className="text-sm font-semibold tabular-nums">{value ?? 0}</span>
      )}
    </div>
  )
}

// ── add member dialog ──

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'VIEWER', title: '' })
  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    setBusy(true)
    try {
      await api.create('users', {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        title: form.title,
      })
      toast.success(`${form.name.trim()} added to the team`)
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to add member')
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>People who work inside Connec8 OS and can own records.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Prasanna" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="prasanna@connec8.app" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setField('role', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(USER_ROLES).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{USER_ROLES[form.role]?.desc}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Co-founder" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── new product dialog ──

function NewProductDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', tagline: '' })

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    setBusy(true)
    try {
      await api.create('products', { name: form.name.trim(), tagline: form.tagline })
      toast.success(`Product “${form.name.trim()}” created`)
      qc.invalidateQueries()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create product')
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>A SaaS product gets its own workspace: features, leads, funnel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="DentOS" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tagline</Label>
            <Input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Practice management for dental clinics" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
