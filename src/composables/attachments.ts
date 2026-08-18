// composables/attachments.ts
import {
  deleteAttachmentsByTaskIds,
  getAttachment,
  getAttachmentsByTaskIds,
} from '@/composables/db'
import type { Attachment } from '@/types'

/** Markdown reference prefix: `![](attach://<id>)`. */
export const ATTACH_PREFIX = 'attach://'

const ATTACH_RE = /attach:\/\/([0-9a-f-]{36})/g

/** In-memory cache of attachment id -> object URL (lazy revoke on replacement). */
const objectUrlCache = new Map<string, string>()

/** In-memory cache of attachment id -> Attachment record (avoids repeated DB reads). */
const recordCache = new Map<string, Attachment>()

function extractAttachmentIds(content: string): string[] {
  const ids: string[] = []
  for (const match of content.matchAll(ATTACH_RE)) {
    if (match[1]) ids.push(match[1])
  }
  return ids
}

export async function loadAttachmentsForTask(taskId: string): Promise<Attachment[]> {
  return getAttachmentsByTaskIds([taskId])
}

export async function loadAttachmentsForTasks(taskIds: string[]): Promise<Attachment[]> {
  return getAttachmentsByTaskIds(taskIds)
}

/** Delete every attachment of the given tasks and revoke their cached URLs. */
export async function deleteTaskAttachments(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return
  const records = await getAttachmentsByTaskIds(taskIds)
  await deleteAttachmentsByTaskIds(taskIds)
  for (const record of records) revokeAttachmentUrl(record.id)
}

/** Resolve an attachment id to a Blob-backed object URL, caching the result. */
export async function getAttachmentUrl(id: string): Promise<string | undefined> {
  const cached = objectUrlCache.get(id)
  if (cached) return cached
  let record = recordCache.get(id)
  if (!record) {
    record = await getAttachment(id)
    if (record) recordCache.set(id, record)
  }
  if (!record) return undefined
  const url = URL.createObjectURL(record.blob)
  objectUrlCache.set(id, url)
  return url
}

/** Revoke and drop a single attachment's cached object URL. */
export function revokeAttachmentUrl(id: string): void {
  const url = objectUrlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  objectUrlCache.delete(id)
  recordCache.delete(id)
}

/** Revoke all cached object URLs and drop the caches. */
export function clearAttachmentCache(): void {
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url)
  objectUrlCache.clear()
  recordCache.clear()
}

/** Replace every `attach://<id>` occurrence in content with the image's URL. */
export async function resolveAttachmentRefs(content: string): Promise<string> {
  const ids = extractAttachmentIds(content)
  if (ids.length === 0) return content
  let resolved = content
  for (const id of ids) {
    const url = await getAttachmentUrl(id)
    if (url) resolved = resolved.replaceAll(`attach://${id}`, url)
  }
  return resolved
}
