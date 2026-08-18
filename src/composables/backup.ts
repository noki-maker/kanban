// composables/backup.ts
// Excel (xlsx) backup helpers.
// Export format: one row per task (column info repeated on each row);
// columns without tasks are exported as a single info row with an empty Task cell.
// One board maps to one worksheet; the sheet name is the board name.
import * as XLSX from 'xlsx'
import { t } from '@/composables/i18n'
import type { Board, Column } from '@/types'

const HEADER_COLUMN_ID = 'Column ID'
const HEADER_COLUMN_TITLE = 'Column Title'
const HEADER_COLUMN_MODE = 'Column Mode'
const HEADER_TASK = 'Task'

const DEFAULT_SHEET_NAME = 'Board'

export interface ImportedBoard {
  name: string
  columns: Column[]
  /** Set when this particular sheet could not be parsed; the rest still imports. */
  error?: string
}

/** Strip characters that Excel forbids in worksheet names and trim to 31 chars. */
export function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[[\]:*?/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
  return cleaned || DEFAULT_SHEET_NAME
}

/** Strip characters that are illegal in file names. */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim()
  return cleaned || 'kanban'
}

/** Make a sheet name unique within a workbook by appending a numeric suffix. */
function uniqueSheetName(name: string, used: Set<string>): string {
  const base = sanitizeSheetName(name)
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    const suffix = ` (${index})`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    index++
  }
  used.add(candidate)
  return candidate
}

/**
 * Replace image attachment refs (`![name](attach://<id>)`) with a readable
 * placeholder. The xlsx export is a plain-text format and cannot carry binary
 * images; full fidelity lives in the zip backup instead.
 */
function placeholderAttachmentRefs(content: string): string {
  return content.replace(/!\[([^\]]*)\]\(attach:\/\/[^)]+\)/g, (_, alt: string) => {
    const label = alt.trim() || 'image'
    return `[${label} (attachment)]`
  })
}

/** Build a single worksheet from the columns of one board. */
function buildSheet(columns: Column[]): XLSX.WorkSheet {
  const header = [HEADER_COLUMN_ID, HEADER_COLUMN_TITLE, HEADER_COLUMN_MODE, HEADER_TASK]

  const rows: Record<string, string>[] = []
  for (const column of columns) {
    if (column.tasks.length === 0) {
      // Keep columns without tasks alive: a single row with an empty Task cell.
      rows.push({
        [HEADER_COLUMN_ID]: column.id,
        [HEADER_COLUMN_TITLE]: column.title,
        [HEADER_COLUMN_MODE]: column.mode,
        [HEADER_TASK]: '',
      })
      continue
    }
    for (const task of column.tasks) {
      rows.push({
        [HEADER_COLUMN_ID]: column.id,
        [HEADER_COLUMN_TITLE]: column.title,
        [HEADER_COLUMN_MODE]: column.mode,
        [HEADER_TASK]: placeholderAttachmentRefs(task.content),
      })
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header })
  // Hide the "Column ID" and "Column Mode" columns visually while keeping
  // their data in the file so later imports can still read them.
  ws['!cols'] = [{ wch: 36, hidden: true }, { wch: 24 }, { wch: 12, hidden: true }, { wch: 60 }]
  return ws
}

/** Export the current board to a single-sheet xlsx file named <board>-YYYY-MM-DD.xlsx. */
export function exportToExcel(columns: Column[], boardName: string): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildSheet(columns), sanitizeSheetName(boardName))
  XLSX.writeFile(wb, `${sanitizeFileName(boardName)}-${localDateString()}.xlsx`)
}

/** Export every board into one xlsx file, one sheet per board. */
export async function exportAllToExcel(
  boards: Board[],
  loadColumns: (boardId: string) => Promise<Column[]>,
): Promise<void> {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const board of boards) {
    const columns = await loadColumns(board.id)
    XLSX.utils.book_append_sheet(wb, buildSheet(columns), uniqueSheetName(board.name, used))
  }
  XLSX.writeFile(wb, `kanban-all-${localDateString()}.xlsx`)
}

/**
 * Parse every worksheet of a xlsx file into `{ name, columns }`, using the
 * sheet name as the board name. A sheet that cannot be parsed is reported
 * via its `error` field instead of failing the whole import.
 */
export async function importFromExcel(file: File): Promise<ImportedBoard[]> {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  if (wb.SheetNames.length === 0) throw new Error(t('noWorksheet'))

  const result: ImportedBoard[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const name = sheetName.trim() || DEFAULT_SHEET_NAME
    try {
      result.push({ name, columns: parseSheet(sheet) })
    } catch (error) {
      result.push({
        name,
        columns: [],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return result
}

/**
 * Parse a single worksheet into columns.
 * Rows with an empty Task cell represent columns without tasks.
 * Rows are grouped by Column ID (falling back to the title when the ID column
 * is missing, e.g. hand-made files).
 * Returns columns with the original IDs from the file (or a fresh UUID when
 * the ID is missing). Merge/conflict handling and boardId assignment are left
 * to the caller.
 */
function parseSheet(sheet: XLSX.WorkSheet): Column[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' })
  const headerRow = aoa[0]
  if (!headerRow) return []

  const header = headerRow.map(cellString)
  const idIdx = header.indexOf(HEADER_COLUMN_ID)
  const titleIdx = header.indexOf(HEADER_COLUMN_TITLE)
  const modeIdx = header.indexOf(HEADER_COLUMN_MODE)
  const taskIdx = header.indexOf(HEADER_TASK)
  if (titleIdx === -1 || taskIdx === -1) {
    throw new Error(t('unrecognizedFormat'))
  }
  const cell = (row: unknown[], idx: number) => (idx === -1 ? '' : cellString(row[idx]))

  const columnsByKey = new Map<string, Column>()
  for (const rawRow of aoa.slice(1)) {
    const title = cell(rawRow, titleIdx)
    if (!title) continue

    const id = cell(rawRow, idIdx)
    const key = id || `#title:${title}`
    let column = columnsByKey.get(key)
    if (!column) {
      column = {
        id: id || crypto.randomUUID(),
        boardId: '', // assigned by the caller on save
        title,
        tasks: [],
        mode: cell(rawRow, modeIdx) === 'vertical' ? 'vertical' : 'horizontal',
        order: 0, // rewritten by the caller on merge
      }
      columnsByKey.set(key, column)
    }

    const content = cell(rawRow, taskIdx)
    if (content) column.tasks.push({ id: crypto.randomUUID(), content })
  }
  return Array.from(columnsByKey.values())
}

/** Safely coerce an arbitrary sheet cell value to a trimmed string. */
function cellString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function localDateString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
