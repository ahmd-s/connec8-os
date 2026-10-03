import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteFile, isBlobPath, readLocalFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const att = await db.attachment.findUnique({ where: { id } })
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const headers: Record<string, string> = {
      'Content-Type': att.mimeType || 'application/octet-stream',
      'Content-Disposition': `${req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${att.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=3600',
    }

    // Vercel Blob mode: storedPath is a full URL — proxy it so the file stays private behind the app.
    if (isBlobPath(att.path)) {
      const upstream = await fetch(att.path)
      if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'File not available' }, { status: 404 })
      return new NextResponse(upstream.body, { status: 200, headers })
    }

    // Local disk mode.
    const data = await readLocalFile(att.path)
    return new NextResponse(new Uint8Array(data), { status: 200, headers })
  } catch {
    return NextResponse.json({ error: 'File not available' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const att = await db.attachment.findUnique({ where: { id } })
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await deleteFile(att.path)
    await db.attachment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}
