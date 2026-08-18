// composables/db.ts
import { Dexie, type EntityTable } from 'dexie'
import type { Attachment, Board, Column } from '@/types'

const DEFAULT_BOARD_NAME = 'Default'

// Define the database class
class KanbanDatabase extends Dexie {
  boards!: EntityTable<Board, 'id'> // Primary key is a string (id)
  columns!: EntityTable<Column, 'id'> // Primary key is a string (id)
  attachments!: EntityTable<Attachment, 'id'> // Primary key is a string (id)

  constructor() {
    super('KanbanDB')
    this.version(1).stores({
      columns: 'id, title', // Legacy schema: columns without boardId
    })
    this.version(2)
      .stores({
        boards: 'id, name, order',
        columns: 'id, boardId, title', // Primary key: id, indexed by boardId and title
      })
      .upgrade(async (tx) => {
        // Migrate legacy single-board data: assign it to a freshly created default board
        const legacy = (await tx.table('columns').toArray()) as Array<
          Partial<Column> & { id: string }
        >
        const orphans = legacy.filter((c) => !c.boardId)
        if (orphans.length > 0) {
          const board: Board = { id: crypto.randomUUID(), name: DEFAULT_BOARD_NAME, order: 0 }
          await tx.table('boards').add(board)
          for (const c of orphans) {
            await tx.table('columns').put({ ...c, boardId: board.id })
          }
        }
      })
    this.version(3).stores({
      attachments: 'id, taskId, createdAt', // Indexed by taskId for cascade cleanup
    })
  }
}

export const db = new KanbanDatabase()

// —— Boards ——

export async function getBoards(): Promise<Board[]> {
  try {
    const boards = await db.boards.toArray()
    return boards.sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Failed to load boards:', error)
    return []
  }
}

export async function createBoard(name: string): Promise<Board> {
  const boards = await db.boards.toArray()
  const board: Board = {
    id: crypto.randomUUID(),
    name,
    order: boards.length,
  }
  await db.boards.add(board)
  return board
}

export async function renameBoard(id: string, name: string): Promise<void> {
  await db.boards.update(id, { name })
}

export async function deleteBoard(id: string): Promise<void> {
  await db.transaction('rw', db.boards, db.columns, db.attachments, async () => {
    const boardColumns = await db.columns.where('boardId').equals(id).toArray()
    await db.boards.delete(id)
    await db.columns.where('boardId').equals(id).delete()
    const taskIds = boardColumns.flatMap((c) => c.tasks.map((t) => t.id))
    if (taskIds.length > 0) {
      await db.attachments.where('taskId').anyOf(taskIds).delete()
    }
  })
}

// —— Columns ——

// Incremental save: write changed records by primary key and remove columns no longer on the board
export async function saveColumns(boardId: string, data: Column[]): Promise<void> {
  try {
    // Persist the current array order so it survives a page refresh
    const plainData = data.map((c, index) => ({
      ...(JSON.parse(JSON.stringify(c)) as Column),
      boardId,
      order: index,
    }))
    await db.transaction('rw', db.columns, async () => {
      await db.columns.bulkPut(plainData)
      await db.columns
        .where('boardId')
        .equals(boardId)
        .and((c) => !plainData.some((p) => p.id === c.id))
        .delete()
    })
  } catch (error) {
    console.error('Failed to save columns:', error)
  }
}

export async function getColumns(boardId: string): Promise<Column[]> {
  try {
    // Old data may be missing mode / tasks / title / order fields; fill in defaults on read
    // so state like column mode and order stay consistent across sessions
    const raw = (await db.columns.where('boardId').equals(boardId).toArray()) as Array<
      Partial<Column> & { id: string }
    >
    const normalized: Column[] = raw.map((c, index) => ({
      id: c.id,
      boardId,
      title: typeof c.title === 'string' ? c.title : '',
      tasks: Array.isArray(c.tasks) ? c.tasks : [],
      mode: c.mode === 'vertical' ? 'vertical' : 'horizontal',
      order: typeof c.order === 'number' ? c.order : index,
    }))

    // If any fields were corrected, write them back so we don't re-normalize on every load
    const needsWriteBack = normalized.some((c, i) => {
      const r = raw[i]
      if (!r) return false
      return c.title !== r.title || c.mode !== r.mode || c.tasks !== r.tasks || c.order !== r.order
    })
    if (needsWriteBack) await db.columns.bulkPut(normalized)

    // Return columns in their persisted order
    return normalized.sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Failed to load columns:', error)
    return []
  }
}

// —— Attachments ——

export async function addAttachment(input: {
  taskId: string
  fileName: string
  mime: string
  blob: Blob
}): Promise<Attachment> {
  const attachment: Attachment = {
    id: crypto.randomUUID(),
    taskId: input.taskId,
    fileName: input.fileName,
    mime: input.mime,
    blob: input.blob,
    size: input.blob.size,
    createdAt: Date.now(),
  }
  await db.attachments.add(attachment)
  return attachment
}

export async function getAttachment(id: string): Promise<Attachment | undefined> {
  return db.attachments.get(id)
}

/** Load all attachments referenced by the given task ids. */
export async function getAttachmentsByTaskIds(taskIds: string[]): Promise<Attachment[]> {
  if (taskIds.length === 0) return []
  return db.attachments.where('taskId').anyOf(taskIds).toArray()
}

/** Load every attachment (used for zip backups). */
export async function getAttachments(): Promise<Attachment[]> {
  return db.attachments.toArray()
}

/** Delete every attachment belonging to the given task ids (cascade cleanup). */
export async function deleteAttachmentsByTaskIds(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return
  await db.attachments.where('taskId').anyOf(taskIds).delete()
}

/** Replace all attachments of a task with the given list (used on import). */
export async function bulkAddAttachments(attachments: Attachment[]): Promise<void> {
  if (attachments.length === 0) return
  await db.attachments.bulkPut(attachments)
}

// —— Search ——

export interface BoardWithColumns extends Board {
  columns: Column[]
}

/** Read all boards and their columns in one pass (used for cross-board search). */
export async function getAllData(): Promise<BoardWithColumns[]> {
  try {
    const [boards, allColumns] = await Promise.all([db.boards.toArray(), db.columns.toArray()])
    // Normalize raw records: old data may be missing title / tasks / mode / order fields
    const columnsByBoard = new Map<string, Column[]>()
    for (const c of allColumns) {
      const column: Column = {
        id: c.id,
        boardId: c.boardId,
        title: typeof c.title === 'string' ? c.title : '',
        tasks: Array.isArray(c.tasks) ? c.tasks : [],
        mode: c.mode === 'vertical' ? 'vertical' : 'horizontal',
        order: typeof c.order === 'number' ? c.order : 0,
      }
      const list = columnsByBoard.get(column.boardId)
      if (list) list.push(column)
      else columnsByBoard.set(column.boardId, [column])
    }
    return boards
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((board) => ({
        ...board,
        columns: (columnsByBoard.get(board.id) ?? []).sort((a, b) => a.order - b.order),
      }))
  } catch (error) {
    console.error('Failed to load all data:', error)
    return []
  }
}
