import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runOfflineCase, type PoseBenchmarkCaseV1 } from './pose-offline-core'

type ManifestV1 = {
  schemaVersion: 1
  name?: string
  tolerance?: { numberAbs?: number }
  ignorePaths?: string[]
  cases: Array<{
    id: string
    caseFile: string
    snapshotFile: string
  }>
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]!
    if (!raw.startsWith('--')) continue
    const key = raw.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i++
  }
  return out
}

function fail(msg: string): never {
  process.stderr.write(msg.trim() + '\n')
  process.exit(1)
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(text) as T
}

async function writeJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value))
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = sortDeep(obj[k])
  return out
}

function deletePath(obj: unknown, dottedPath: string) {
  const parts = dottedPath.split('.').filter(Boolean)
  if (!parts.length) return
  let cur: unknown = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object') return
    const rec = cur as Record<string, unknown>
    cur = rec[parts[i]!] as unknown
  }
  if (!cur || typeof cur !== 'object') return
  delete (cur as Record<string, unknown>)[parts[parts.length - 1]!] 
}

function normalizeReportForSnapshot(report: unknown, ignorePaths: string[]) {
  const clone = structuredClone(report)
  for (const p of ignorePaths) deletePath(clone, p)
  return clone
}

type Diff = { path: string; expected: unknown; actual: unknown }

function diffWithTolerance(expected: unknown, actual: unknown, tol: number, basePath: string, max: number, diffs: Diff[]) {
  if (diffs.length >= max) return
  if (typeof expected === 'number' && typeof actual === 'number') {
    const e = expected
    const a = actual
    if (Number.isFinite(e) && Number.isFinite(a)) {
      if (Math.abs(e - a) > tol) diffs.push({ path: basePath, expected: e, actual: a })
      return
    }
  }

  if (expected === actual) return

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const len = Math.max(expected.length, actual.length)
    for (let i = 0; i < len; i++) {
      diffWithTolerance(expected[i], actual[i], tol, `${basePath}[${i}]`, max, diffs)
      if (diffs.length >= max) return
    }
    return
  }

  const eObj = expected && typeof expected === 'object' && !Array.isArray(expected) ? (expected as Record<string, unknown>) : null
  const aObj = actual && typeof actual === 'object' && !Array.isArray(actual) ? (actual as Record<string, unknown>) : null
  if (eObj && aObj) {
    const keys = new Set([...Object.keys(eObj), ...Object.keys(aObj)])
    for (const k of Array.from(keys).sort()) {
      diffWithTolerance(eObj[k], aObj[k], tol, basePath ? `${basePath}.${k}` : k, max, diffs)
      if (diffs.length >= max) return
    }
    return
  }

  diffs.push({ path: basePath, expected, actual })
}

function validateManifest(raw: unknown): ManifestV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Invalid manifest JSON: expected object')
  const obj = raw as Record<string, unknown>
  if (obj.schemaVersion !== 1) fail('Invalid manifest JSON: schemaVersion must be 1')
  if (!Array.isArray(obj.cases)) fail('Invalid manifest JSON: cases must be array')
  return obj as ManifestV1
}

function validateCase(raw: unknown): PoseBenchmarkCaseV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Invalid case JSON: expected object')
  const obj = raw as Record<string, unknown>
  if (obj.schemaVersion !== 1) fail('Invalid case JSON: schemaVersion must be 1')
  if (typeof obj.id !== 'string' || !obj.id.trim()) fail('Invalid case JSON: id required')
  if (!obj.exercise || typeof obj.exercise !== 'object' || Array.isArray(obj.exercise)) fail('Invalid case JSON: exercise required')
  if (!Array.isArray(obj.frames)) fail('Invalid case JSON: frames must be array')
  return obj as PoseBenchmarkCaseV1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifestArg = typeof args.manifest === 'string' ? args.manifest : null
  if (!manifestArg) {
    fail('Usage: npm run pose:snapshot -- --manifest <manifest.json> [--update]')
  }
  const update = args.update === true
  const absManifestPath = path.resolve(process.cwd(), manifestArg)
  const manifestDir = path.dirname(absManifestPath)
  const rawManifest = await readJsonFile<unknown>(absManifestPath)
  const manifest = validateManifest(rawManifest)

  const tol = Math.max(0, Number(manifest.tolerance?.numberAbs ?? 0))
  const ignorePaths = manifest.ignorePaths?.length
    ? manifest.ignorePaths
    : ['generatedAt', 'sections.overview.generatedAt']

  const failures: Array<{ id: string; diffs: Diff[] }> = []
  let passed = 0

  for (const item of manifest.cases) {
    const casePath = path.resolve(manifestDir, item.caseFile)
    const snapshotPath = path.resolve(manifestDir, item.snapshotFile)
    const rawCase = await readJsonFile<unknown>(casePath)
    const benchCase = validateCase(rawCase)
    const report = runOfflineCase(benchCase)
    const normalized = normalizeReportForSnapshot(report, ignorePaths)

    if (update) {
      await writeJsonFile(snapshotPath, normalized)
      passed += 1
      continue
    }

    let expected: unknown | null = null
    try {
      expected = await readJsonFile<unknown>(snapshotPath)
    } catch {
      failures.push({
        id: item.id,
        diffs: [{ path: '', expected: `snapshot missing: ${path.relative(process.cwd(), snapshotPath)}`, actual: null }]
      })
      continue
    }

    const diffs: Diff[] = []
    diffWithTolerance(expected, normalized, tol, '', 12, diffs)
    if (diffs.length === 0) {
      passed += 1
      continue
    }
    failures.push({ id: item.id, diffs })
  }

  if (update) {
    process.stdout.write(`Updated ${passed} snapshot(s).\n`)
    return
  }

  if (failures.length === 0) {
    process.stdout.write(`All ${passed} case(s) matched snapshots.\n`)
    return
  }

  process.stderr.write(`Snapshot regression failed: ${failures.length} case(s) mismatched.\n`)
  for (const f of failures) {
    process.stderr.write(`- ${f.id}\n`)
    for (const d of f.diffs) {
      process.stderr.write(`  - ${d.path || '(root)'}\n`)
      process.stderr.write(`    expected: ${stableStringify(d.expected)}\n`)
      process.stderr.write(`    actual:   ${stableStringify(d.actual)}\n`)
    }
  }
  process.exit(1)
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err)
  fail(msg)
})
