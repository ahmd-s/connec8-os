'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { Project, ProjectTask, Client, User, Activity, Meeting } from '@/lib/types'
import {
  PROJECT_STATUS, PROJECT_STATUS_ORDER, PROJECT_TYPES, TASK_STATUS, PRIORITY,
  metaOf, parseJsonArray, parseJsonObjects,
} from '@/lib/labels'
import { fmtDate, fmtDateTime, daysSince, isOverdue, initials, avatarColor, fmtMoney } from '@/lib/format'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  FolderKanban, CheckCircle2, Wallet, CalendarDays, Plus, Search, Pencil, ArrowLeft,
  ExternalLink, Gavel, Activity as ActivityIcon, CalendarClock, ListTodo, Building2,
  ChevronRight, Loader2, X, Link2, Users,
} from 'lucide-react'

type LinkRow = { label: string; url: string }

const TASK_BAR: Record<string, string> = {
  TODO: 'bg-zinc-400',
  IN_PROGRESS: 'bg-amber-500',
  BLOCKED: 'bg-rose-500',
  DONE: 'bg-emerald-500',
}

/** deadline → days from now (negative = overdue) */
function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null
  return -daysSince(deadline)
}

/** ISO datetime → yyyy-MM-dd for <input type="date"> (stable round-trip) */
function toInputDate(d?: string | null): string {
  if (!d) return ''
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : ''
}

function progressOf(tasks: ProjectTask[] | { status: string }[] | undefined) {
  const list = tasks || []
  const done = list.filter((t) => t.status === 'DONE').length
  const total = list.length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/* ──────────────────────────────────────────────────────────── */
/*  Projects list                                               */
/* ──────────────────────────────────────────────────────────── */

export function ProjectsView() {
  const { navigate } = useHashRoute()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => api.list<Project>('projects') })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.list<Client>('clients') })

  const all = useMemo(() => projects || [], [projects])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: all.length }
    for (const s of PROJECT_STATUS_ORDER) c[s] = 0
    for (const p of all) c[p.status] = (c[p.status] || 0) + 1
    return c
  }, [all])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false
      if (q && !`${p.name} ${p.client?.name || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [all, statusFilter, typeFilter, search])

  const active = all.filter((p) => p.status !== 'COMPLETED').length
  const completed = all.filter((p) => p.status === 'COMPLETED').length
  const totalBudget = all.reduce((sum, p) => sum + (p.budget || 0), 0)
  const now = new Date()
  const deadlinesThisMonth = all.filter((p) => {
    if (!p.deadline) return false
    const d = new Date(p.deadline)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Client and internal projects with tasks, decisions and files."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" /> New project
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active projects" value={active} icon={FolderKanban} tone="accent" loading={isLoading} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="good" loading={isLoading} />
        <StatCard label="Total budget" value={fmtMoney(totalBudget)} icon={Wallet} loading={isLoading} />
        <StatCard
          label="Deadlines this month" value={deadlinesThisMonth} icon={CalendarDays}
          tone={deadlinesThisMonth > 0 ? 'warn' : 'default'} loading={isLoading}
        />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {['ALL', ...PROJECT_STATUS_ORDER].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium rounded-full border transition-colors',
              statusFilter === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {s === 'ALL' ? 'All' : metaOf(PROJECT_STATUS, s).label}
            <span className="ml-1 tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {Object.keys(PROJECT_TYPES).map((t) => (
                <SelectItem key={t} value={t}>{metaOf(PROJECT_TYPES, t).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…" className="h-8 w-44 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* project cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={all.length === 0 ? 'No projects yet' : 'No projects match your filters'}
          description={all.length === 0 ? 'Create your first project to start tracking tasks, decisions and deadlines.' : 'Try a different status, type or search term.'}
          action={
            <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> New project
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const { done, total, pct } = progressOf(p.tasks)
            const left = daysLeft(p.deadline)
            const urgent = left !== null && left < 7 && p.status !== 'COMPLETED'
            return (
              <button
                key={p.id}
                onClick={() => navigate(`#/projects/${p.id}`)}
                className="text-left rounded-xl border bg-card p-4 hover:border-emerald-300 hover:shadow-sm transition-all group flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-emerald-700 transition-colors">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" /> {p.client?.name || 'Internal'}
                    </p>
                  </div>
                  <StatusBadge map={PROJECT_STATUS} value={p.status} size="sm" />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge map={PROJECT_TYPES} value={p.type} size="sm" />
                  <span className={cn('inline-flex items-center gap-1 text-[11px]', urgent ? 'text-rose-600 font-medium' : 'text-muted-foreground')}>
                    <CalendarDays className="h-3 w-3" />
                    {p.deadline ? fmtDate(p.deadline, 'MMM d') : 'No deadline'}
                    {urgent && left !== null && <span>· {left < 0 ? `${-left}d overdue` : `${left}d left`}</span>}
                  </span>
                </div>

                <div className="mt-auto space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span className="tabular-nums font-medium text-foreground">{pct}% · {done}/{total}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ListTodo className="h-3 w-3" /> {total} task{total === 1 ? '' : 's'}
                    </span>
                    <span className="font-medium tabular-nums">{fmtMoney(p.budget)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} clients={clients || []} />
    </div>
  )
}

