'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Attachment } from '@/lib/types'
import { fmtDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Loader2, Paperclip, FileText, Image as ImageIcon, Download, Trash2 } from 'lucide-react'

function fileIcon(mime?: string | null) {
  if (mime?.startsWith('image/')) return ImageIcon
  return FileText
}

/**
 * Attachments (images / screenshots / documents) for any entity.
 * Files are stored on disk (uploads/) and served through /api/files/:id.
 */
export function AttachmentSection({
  entityType, entityId, attachments, className,
}: {
  entityType: 'LEAD' | 'SAAS_LEAD' | 'SAAS_FEATURE' | 'KNOWLEDGE' | 'PROJECT' | 'CLIENT' | 'PRODUCT' | 'ACTIVITY'
  entityId: string
  attachments?: Attachment[]
  className?: string
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        await api.upload(f, { entityType, entityId })
      }
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`)
      qc.invalidateQueries()
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (id: string) => {
    try {
      await fetch(`/api/files/${id}`, { method: 'DELETE' })
      toast.success('Attachment removed')
      qc.invalidateQueries()
    } catch { toast.error('Failed to remove') }
  }

  const list = attachments || []

  return (
    <div className={className}>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Files & screenshots {list.length > 0 && `(${list.length})`}
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          Attach
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">No files yet. Screenshots, documents and images stay connected here.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((a) => {
            const Icon = fileIcon(a.mimeType)
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`${a.url}`} target="_blank" rel="noreferrer" className="text-xs font-medium truncate flex-1 hover:underline">
                  {a.fileName}
                </a>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline">{fmtDate(a.createdAt)}</span>
                <a href={`${a.url}?download=1`} className="text-muted-foreground hover:text-foreground" title="Download">
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-rose-600" title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
