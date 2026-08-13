// markdown-it-task-lists ships no type definitions; declare a minimal one here.
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListsOptions {
    /** Whether to disable checkboxes. Default: false */
    disabled?: boolean
    /** Whether to render a `<label>` wrapping the checkbox + text. Default: true */
    label?: boolean
    /** Whether to put the checkbox after the text. Default: false */
    labelAfter?: boolean
  }

  const plugin: (md: MarkdownIt, options?: TaskListsOptions) => void
  export default plugin
}
