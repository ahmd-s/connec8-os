'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { User } from '@/lib/types'
import { initials, avatarColor } from '@/lib/format'
import { USER_ROLES } from '@/lib/labels'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, AlarmClock, Send, Presentation, Package, FolderKanban,
  Briefcase, BookUser, CalendarDays, Lightbulb, BarChart3, Settings2, ChevronDown, Hexagon,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV: { group: string; items: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; hash: string }[] }[] = [
  {
    group: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hash: '#/dashboard' },
      { key: 'analytics', label: 'Analytics', icon: BarChart3, hash: '#/analytics' },
    ],
  },
  {
    group: 'Pipeline',
    items: [
      { key: 'leads', label: 'Leads', icon: Users, hash: '#/leads' },
      { key: 'followups', label: 'Follow-ups', icon: AlarmClock, hash: '#/followups' },
      { key: 'outreach', label: 'Outreach', icon: Send, hash: '#/outreach' },
      { key: 'pitches', label: 'Pitches', icon: Presentation, hash: '#/pitches' },
    ],
  },
  {
    group: 'Delivery',
    items: [
      { key: 'projects', label: 'Projects', icon: FolderKanban, hash: '#/projects' },
      { key: 'clients', label: 'Clients', icon: Briefcase, hash: '#/clients' },
      { key: 'meetings', label: 'Meetings', icon: CalendarDays, hash: '#/meetings' },
    ],
  },
  {
    group: 'Products',
    items: [{ key: 'products', label: 'Products & SaaS', icon: Package, hash: '#/products' }],
  },
  {
    group: 'Memory',
    items: [
      { key: 'contacts', label: 'Contacts', icon: BookUser, hash: '#/contacts' },
      { key: 'knowledge', label: 'Knowledge', icon: Lightbulb, hash: '#/knowledge' },
    ],
  },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { segments } = useHashRoute()
  const current = segments[0] || 'dashboard'
  const { currentUserId, setCurrentUserId } = useUi()

  const { data: users } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => api.list('users') })
  const me = users?.find((u) => u.id === currentUserId) || users?.[0]

  const setActive = (key: string, root?: string) => (root ? current === root : current === key)

  return (
    <aside className="flex h-full w-full flex-col bg-zinc-950 text-zinc-300">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30">
          <Hexagon className="h-4.5 w-4.5 text-emerald-400" strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-white tracking-tight">Connec8 <span className="text-emerald-400">OS</span></p>
          <p className="text-[10px] text-zinc-500">Business command center</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 sidebar-scroll" aria-label="Main navigation">
        {NAV.map((group) => (
          <div key={group.group}>
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{group.group}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = current === item.key
                return (
                  <a
                    key={item.key}
                    href={item.hash}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                      active ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-emerald-400" aria-hidden />}
                    <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300')} />
                    {item.label}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">System</p>
          <a
            href="#/settings"
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              current === 'settings' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
            )}
          >
            {current === 'settings' && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-emerald-400" aria-hidden />}
            <Settings2 className={cn('h-4 w-4 shrink-0', current === 'settings' ? 'text-emerald-400' : 'text-zinc-500')} />
            Settings
          </a>
        </div>
      </nav>

      {/* User switcher */}
      <div className="border-t border-white/10 p-3 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors text-left">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: me ? avatarColor(me.name) : '#3f3f46' }}
            >
              {me ? initials(me.name) : '?'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-white truncate">{me?.name || 'Select user'}</span>
              <span className="block text-[10px] text-zinc-500 truncate">{me ? USER_ROLES[me.role]?.label || me.role : '—'}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Signed in as</DropdownMenuLabel>
            {(users || []).map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => setCurrentUserId(u.id)} className="gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ background: avatarColor(u.name) }}>
                  {initials(u.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] leading-4">{u.name}</span>
                  <span className="block text-[10px] text-muted-foreground leading-3">{USER_ROLES[u.role]?.label || u.role}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="#/settings" className="text-xs text-muted-foreground cursor-pointer">Manage team in Settings →</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
