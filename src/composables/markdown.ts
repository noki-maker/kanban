// Markdown rendering pipeline: markdown-it -> task lists -> syntax highlight -> sanitize
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

import 'highlight.js/styles/github.css'

const md: InstanceType<typeof MarkdownIt> = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // Fall through to escaped output
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`
  },
})

md.use(taskLists)

export function renderMarkdown(source: string): string {
  let html = md.render(source ?? '')
  // The task-list plugin renders checked boxes as `disabled`, which makes
  // browsers desaturate the checkbox to gray. Drop the attribute so the
  // theme accent color stays vivid.
  html = html.replace(/\sdisabled(?:="[^"]*")?(?=[\s>])/g, '')
  return DOMPurify.sanitize(html)
}
