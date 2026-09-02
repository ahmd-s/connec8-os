'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { AttentionItem } from '@/lib/types'
import { fmtDayLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Bell, Plus, Search, Menu } from 'lucide-react'
import { AlertTriangle, AlarmClock, CalendarDays, Wrench, Reply, Building2, FolderKanban, UserCheck } from 'lucide-react'

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  overdue_followup: AlarmClock, followup_today: AlarmClock, reply_awaiting: Reply,
  feature_blocked: Wrench, deadline: FolderKanban, meeting: CalendarDays,
  client_issue: Building2, lead_inactive: Building2,
}

const SEV_STYLE: Record<string, string> = {
  high: 'bg-rose-50 text-rose-600 border-rose-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low: 'bg-sky-50 text-sky-600 border-sky-200',
}

export function entityHref(item: AttentionItem): string {
  switch (item.entityType) {
    case 'lead': return `#/leads/${item.entityId}`
    case 'saas_lead': return `#/products?lead=${item.entityId}`
    case 'feature': return `#/products?feature=${item.entityId}`
    case 'project': return `#/projects/${item.entityId}`
    case 'meeting': return `#/meetings?selected=${item.entityId}`
    case 'saas_client': return `#/products?client=${item.entityId}`
    default: return '#/followups'
  }
}

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { searchOpen, setSearchOpen, openQuickAdd } = useUi()
  const { navigate } = useHashRoute()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { data: notif } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications(),
    refetchInterval: 90_000,
  })

  const highCount = notif?.items.filter((i) => i.severity === 'high').length || 0
  const count = notif?.count || 0

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/85 backdrop-blur px-4 lg:px-6">
      {/* mobile menu */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      {/* search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search leads, clients, products, notes…</span>
        <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </button>

      <div className="flex-1" />

      <span className="hidden md:block text-xs text-muted-foreground tabular-nums">{fmtDayLabel(now)}</span>

      {/* notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${count})`}>
            <Bell className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white',
                highCount > 0 ? 'bg-rose-500' : 'bg-amber-500'
              )}>
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[380px] p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Needs attention</p>
            <span className="text-xs text-muted-foreground">{count} item{count === 1 ? '' : 's'}</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {(notif?.items || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">All clear. Nothing is slipping.</p>
            ) : (
              notif!.items.map((n, i) => {
                const Icon = KIND_ICON[n.kind] || AlertTriangle
                return (
                  <button
                    key={i}
                    onClick={() => navigate(entityHref(n))}
                    className="w-full flex gap-3 px-4 py-3 text-left border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <span className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', SEV_STYLE[n.severity])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-4 truncate">{n.title}</span>
                      <span className="block text-[11px] text-muted-foreground leading-4 mt-0.5 line-clamp-2">{n.reason}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <div className="px-4 py-2.5 border-t">
            <button onClick={() => navigate('#/dashboard')} className="text-xs font-medium text-teal-700 hover:underline">
              Open full Needs Attention on the Dashboard →
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Add button */}
      <Button size="sm" onClick={() => openQuickAdd()} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        <span className="hidden sm:inline">Add</span>
      </Button>
    </header>
  )
}

export { UserCheck }
