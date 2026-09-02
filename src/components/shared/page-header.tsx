'use client'

import { cn } from '@/lib/utils'

/** Standard page header: title, description, right-side actions. */
export function PageHeader({
  title, description, actions, className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6', className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
