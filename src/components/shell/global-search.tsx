'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useUi } from '@/lib/store'
import { useHashRoute } from '@/hooks/use-hash-route'
import { SearchGroup } from '@/lib/types'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Users, Package, Wrench, Briefcase, FolderKanban, BookUser, Presentation,
  CalendarDays, Lightbulb, Building2, UserCheck,
} from 'lucide-react'
import { Loader2 } from 'lucide-react'

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lead: Users, saas_lead: UserCheck, product: Package, feature: Wrench,
  client: Briefcase, saas_client: Building2, project: FolderKanban,
  contact: BookUser, pitch: Presentation, meeting: CalendarDays, knowledge: Lightbulb,
}

export function GlobalSearch() {
  const { searchOpen, setSearchOpen } = useUi()
  const { navigate } = useHashRoute()
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(!searchOpen)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, setSearchOpen])

  const { data: groups, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: searchOpen && q.trim().length >= 2,
    staleTime: 10_000,
  })

  const close = () => { setSearchOpen(false); setQ('') }

  const go = (href: string) => { close(); navigate(href) }

  return (
    <CommandDialog open={searchOpen} onOpenChange={(o) => { if (!o) close() }}>
      <CommandInput placeholder="Search businesses, people, leads, features, notes…" value={q} onValueChange={setQ} />
      <CommandList className="min-h-[300px]">
        {isFetching && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching everything…
          </div>
        )}
        {!isFetching && q.trim().length >= 2 && (!groups || groups.length === 0) && (
          <CommandEmpty>No matches for “{q}”. Try a company, person or note keyword.</CommandEmpty>
        )}
        {q.trim().length < 2 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Type at least 2 characters — one search reveals everything related to a business or person.
          </div>
        )}
        {(groups || []).map((g: SearchGroup) => {
          const Icon = TYPE_ICON[g.type] || SearchGroupIcon
          return (
            <CommandGroup key={g.type} heading={g.label}>
              {g.items.map((item) => (
                <CommandItem key={`${g.type}-${item.id}`} value={`${item.title} ${item.subtitle || ''}`} onSelect={() => go(item.href)} className="gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{item.title}</span>
                    {item.subtitle && <span className="block text-xs text-muted-foreground truncate">{item.subtitle}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}

function SearchGroupIcon({ className }: { className?: string }) {
  return <BookUser className={className} />
}
