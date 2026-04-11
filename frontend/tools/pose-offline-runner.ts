import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runOfflineCase, type PoseBenchmarkCaseV1 } from './pose-offline-core'

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

async function readJsonFile<T>(filePath: string): Promise<T> {
  const text = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(text) as T
}

async function writeJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function fail(msg: string): never {
  process.stderr.write(msg.trim() + '\n')
  process.exit(1)
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function validateCase(raw: unknown): PoseBenchmarkCaseV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Invalid case JSON: expected object')
  const obj = raw as Record<string, unknown>
  if (obj.schemaVersion !== 1) fail('Invalid case JSON: schemaVersion must be 1')
  const id = asString(obj.id)
  if (!id) fail('Invalid case JSON: id required')
  const exercise = obj.exercise
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) fail('Invalid case JSON: exercise required')
  const ex = exercise as Record<string, unknown>
  const slug = asString(ex.slug)
  if (!slug) fail('Invalid case JSON: exercise.slug required')
  const viewAngle = asString(obj.viewAngle)
  if (!viewAngle || !['unknown', 'front', 'side', 'back'].includes(viewAngle)) fail('Invalid case JSON: viewAngle invalid')
  const fps = obj.fps
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) fail('Invalid case JSON: fps invalid')
  if (!Array.isArray(obj.frames)) fail('Invalid case JSON: frames must be array')
  return obj as PoseBenchmarkCaseV1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const casePath = asString(args.case)
  if (!casePath) {
    fail('Usage: npm run pose:replay -- --case <case.json> [--out <report.json>]')
  }
  const outPath = asString(args.out)
  const absCasePath = path.resolve(process.cwd(), casePath)
  const raw = await readJsonFile<unknown>(absCasePath)
  const benchCase = validateCase(raw)
  const report = runOfflineCase(benchCase)

  if (outPath) {
    const absOutPath = path.resolve(process.cwd(), outPath)
    await writeJsonFile(absOutPath, report)
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err)
  fail(msg)
})
