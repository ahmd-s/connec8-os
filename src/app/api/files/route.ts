import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveFile } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const ENTITY_FK: Record<string, string> = {
  LEAD: 'leadId',
  SAAS_LEAD: 'saasLeadId',
  SAAS_FEATURE: 'featureId',
  KNOWLEDGE: 'knowledgeId',
}

/** List attachments for an entity: GET /api/files?entityType=PROJECT&entityId=xxx */
export async function GET(req: NextRequest) {
  try {
    const entityType = req.nextUrl.searchParams.get('entityType')
    const entityId = req.nextUrl.searchParams.get('entityId')
    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }
    const where: any = { entityType, entityId }
    const fk = ENTITY_FK[entityType]
    if (fk) where[fk] = entityId
    const atts = await db.attachment.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(atts.map((a) => ({ ...a, url: `/api/files/${a.id}` })))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'List failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const entityType = String(form.get('entityType') || 'LEAD')
    const entityId = String(form.get('entityId') || '')
    if (!file || !entityId) return NextResponse.json({ error: 'file and entityId are required' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Max file size is 10MB' }, { status: 400 })

    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
    const stored = `${Date.now()}_${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())
    const storedPath = await saveFile(stored, bytes)

    const fk = ENTITY_FK[entityType]
    const att = await db.attachment.create({
      data: {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        path: storedPath,
        entityType,
        entityId,
        ...(fk ? { [fk]: entityId } : {}),
      },
    })
    return NextResponse.json({ ...att, url: `/api/files/${att.id}` }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}
