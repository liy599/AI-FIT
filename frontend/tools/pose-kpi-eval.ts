import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { runOfflineCase, type PoseBenchmarkCaseV1 } from './pose-offline-core'

type ManifestV1 = {
  schemaVersion: 1
  name?: string
  cases: Array<{
    id: string
    caseFile: string
  }>
}

type CaseLabelsV1 = {
  reps?: number
  totalReps?: number
  issues?: Partial<Record<'DEPTH' | 'KNEE_VALGUS' | 'HEEL_LIFT' | 'TORSO_LEAN' | 'TEMPO_DRIFT', boolean>>
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
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

function readLabels(caseJson: unknown): CaseLabelsV1 | null {
  const rec = asRecord(caseJson)
  if (!rec) return null
  const labels = asRecord(rec.labels)
  if (!labels) return null
  return labels as CaseLabelsV1
}

function getNumberFromReport(report: unknown, dottedPath: string): number | null {
  const parts = dottedPath.split('.').filter(Boolean)
  let cur: unknown = report
  for (const p of parts) {
    const rec = asRecord(cur)
    if (!rec) return null
    cur = rec[p]
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : null
}

function getPredictedReps(report: unknown): number | null {
  const reps = getNumberFromReport(report, 'keyMetrics.totalReps')
  if (reps !== null) return Math.round(reps)
  const detailsRep = getNumberFromReport(report, 'details.repCount')
  if (detailsRep !== null) return Math.round(detailsRep)
  return null
}

function getPredictedUnassessedReps(report: unknown): number | null {
  const n = getNumberFromReport(report, 'keyMetrics.unassessedReps')
  if (n !== null) return Math.round(n)
  return null
}

function extractCoreCorrectionLevels(report: unknown) {
  const details = asRecord(asRecord(report)?.details)
  const core = details && Array.isArray(details.coreCorrections) ? details.coreCorrections : null
  const out = new Map<string, string>()
  if (!core) return out
  for (const item of core) {
    const rec = asRecord(item)
    const type = typeof rec?.type === 'string' ? rec.type : null
    const level = typeof rec?.level === 'string' ? rec.level : null
    if (type && level) out.set(type, level)
  }
  return out
}

function predictedIssuePresence(report: unknown) {
  const levels = extractCoreCorrectionLevels(report)
  const types: Array<'DEPTH' | 'KNEE_VALGUS' | 'HEEL_LIFT' | 'TORSO_LEAN' | 'TEMPO_DRIFT'> = [
    'DEPTH',
    'KNEE_VALGUS',
    'HEEL_LIFT',
    'TORSO_LEAN',
    'TEMPO_DRIFT'
  ]
  const out: Record<string, boolean> = {}
  for (const t of types) {
    const level = levels.get(t) ?? null
    out[t] = Boolean(level && level !== 'ok' && level !== 'unknown')
  }
  return out
}

type Confusion = { tp: number; fp: number; tn: number; fn: number }

function addConfusion(cur: Confusion, pred: boolean, gt: boolean) {
  if (pred && gt) cur.tp += 1
  else if (pred && !gt) cur.fp += 1
  else if (!pred && gt) cur.fn += 1
  else cur.tn += 1
}

function precision(c: Confusion) {
  const d = c.tp + c.fp
  return d > 0 ? c.tp / d : null
}

function recall(c: Confusion) {
  const d = c.tp + c.fn
  return d > 0 ? c.tp / d : null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const manifestArg = typeof args.manifest === 'string' ? args.manifest : null
  if (!manifestArg) fail('Usage: npm run pose:kpi -- --manifest <manifest.json> [--out <report.json>]')
  const outArg = typeof args.out === 'string' ? args.out : null

  const absManifestPath = path.resolve(process.cwd(), manifestArg)
  const manifestDir = path.dirname(absManifestPath)
  const rawManifest = await readJsonFile<unknown>(absManifestPath)
  const manifest = validateManifest(rawManifest)

  const repErrors: number[] = []
  const correctionTypes: Array<'DEPTH' | 'KNEE_VALGUS' | 'HEEL_LIFT' | 'TORSO_LEAN' | 'TEMPO_DRIFT'> = [
    'DEPTH',
    'KNEE_VALGUS',
    'HEEL_LIFT',
    'TORSO_LEAN',
    'TEMPO_DRIFT'
  ]
  const confusions: Record<string, Confusion> = Object.fromEntries(correctionTypes.map((t) => [t, { tp: 0, fp: 0, tn: 0, fn: 0 }]))
  const unassessedRates: number[] = []
  const skipped: Array<{ id: string; reason: string }> = []
  const unstable: Array<{ id: string; reason: string }> = []

  for (const item of manifest.cases) {
    const casePath = path.resolve(manifestDir, item.caseFile)
    const rawCase = await readJsonFile<unknown>(casePath)
    const benchCase = validateCase(rawCase)
    const labels = readLabels(rawCase)
    if (!labels) {
      skipped.push({ id: item.id, reason: 'missing_labels' })
      continue
    }

    const reportA = runOfflineCase(benchCase)
    const reportB = runOfflineCase(benchCase)

    const repsA = getPredictedReps(reportA)
    const repsB = getPredictedReps(reportB)
    if (repsA !== repsB) unstable.push({ id: item.id, reason: `rep_count_unstable:${repsA ?? 'null'}!=${repsB ?? 'null'}` })

    const predIssuesA = predictedIssuePresence(reportA)
    const predIssuesB = predictedIssuePresence(reportB)
    for (const t of correctionTypes) {
      if (predIssuesA[t] !== predIssuesB[t]) unstable.push({ id: item.id, reason: `issue_unstable:${t}` })
    }

    const gtReps = typeof labels.reps === 'number' ? labels.reps : typeof labels.totalReps === 'number' ? labels.totalReps : null
    if (gtReps !== null && repsA !== null) repErrors.push(Math.abs(repsA - gtReps))

    const gtIssues = labels.issues ?? {}
    for (const t of correctionTypes) {
      const gt = typeof gtIssues[t] === 'boolean' ? Boolean(gtIssues[t]) : null
      if (gt === null) continue
      addConfusion(confusions[t]!, Boolean(predIssuesA[t]), gt)
    }

    const unassessed = getPredictedUnassessedReps(reportA)
    if (unassessed !== null && repsA !== null && repsA > 0) {
      unassessedRates.push(Math.max(0, Math.min(1, unassessed / repsA)))
    }
  }

  const repMae = repErrors.length > 0 ? repErrors.reduce((a, b) => a + b, 0) / repErrors.length : null
  const metricsByIssue = Object.fromEntries(
    correctionTypes.map((t) => {
      const c = confusions[t]!
      return [
        t,
        {
          precision: precision(c),
          recall: recall(c),
          counts: c
        }
      ]
    })
  )
  const avgUnassessedRate = unassessedRates.length > 0 ? unassessedRates.reduce((a, b) => a + b, 0) / unassessedRates.length : null

  const result = {
    manifest: { name: manifest.name ?? null, cases: manifest.cases.length },
    evaluatedCases: manifest.cases.length - skipped.length,
    repMae,
    avgUnassessedRate,
    perIssue: metricsByIssue,
    skipped,
    unstable
  }

  const header = `Pose KPI eval: ${result.evaluatedCases}/${manifest.cases.length} case(s) with labels`
  process.stdout.write(header + '\n')
  if (repMae !== null) process.stdout.write(`- rep MAE: ${Math.round(repMae * 1000) / 1000}\n`)
  if (avgUnassessedRate !== null) process.stdout.write(`- avg unassessed rate: ${Math.round(avgUnassessedRate * 1000) / 10}%\n`)
  for (const t of correctionTypes) {
    const item = result.perIssue[t] as { precision: number | null; recall: number | null }
    const p = item.precision !== null ? `${Math.round(item.precision * 1000) / 10}%` : 'N/A'
    const r = item.recall !== null ? `${Math.round(item.recall * 1000) / 10}%` : 'N/A'
    process.stdout.write(`- ${t}: precision ${p}, recall ${r}\n`)
  }
  if (unstable.length > 0) process.stdout.write(`- warnings: ${unstable.length} unstable output(s)\n`)

  if (outArg) {
    const absOut = path.resolve(process.cwd(), outArg)
    await writeJsonFile(absOut, result)
    process.stdout.write(`Wrote ${path.relative(process.cwd(), absOut)}\n`)
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err)
  fail(msg)
})

