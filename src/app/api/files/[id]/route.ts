import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile, unlink } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const att = await db.attachment.findUnique({ where: { id } })
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const data = await readFile(path.join(UPLOAD_DIR, att.path))
    const download = req.nextUrl.searchParams.get('download') === '1'
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': att.mimeType || 'application/octet-stream',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${att.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'File not available' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const att = await db.attachment.findUnique({ where: { id } })
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await unlink(path.join(UPLOAD_DIR, att.path)).catch(() => {})
    await db.attachment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}
