// Connec8 OS — pluggable file storage.
//
// Production (Vercel): uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
// Local development: falls back to the ./uploads directory on disk.
//
// `storedPath` saved on the Attachment record is either:
//   - a full https URL (Vercel Blob), or
//   - a bare filename inside ./uploads (local disk).

import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export function blobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function isBlobPath(storedPath: string): boolean {
  return storedPath.startsWith('http')
}

/** Persist bytes and return the storedPath to save on the record. */
export async function saveFile(storedName: string, bytes: Buffer): Promise<string> {
  if (blobStorageEnabled()) {
    const { put } = await import('@vercel/blob')
    const blob = await put(storedName, bytes, {
      access: 'public',
      addRandomSuffix: false,
    })
    return blob.url
  }

  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes)
  return storedName
}

/** Read bytes for streaming through the API (disk mode only). */
export async function readLocalFile(storedPath: string): Promise<Buffer> {
  return await readFileBuffer(path.join(UPLOAD_DIR, storedPath))
}

async function readFileBuffer(fullPath: string): Promise<Buffer> {
  const { readFile } = await import('fs/promises')
  return await readFile(fullPath)
}

/** Best-effort delete of the underlying blob/file. */
export async function deleteFile(storedPath: string): Promise<void> {
  try {
    if (isBlobPath(storedPath)) {
      const { del } = await import('@vercel/blob')
      await del(storedPath)
      return
    }
    await unlink(path.join(UPLOAD_DIR, storedPath)).catch(() => {})
  } catch {
    // Storage delete is best-effort; the DB record is removed regardless.
  }
}
