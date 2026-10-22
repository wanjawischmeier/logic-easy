import { cpSync, existsSync, readdirSync } from 'fs'
import { basename, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(projectRoot, 'public')
const distDir = join(projectRoot, 'dist')

const builds = {
  'fsm-engine': ['fsm-engine/dist', 'fsm-engine/dist'],
  docs: ['docs/.vitepress/dist', 'docs'],
}

// copy relevant src files
const copy = (src, dest) => {
  if (!existsSync(join(publicDir, src))) {
    console.error('ERROR: build output not found at', join(publicDir, src))
    process.exit(1)
  }
  cpSync(join(publicDir, src), join(distDir, dest), {
    recursive: true,
    filter: (path) => !basename(path).startsWith('.'),
  })
}

for (const entry of readdirSync(publicDir)) {
  if (entry.startsWith('.')) continue
  if (builds[entry]) copy(...builds[entry])
  else copy(entry, entry)
}

console.log('Public assets copied to dist')
