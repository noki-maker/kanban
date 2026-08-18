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

/** A cross-board search hit: a matching board, column, or task. */
export type SearchResult =
  | { kind: 'board'; board: Board }
  | { kind: 'column'; board: Board; column: Column }
  | { kind: 'task'; board: Board; column: Column; task: Task }

/** A binary attachment (e.g. an uploaded image) referenced from a task's
 *  markdown content as `![name](attach://<id>)`. */
export interface Attachment {
  id: string
  /** The task this attachment belongs to; used for cascade cleanup. */
  taskId: string
  fileName: string
  mime: string
  blob: Blob
  size: number
  createdAt: number
}
