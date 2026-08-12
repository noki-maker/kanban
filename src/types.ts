// Plain data model: contains only fields that need persisting; UI state (e.g. editing) is not part of it
export interface Task {
  id: string
  content: string
}

export interface Column {
  id: string
  title: string
  tasks: Task[]
  mode: 'horizontal' | 'vertical'
  order: number
}
