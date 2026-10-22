import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'docs')
const base = `${process.env.BASE_URL ?? '/'}docs/`

// build docs via vitepress, but with correct base-url
execFileSync(
  process.execPath,
  [join(docsDir, 'node_modules/vitepress/bin/vitepress.js'), 'build', '--base', base],
  {
    cwd: docsDir,
    stdio: 'inherit',
  },
)
