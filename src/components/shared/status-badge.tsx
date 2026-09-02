'use client'

import { metaOf, EnumMeta } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/** Colored badge driven by a labels.ts metadata map. */
export function StatusBadge({
  map, value, className, size = 'default',
}: {
  map: Record<string, EnumMeta>
  value?: string | null
  className?: string
  size?: 'default' | 'sm'
}) {
  const meta = metaOf(map, value)
  return (
    <Badge
      variant="outline"
      className={cn(
        meta.color,
        'font-medium border whitespace-nowrap',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs',
        className
      )}
    >
      {meta.label}
    </Badge>
  )
}
