'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHashRoute } from '@/hooks/use-hash-route'
import { useUi } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Sidebar } from '@/components/shell/sidebar'
import { Topbar } from '@/components/shell/topbar'
import { GlobalSearch } from '@/components/shell/global-search'
import { QuickAdd } from '@/components/shell/quick-add'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import { DashboardView } from '@/components/views/dashboard'
import { LeadsView, LeadDetailView } from '@/components/views/leads'
import { FollowUpsView } from '@/components/views/followups'
import { OutreachView } from '@/components/views/outreach'
import { PitchesView } from '@/components/views/pitches'
import { ProductsView, ProductWorkspaceView } from '@/components/views/products'
import { ProjectsView, ProjectDetailView } from '@/components/views/projects'
import { ClientsView } from '@/components/views/clients'
import { ContactsView } from '@/components/views/contacts'
import { MeetingsView } from '@/components/views/meetings'
import { KnowledgeView } from '@/components/views/knowledge'
import { AnalyticsView } from '@/components/views/analytics'
import { SettingsView } from '@/components/views/settings'

function ViewRouter() {
  const { segments, query } = useHashRoute()
  const [root, param] = segments.length ? segments : ['dashboard']

  switch (root) {
    case 'dashboard': return <DashboardView />
    case 'leads': return param ? <LeadDetailView id={param} /> : <LeadsView />
    case 'followups': return <FollowUpsView />
    case 'outreach': return <OutreachView />
    case 'pitches': return <PitchesView />
    case 'products': return param ? <ProductWorkspaceView id={param} query={query.toString()} /> : <ProductsView />
    case 'projects': return param ? <ProjectDetailView id={param} /> : <ProjectsView />
    case 'clients': return <ClientsView query={query.toString()} />
    case 'contacts': return <ContactsView query={query.toString()} />
    case 'meetings': return <MeetingsView query={query.toString()} />
    case 'knowledge': return <KnowledgeView query={query.toString()} />
    case 'analytics': return <AnalyticsView />
    case 'settings': return <SettingsView />
    default: return <DashboardView />
  }
}

export function AppShell() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { currentUserId, setCurrentUserId } = useUi()

  // ensure a current user exists (defaults to first team member)
  useEffect(() => {
    if (currentUserId) return
    api.list('users').then((users) => {
      if (users?.length) setCurrentUserId(users[0].id)
    }).catch(() => {})
  }, [currentUserId, setCurrentUserId])

  return (
    <QueryClientProvider client={qc}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* desktop sidebar */}
        <div className="hidden lg:block w-[232px] shrink-0">
          <Sidebar />
        </div>

        {/* mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[264px] bg-zinc-950 border-zinc-800">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto" id="main-scroll">
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full">
              <ViewRouter />
            </div>
          </main>
        </div>
      </div>

      <GlobalSearch />
      <QuickAdd />
    </QueryClientProvider>
  )
}
