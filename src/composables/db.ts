// composables/db.ts
import { Dexie, type EntityTable } from 'dexie'

// 定义 Column 和 Task 的类型（与组件中的保持一致）
export interface Task {
  id: string
  content: string
}

export interface Column {
  id: string
  title: string
  isAddTask: boolean
  isChangeTitle: boolean
  tasks: Task[]
  mode: 'horizontal' | 'vertical'
}

// 定义数据库类
class KanbanDatabase extends Dexie {
  columns!: EntityTable<Column, 'id'> // 主键为 string (id)

  constructor() {
    super('KanbanDB')
    this.version(1).stores({
      columns: 'id, title', // 主键 id，并给 title 建立索引
    })
  }
}

export const db = new KanbanDatabase()

export async function saveColumns(data: Column[]) {
  try {
    const plainData = JSON.parse(JSON.stringify(data))
    await db.columns.clear()
    await db.columns.bulkAdd(plainData)
  } catch (error) {
    console.error('error', error)
  }
}

export async function getColumns() {
  return await db.columns.toArray()
}
