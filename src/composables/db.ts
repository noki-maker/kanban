// composables/db.ts
import { Dexie, type EntityTable } from 'dexie'
import type { Column } from '@/types'

// Define the database class
class KanbanDatabase extends Dexie {
  columns!: EntityTable<Column, 'id'> // Primary key is a string (id)

  constructor() {
    super('KanbanDB')
    this.version(1).stores({
      columns: 'id, title', // Primary key: id, with an index on title
    })
  }
}

export const db = new KanbanDatabase()

// Incremental save: write changed records by primary key and remove columns no longer on the board
export async function saveColumns(data: Column[]) {
  try {
    // Persist the current array order so it survives a page refresh
    const plainData = data.map((c, index) => ({
      ...(JSON.parse(JSON.stringify(c)) as Column),
      order: index,
    }))
    await db.transaction('rw', db.columns, async () => {
      await db.columns.bulkPut(plainData)
      await db.columns
        .where('id')
        .noneOf(plainData.map((c) => c.id))
        .delete()
    })
  } catch (error) {
    console.error('Failed to save columns:', error)
  }
}

export async function getColumns(): Promise<Column[]> {
  try {
    // Old data may be missing mode / tasks / title / order fields; fill in defaults on read
    // so state like column mode and order stay consistent across sessions
    const raw = (await db.columns.toArray()) as Array<Partial<Column> & { id: string }>
    const normalized: Column[] = raw.map((c, index) => ({
      id: c.id,
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