/* ── create dialog ── */

function CreateProjectDialog({
  open, onOpenChange, clients,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  clients: Client[]
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('none')
  const [type, setType] = useState('WEBSITE')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setClientId('none'); setType('WEBSITE'); setDescription(''); setStartDate(''); setDeadline(''); setBudget('') }
  }, [open])

  const submit = async () => {
    if (!name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      await api.create('projects', {
        name: name.trim(),
        clientId: clientId === 'none' ? '' : clientId,
        type,
        description,
        startDate,
        deadline,
        ...(budget.trim() !== '' ? { budget: Number(budget) } : {}),
      })
      toast.success('Project created')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">New project</DialogTitle>
          <DialogDescription className="text-xs">Set up the project — you can add tasks, team and links once it&apos;s created.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bloom & Co Website" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — internal</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PROJECT_TYPES).map((t) => (
                    <SelectItem key={t} value={t}>{metaOf(PROJECT_TYPES, t).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, goals, anything worth remembering…" className="min-h-[64px] text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget ($)</Label>
              <Input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" className="text-xs" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  Project detail workspace                                    */
/* ──────────────────────────────────────────────────────────── */

export function ProjectDetailView({ id }: { id: string }) {
  const { navigate } = useHashRoute()
  const qc = useQueryClient()
  const { currentUserId } = useUi()
  const [editOpen, setEditOpen] = useState(false)
  const [taskEdit, setTaskEdit] = useState<{ open: boolean; task: ProjectTask | null }>({ open: false, task: null })

  const { data: project, isLoading } = useQuery({ queryKey: ['projects', id], queryFn: () => api.get<Project>('projects', id) })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.list<User>('users') })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => api.list<Client>('clients') })
  const { data: activities } = useQuery({ queryKey: ['activities', 'project', id], queryFn: () => api.list<Activity>('activities', { projectId: id }) })

  const updateStatus = async (status: string) => {
    try {
      await api.update('projects', id, { status })
      toast.success(`Status → ${metaOf(PROJECT_STATUS, status).label.toLowerCase()}`)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to update status')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Project not found"
        description="It may have been deleted."
        action={<Button variant="outline" size="sm" onClick={() => navigate('#/projects')}><ArrowLeft className="h-3.5 w-3.5" /> Back to projects</Button>}
      />
    )
  }

  const tasks = project.tasks || []
  const { done, total, pct } = progressOf(tasks)
  const left = daysLeft(project.deadline)
  const deadlineUrgent = left !== null && left < 7 && project.status !== 'COMPLETED'
  const teamIds = parseJsonArray(project.team)
  const teamMembers = (users || []).filter((u) => teamIds.includes(u.id))
  const links = parseJsonObjects<LinkRow>(project.links)
  const meetings = project.meetings || []

  return (
    <div className="space-y-4">
      {/* ── header card ── */}
      <Card className="p-5 gap-0">
        <Button
          variant="ghost" size="sm"
          className="h-7 -ml-2 mb-3 w-fit text-xs text-muted-foreground"
          onClick={() => navigate('#/projects')}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge map={PROJECT_TYPES} value={project.type} size="sm" />
              <StatusBadge map={PROJECT_STATUS} value={project.status} size="sm" />
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs">
              {project.client ? (
                <button
                  onClick={() => navigate(`#/clients?selected=${project.client!.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 hover:bg-muted transition-colors"
                >
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{project.client.name}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground px-1">
                  <Building2 className="h-3 w-3" /> Internal — no client
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {project.startDate ? fmtDate(project.startDate, 'MMM d') : '—'}
                <span>→</span>
                <span className={cn(deadlineUrgent && 'text-rose-600 font-medium')}>
                  {project.deadline ? fmtDate(project.deadline, 'MMM d') : 'no deadline'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3 w-3" /> {fmtMoney(project.budget)}
              </span>
              {teamMembers.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="flex -space-x-1.5">
                    {teamMembers.map((m) => (
                      <Avatar key={m.id} className="h-5 w-5 ring-2 ring-background" title={m.name}>
                        <AvatarFallback style={{ background: avatarColor(m.name) }} className="text-[8px] text-white">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={project.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{metaOf(PROJECT_STATUS, s).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>
      </Card>

      {/* ── workspace grid ── */}
      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {/* tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-teal-600" /> Tasks
                  <span className="text-xs font-normal text-muted-foreground">{done}/{total} done</span>
                </CardTitle>
                <div className="flex items-center gap-2.5">
                  <div className="hidden sm:flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 w-24" />
                    <span className="text-xs font-medium tabular-nums">{pct}%</span>
                  </div>
                  <Button
                    size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setTaskEdit({ open: true, task: null })}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add task
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {total === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  title="No tasks yet"
                  description="Break the project down into trackable tasks with owners and deadlines."
                  className="py-8"
                  action={
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setTaskEdit({ open: true, task: null })}>
                      <Plus className="h-4 w-4" /> Add the first task
                    </Button>
                  }
                />
              ) : (
                <div className="grid md:grid-cols-4 gap-3">
                  {Object.keys(TASK_STATUS).map((s) => {
                    const meta = metaOf(TASK_STATUS, s)
                    const textCls = meta.color.split(' ').find((c) => c.startsWith('text-'))
                    const colTasks = tasks.filter((t) => t.status === s)
                    return (
                      <div key={s} className="rounded-lg border bg-muted/20 p-2 flex flex-col">
                        <div className="flex items-center justify-between px-1 pb-2">
                          <span className={cn('text-[11px] font-semibold uppercase tracking-wide', textCls)}>{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{colTasks.length}</span>
                        </div>
                        <div className="space-y-1.5 max-h-96 overflow-y-auto">
                          {colTasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => setTaskEdit({ open: true, task: t })} />)}
                          {colTasks.length === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center py-4">Nothing here</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* decisions */}
          <DecisionsCard project={project} />

          {/* meetings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-teal-600" /> Meetings
                <span className="text-xs font-normal text-muted-foreground">({meetings.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {meetings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No meetings linked to this project yet.</p>
              ) : (
                meetings.map((m: Meeting) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`#/meetings?selected=${m.id}`)}
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
            </CardContent>
          </Card>

          {/* activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-emerald-600" /> Activity timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <ActivityComposer projectId={id} />
              <Timeline activities={activities || []} />
            </CardContent>
          </Card>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overview</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground">Progress</p>
                  <p className="text-2xl font-semibold tabular-nums mt-1">{pct}%</p>
                  <Progress value={pct} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1.5">{done} of {total} tasks done</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] text-muted-foreground">Deadline</p>
                  {!project.deadline ? (
                    <>
                      <p className="text-2xl font-semibold mt-1 text-muted-foreground">—</p>
                      <p className="text-[10px] text-muted-foreground mt-2">No deadline set</p>
                    </>
                  ) : (
                    <>
                      <p className={cn('text-2xl font-semibold tabular-nums mt-1', deadlineUrgent && 'text-rose-600')}>
                        {project.status === 'COMPLETED' ? '✓' : left !== null && left < 0 ? `${-left}d` : `${left}d`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {project.status === 'COMPLETED'
                          ? `Completed · was ${fmtDate(project.deadline, 'MMM d')}`
                          : left !== null && left < 0
                            ? `${fmtDate(project.deadline, 'MMM d')} · overdue`
                            : `left · ${fmtDate(project.deadline, 'MMM d')}`}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Tasks by status</p>
                {Object.keys(TASK_STATUS).map((s) => {
                  const count = tasks.filter((t) => t.status === s).length
                  const w = total ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{metaOf(TASK_STATUS, s).label}</span>
                        <span className="font-medium tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', TASK_BAR[s])} style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {project.notes && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs whitespace-pre-wrap break-words">{project.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4 text-teal-600" /> Files & links
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="space-y-1.5">
                {links.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No links yet — add Figma, GitHub or staging URLs when editing the project.
                  </p>
                ) : (
                  links.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border px-2.5 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium truncate">{l.label || l.url}</span>
                        <span className="block text-[10px] text-muted-foreground truncate">{l.url}</span>
                      </span>
                    </a>
                  ))
                )}
              </div>
              <AttachmentSection entityType="PROJECT" entityId={project.id} className="border-t pt-3" />
            </CardContent>
          </Card>
        </div>
      </div>

      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} users={users || []} clients={clients || []} />
      <TaskDialog
        open={taskEdit.open}
        task={taskEdit.task}
        projectId={id}
        users={users || []}
        defaultAssignee={currentUserId}
        onOpenChange={(o) => setTaskEdit((s) => ({ open: o, task: o ? s.task : null }))}
      />
    </div>
  )
}

/* ── task row (kanban cell) ── */

function TaskRow({ task, onClick }: { task: ProjectTask; onClick: () => void }) {
  const overdue = isOverdue(task.deadline) && task.status !== 'DONE'
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-background px-2.5 py-2 hover:border-emerald-300 hover:shadow-sm transition-all space-y-1.5"
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-medium leading-4 line-clamp-2 flex-1">{task.title}</p>
        {task.assignee && (
          <Avatar className="h-5 w-5 shrink-0" title={task.assignee.name}>
            <AvatarFallback style={{ background: avatarColor(task.assignee.name) }} className="text-[8px] text-white">
              {initials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <StatusBadge map={PRIORITY} value={task.priority} size="sm" />
        {task.deadline ? (
          <span className={cn('inline-flex items-center gap-1 text-[10px]', overdue ? 'text-rose-600 font-medium' : 'text-muted-foreground')}>
            <CalendarDays className="h-2.5 w-2.5" /> {fmtDate(task.deadline, 'MMM d')}
          </span>
        ) : null}
      </div>
    </button>
  )
}

/* ── task create/edit dialog ── */

function TaskDialog({
  open, onOpenChange, projectId, task, users, defaultAssignee,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId: string
  task: ProjectTask | null
  users: User[]
  defaultAssignee?: string | null
}) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [status, setStatus] = useState('TODO')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [assigneeId, setAssigneeId] = useState('none')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title || '')
      setDescription(task?.description || '')
      setPriority(task?.priority || 'MEDIUM')
      setStatus(task?.status || 'TODO')
      setDeadline(toInputDate(task?.deadline))
      setNotes(task?.notes || '')
      setAssigneeId(task?.assigneeId || defaultAssignee || 'none')
    }
  }, [open, task, defaultAssignee])

  const submit = async () => {
    if (!title.trim()) { toast.error('Task title is required'); return }
    setSaving(true)
    const payload = {
      title: title.trim(), description, priority, status, deadline, notes,
      assigneeId: assigneeId === 'none' ? '' : assigneeId,
    }
    try {
      if (task) {
        await api.update('tasks', task.id, payload)
        toast.success('Task updated')
      } else {
        await api.create('tasks', { ...payload, projectId })
        toast.success('Task added')
      }
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!task) return
    try {
      await api.remove('tasks', task.id)
      toast.success('Task deleted')
      qc.invalidateQueries()
      setConfirmDelete(false)
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete task')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{task ? 'Edit task' : 'Add task'}</DialogTitle>
          <DialogDescription className="text-xs">
            {task ? 'Update details, status or reassign the owner.' : 'New tasks are logged on the project timeline automatically.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title <span className="text-rose-500">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design homepage hero" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px] text-sm" placeholder="What exactly needs to happen?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PRIORITY).map((p) => (
                    <SelectItem key={p} value={p}>{metaOf(PRIORITY, p).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(TASK_STATUS).map((s) => (
                    <SelectItem key={s} value={s}>{metaOf(TASK_STATUS, s).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[48px] text-sm" placeholder="Context, links, blockers…" />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {task ? (
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base">Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                    &ldquo;{title}&rdquo; will be removed permanently. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white">
                    Delete task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {task ? 'Save changes' : 'Add task'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── decisions card ── */

function DecisionsCard({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(project.decisions || '')
  const [saving, setSaving] = useState(false)
  const dirty = value !== (project.decisions || '')

  useEffect(() => { setValue(project.decisions || '') }, [project.decisions])

  const save = async () => {
    setSaving(true)
    try {
      await api.update('projects', project.id, { decisions: value })
      toast.success('Decisions saved')
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save decisions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gavel className="h-4 w-4 text-violet-600" /> Decisions & context
          </CardTitle>
          <Button
            size="sm" variant={dirty ? 'default' : 'outline'}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            onClick={save} disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Important project decisions & context — approvals, scope calls, client preferences, why things are the way they are…"
          className="min-h-[100px] text-sm"
        />
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Anyone dropping into this project reads this first.
        </p>
      </CardContent>
    </Card>
  )
}

/* ── edit project dialog ── */

function EditProjectDialog({
  open, onOpenChange, project, users, clients,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project: Project
  users: User[]
  clients: Client[]
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('none')
  const [type, setType] = useState('WEBSITE')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')
  const [team, setTeam] = useState<string[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [decisions, setDecisions] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && project) {
      setName(project.name)
      setClientId(project.clientId || 'none')
      setType(project.type)
      setDescription(project.description || '')
      setStartDate(toInputDate(project.startDate))
      setDeadline(toInputDate(project.deadline))
      setBudget(project.budget != null ? String(project.budget) : '')
      setTeam(parseJsonArray(project.team))
      setLinks(parseJsonObjects<LinkRow>(project.links).map((l) => ({ label: l.label || '', url: l.url || '' })))
      setDecisions(project.decisions || '')
      setNotes(project.notes || '')
    }
  }, [open, project])

  const toggleTeam = (uid: string) =>
    setTeam((t) => (t.includes(uid) ? t.filter((x) => x !== uid) : [...t, uid]))

  const submit = async () => {
    if (!name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      await api.update('projects', project.id, {
        name: name.trim(),
        clientId: clientId === 'none' ? '' : clientId,
        type,
        description,
        startDate,
        deadline,
        ...(budget.trim() !== '' ? { budget: Number(budget) } : {}),
        team: JSON.stringify(team),
        links: JSON.stringify(links.filter((l) => l.label.trim() && l.url.trim())),
        decisions,
        notes,
      })
      toast.success('Project updated')
      qc.invalidateQueries()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Edit project</DialogTitle>
          <DialogDescription className="text-xs">Update basics, team and links. Changes are visible to the whole team instantly.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name <span className="text-rose-500">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — internal</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PROJECT_TYPES).map((t) => (
                    <SelectItem key={t} value={t}>{metaOf(PROJECT_TYPES, t).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px] text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget ($)</Label>
              <Input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} className="text-xs" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Team</Label>
            <div className="rounded-lg border divide-y max-h-36 overflow-y-auto">
              {users.length === 0 && <p className="text-xs text-muted-foreground p-3">No team members found.</p>}
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                  <Checkbox checked={team.includes(u.id)} onCheckedChange={() => toggleTeam(u.id)} />
                  <Avatar className="h-6 w-6">
                    <AvatarFallback style={{ background: avatarColor(u.name) }} className="text-[9px] text-white">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 min-w-0 truncate font-medium text-xs">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">{u.role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Links (Figma, GitHub, staging…)</Label>
            <div className="space-y-1.5">
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={l.label}
                    onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Label (e.g. Figma)"
                    className="h-8 text-xs w-32 sm:w-44 shrink-0"
                  />
                  <Input
                    value={l.url}
                    onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://…"
                    className="h-8 text-xs flex-1"
                  />
                  <button
                    onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-rose-600 shrink-0"
                    title="Remove link"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLinks((arr) => [...arr, { label: '', url: '' }])}>
                <Plus className="h-3 w-3" /> Add link
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Decisions</Label>
              <Textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} className="min-h-[60px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px] text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
