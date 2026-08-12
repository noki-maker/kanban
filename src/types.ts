// Plain data model: contains only fields that need persisting; UI state (e.g. editing) is not part of it
export interface Task {
  id: string
  content: string
}

/** A kanban board: owns a set of columns. */
export interface Board {
  id: string
  name: string
  order: number
}

export interface Column {
  id: string
  boardId: string
  title: string
  tasks: Task[]
  mode: 'horizontal' | 'vertical'
  order: number
}
