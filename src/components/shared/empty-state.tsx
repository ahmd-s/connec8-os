'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon, title, description, action, className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6 border border-dashed rounded-xl bg-muted/30', className)}>
      {Icon && (
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-background border shadow-sm">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
