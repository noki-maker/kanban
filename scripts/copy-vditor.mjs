import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/vditor/dist')
const dest = resolve(root, 'public/vditor/dist')

if (!existsSync(src)) {
  console.error(`[copy-vditor] vditor dist not found at ${src}. Run "pnpm install" first.`)
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
cpSync(src, dest, { recursive: true, force: true })
console.log(`[copy-vditor] copied ${src} -> ${dest}`)
