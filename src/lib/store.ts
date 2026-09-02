'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QuickAddType =
  | 'lead' | 'contact' | 'outreach' | 'followup' | 'meeting' | 'pitch'
  | 'project' | 'product' | 'feature' | 'client' | 'task' | 'note'

interface UiState {
  currentUserId: string | null
  setCurrentUserId: (id: string) => void

  quickAddOpen: boolean
  quickAddType: QuickAddType | null
  openQuickAdd: (type?: QuickAddType | null) => void
  closeQuickAdd: () => void

  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      currentUserId: null,
      setCurrentUserId: (id) => set({ currentUserId: id }),

      quickAddOpen: false,
      quickAddType: null,
      openQuickAdd: (type = null) => set({ quickAddOpen: true, quickAddType: type }),
      closeQuickAdd: () => set({ quickAddOpen: false, quickAddType: null }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),
    }),
    {
      name: 'connec8-ui',
      partialize: (s) => ({ currentUserId: s.currentUserId }) as UiState,
    }
  )
)
