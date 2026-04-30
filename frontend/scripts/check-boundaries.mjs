import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCOPES = ['src/pages', 'src/components']
const BLOCKED = [/from\s+['"]\.\.\/lib\//g, /from\s+['"]\.\.\/\.\.\/lib\//g, /from\s+['"]@\/lib\//g]
const EXTS = new Set(['.ts', '.tsx'])

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (EXTS.has(path.extname(entry.name))) files.push(full)
  }
  return files
}

const violations = []
for (const scope of SCOPES) {
  const abs = path.join(ROOT, scope)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    const raw = fs.readFileSync(file, 'utf8')
    const lines = raw.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (BLOCKED.some((rule) => rule.test(line))) {
        violations.push(`${path.relative(ROOT, file)}:${i + 1} ${line.trim()}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Boundary violations found (pages/components must not import lib directly):')
  for (const item of violations) console.error(`- ${item}`)
  process.exit(1)
}

console.log('Boundary check passed.')

