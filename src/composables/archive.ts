// composables/archive.ts
// Kanban backup package (.zip) helpers.
// Layout inside the zip:
//   data.json               — { version, boards, columns, attachments (metadata) }
//   attachments/<id>        — raw binary for each attachment
// The zip format carries the full kanban data including binary attachments,
// while the xlsx export stays a plain-text format (images become placeholders).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Attachment, Board, Column } from '@/types'

export type BackupAttachmentMeta = Omit<Attachment, 'blob'>

export interface BackupData {
  version: 1
  exportedAt: string
  boards: Board[]
  columns: Column[]
  /** Attachment metadata; the binary payload lives at `attachments/<id>`. */
  attachments: BackupAttachmentMeta[]
}

export interface ImportedBackupBoard {
  name: string
  columns: Column[]
  /** Set when this part could not be parsed; the rest still imports. */
  error?: string
}

export interface ImportedBackup {
  boards: ImportedBackupBoard[]
  attachments: Attachment[]
}

function localDateString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Trigger a browser download for a Blob. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Export every board plus all attachments into a single `.zip` backup package.
 * `loadColumns` and `loadAttachments` mirror the db module's signatures so the
 * caller can inject them (or pass db helpers directly).
 */
export async function exportBackupZip(
  boards: Board[],
  loadColumns: (boardId: string) => Promise<Column[]>,
  loadAttachments: () => Promise<Attachment[]>,
): Promise<void> {
  const columns: Column[] = []
  for (const board of boards) {
    columns.push(...(await loadColumns(board.id)))
  }
  const attachments = await loadAttachments()

  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    boards,
    columns,
    attachments: attachments.map(({ blob: _blob, ...meta }) => meta),
  }

  const files: Record<string, Uint8Array> = {
    'data.json': strToU8(JSON.stringify(data)),
  }
  for (const attachment of attachments) {
    files[`attachments/${attachment.id}`] = new Uint8Array(await attachment.blob.arrayBuffer())
  }

  const zipped = zipSync(files)
  downloadBlob(
    new Blob([zipped], { type: 'application/zip' }),
    `kanban-backup-${localDateString()}.zip`,
  )
}

/**
 * Parse a `.zip` backup package back into boards + attachments.
 * Board/column/task ids are preserved as exported, so attachments stay linked.
 */
export async function importBackupZip(file: File): Promise<ImportedBackup> {
  const zipped = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const dataFile = zipped['data.json']
  if (!dataFile) throw new Error('Unrecognized backup format: missing data.json')

  let data: BackupData
  try {
    data = JSON.parse(strFromU8(dataFile)) as BackupData
  } catch {
    throw new Error('Unrecognized backup format: data.json is not valid JSON')
  }
  if (data.version !== 1) throw new Error(`Unsupported backup version: ${String(data.version)}`)

  const columnsByBoard = new Map<string, Column[]>()
  for (const column of data.columns ?? []) {
    const list = columnsByBoard.get(column.boardId)
    if (list) list.push(column)
    else columnsByBoard.set(column.boardId, [column])
  }

  const boards: ImportedBackupBoard[] = (data.boards ?? []).map((board) => ({
    name: board.name,
    columns: columnsByBoard.get(board.id) ?? [],
  }))

  const attachments: Attachment[] = []
  for (const meta of data.attachments ?? []) {
    const bytes = zipped[`attachments/${meta.id}`]
    if (!bytes) continue
    attachments.push({ ...meta, blob: new Blob([bytes], { type: meta.mime }) })
  }

  return { boards, attachments }
}
