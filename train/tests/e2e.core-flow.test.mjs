import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { after, before, test } from 'node:test'

const PROJECT_ROOT = process.cwd()

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') return reject(new Error('Failed to pick port'))
        resolve(address.port)
      })
    })
  })
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

function runCommandWithInput(command, args, input, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['pipe', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
    child.stdin.end(input)
  })
}

async function waitForHealthy(baseUrl, timeoutMs = 90_000) {
  const startedAt = Date.now()
  let lastError = null
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`, { cache: 'no-store' })
      if (res.ok) return
      lastError = new Error(`Health returned ${res.status}`)
    } catch (e) {
      lastError = e
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for server')
}

async function waitForJobSucceeded(jobId, sessionCookie, timeoutMs = 90_000) {
  const startedAt = Date.now()
  let lastData = null
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${baseUrl}/api/v1/private/analysis/jobs/${jobId}`, {
      method: 'GET',
      headers: { cookie: sessionCookie },
      cache: 'no-store'
    })
    if (res.ok) {
      const data = await json(res)
      lastData = data
      const status = data?.job?.status
      if (status === 'succeeded') return data
      if (status === 'failed') throw new Error(data?.job?.errorMessage || 'Job failed')
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Timed out waiting for job ${jobId} to succeed: ${JSON.stringify(lastData)}`)
}

async function waitForVideosEmpty(sessionCookie, timeoutMs = 30_000) {
  const startedAt = Date.now()
  let last = null
  while (Date.now() - startedAt < timeoutMs) {
    const res = await fetch(`${baseUrl}/api/v1/private/videos?limit=10`, {
      method: 'GET',
      headers: { cookie: sessionCookie },
      cache: 'no-store'
    })
    if (res.ok) {
      const data = await json(res)
      last = data
      if (Array.isArray(data?.items) && data.items.length === 0) return
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timed out waiting for videos empty: ${JSON.stringify(last)}`)
}

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  const m = /(?:^|,)\s*session_token=([^;]+)/.exec(setCookieHeader)
  if (!m) return null
  return `session_token=${m[1]}`
}

async function json(res) {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function registerUser(origin, email, password) {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'X-Forwarded-For': '127.0.0.1' },
    body: JSON.stringify({ email, password, name: 'e2e' })
  })
  assert.equal(res.status, 200)
  const cookie = extractSessionCookie(res.headers.get('set-cookie'))
  assert.ok(cookie)
  return cookie
}

let baseUrl = null
let nextProcess = null
let tmpDir = null

before(async () => {
  const port = await pickFreePort()
  baseUrl = `http://localhost:${port}`

  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  tmpDir = path.join(PROJECT_ROOT, '.tmp', `e2e-${runId}`)
  await mkdir(tmpDir, { recursive: true })

  const dbPath = path.join(tmpDir, 'e2e.db')
  const schemaSqlPath = path.join(PROJECT_ROOT, 'prisma', 'migrations', '20260326150000_init_full', 'migration.sql')
  const uploadsDir = path.join(tmpDir, 'uploads')

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    CLIENT_POSE_ENABLED: '0',
    DATABASE_URL: `file:${dbPath}`,
    UPLOADS_DIR: uploadsDir,
    PORT: String(port)
  }

  const schemaSql = await readFile(schemaSqlPath, 'utf8')
  await runCommandWithInput('sqlite3', [dbPath], schemaSql, { cwd: PROJECT_ROOT, env })

  nextProcess = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit'
  })

  await waitForHealthy(baseUrl)
})

after(async () => {
  if (nextProcess) {
    nextProcess.kill('SIGTERM')
    nextProcess = null
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

test('核心流程：注册 -> 训练 -> 分析 -> 删除', async () => {
  const origin = baseUrl

  const email = `e2e_${Date.now()}@example.com`
  const password = 'Password_1234'

  const sessionCookie = await registerUser(origin, email, password)

  const unauthorizedTrainings = await fetch(`${baseUrl}/api/v1/private/trainings`, { cache: 'no-store' })
  assert.equal(unauthorizedTrainings.status, 401)

  const exercisesRes = await fetch(`${baseUrl}/api/v1/private/exercises`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(exercisesRes.status, 200)
  const exercisesBody = await json(exercisesRes)
  const squat = exercisesBody?.items?.find?.((x) => x?.name === 'Squat' || x?.name === '深蹲')
  assert.ok(squat?.id)

  const createTrainingRes = await fetch(`${baseUrl}/api/v1/private/trainings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, cookie: sessionCookie },
    body: JSON.stringify({ note: 'e2e training' })
  })
  assert.equal(createTrainingRes.status, 200)
  const created = await json(createTrainingRes)
  const trainingId = created?.session?.id
  assert.ok(trainingId)

  const updateTrainingRes = await fetch(`${baseUrl}/api/v1/private/trainings/${trainingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: origin, cookie: sessionCookie },
    body: JSON.stringify({
      note: 'e2e training updated',
      sets: [{ exerciseId: squat.id, reps: 10, weight: 60 }]
    })
  })
  assert.equal(updateTrainingRes.status, 200)

  const completeTrainingRes = await fetch(`${baseUrl}/api/v1/private/trainings/${trainingId}/complete`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie }
  })
  assert.equal(completeTrainingRes.status, 200)

  const trainingsListRes = await fetch(`${baseUrl}/api/v1/private/trainings?days=30`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(trainingsListRes.status, 200)
  const trainingsList = await json(trainingsListRes)
  assert.ok(Array.isArray(trainingsList?.items))
  assert.ok(trainingsList.items.some((x) => x?.id === trainingId))

  const invalidUploadForm = new FormData()
  invalidUploadForm.set('file', new File([new Uint8Array([1, 2, 3])], 'bad.txt', { type: 'text/plain' }))
  const invalidUploadRes = await fetch(`${baseUrl}/api/v1/private/videos`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie },
    body: invalidUploadForm
  })
  assert.equal(invalidUploadRes.status, 400)

  const uploadForm = new FormData()
  uploadForm.set('file', new File([new Uint8Array([0, 0, 0, 1])], 'squat.mp4', { type: 'video/mp4' }))
  const uploadRes = await fetch(`${baseUrl}/api/v1/private/videos`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie },
    body: uploadForm
  })
  assert.equal(uploadRes.status, 200)
  const uploadBody = await json(uploadRes)
  const videoId = uploadBody?.video?.id
  assert.ok(videoId)

  const createJobForm = new FormData()
  createJobForm.set('exerciseId', squat.id)
  createJobForm.set('viewAngle', 'side')
  createJobForm.set('instruction', 'e2e')
  createJobForm.set('videoAssetId', videoId)
  const createJobRes = await fetch(`${baseUrl}/api/v1/private/analysis/jobs`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie },
    body: createJobForm
  })
  assert.equal(createJobRes.status, 200)
  const createJobBody = await json(createJobRes)
  const jobId = createJobBody?.job?.id
  assert.ok(jobId)
  assert.equal(createJobBody?.job?.status, 'queued')

  const jobsListRes = await fetch(`${baseUrl}/api/v1/private/analysis/jobs?limit=10`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(jobsListRes.status, 200)
  const jobsList = await json(jobsListRes)
  assert.ok(Array.isArray(jobsList?.items))
  assert.ok(jobsList.items.some((x) => x?.id === jobId))

  const jobDetail = await waitForJobSucceeded(jobId, sessionCookie)
  assert.equal(jobDetail?.job?.status, 'succeeded')
  assert.ok(jobDetail?.result?.report)

  const report = jobDetail.result.report
  assert.ok(Array.isArray(report?.suggestions))
  assert.ok(report.suggestions.length > 0)

  await waitForVideosEmpty(sessionCookie)

  const exportJsonRes = await fetch(`${baseUrl}/api/v1/private/privacy/export?format=json`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(exportJsonRes.status, 200)
  const exportJson = await json(exportJsonRes)
  assert.ok(typeof exportJson?.exportedAt === 'string')
  assert.ok(Array.isArray(exportJson?.trainings))
  assert.ok(Array.isArray(exportJson?.analysis))
  assert.ok(exportJson.trainings.some((x) => x?.id === trainingId))
  assert.ok(exportJson.analysis.some((x) => x?.id === jobId))

  const exportCsvRes = await fetch(`${baseUrl}/api/v1/private/privacy/export?format=csv`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(exportCsvRes.status, 200)
  const csvText = await exportCsvRes.text()
  assert.ok(/analysis_task/.test(csvText))

  const deleteJobRes = await fetch(`${baseUrl}/api/v1/private/analysis/jobs/${jobId}`, {
    method: 'DELETE',
    headers: { Origin: origin, cookie: sessionCookie }
  })
  assert.equal(deleteJobRes.status, 200)

  const deleteTrainingRes = await fetch(`${baseUrl}/api/v1/private/trainings/${trainingId}`, {
    method: 'DELETE',
    headers: { Origin: origin, cookie: sessionCookie }
  })
  assert.equal(deleteTrainingRes.status, 200)

  const createTraining2Res = await fetch(`${baseUrl}/api/v1/private/trainings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, cookie: sessionCookie },
    body: JSON.stringify({ note: 'e2e training bulk delete' })
  })
  assert.equal(createTraining2Res.status, 200)
  const created2 = await json(createTraining2Res)
  const trainingId2 = created2?.session?.id
  assert.ok(trainingId2)

  const uploadForm2 = new FormData()
  uploadForm2.set('file', new File([new Uint8Array([0, 0, 0, 1])], 'squat2.mp4', { type: 'video/mp4' }))
  const uploadRes2 = await fetch(`${baseUrl}/api/v1/private/videos`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie },
    body: uploadForm2
  })
  assert.equal(uploadRes2.status, 200)
  const uploadBody2 = await json(uploadRes2)
  const videoId2 = uploadBody2?.video?.id
  assert.ok(videoId2)

  const createJobForm2 = new FormData()
  createJobForm2.set('exerciseId', squat.id)
  createJobForm2.set('viewAngle', 'side')
  createJobForm2.set('instruction', 'e2e bulk delete')
  createJobForm2.set('videoAssetId', videoId2)
  const createJob2Res = await fetch(`${baseUrl}/api/v1/private/analysis/jobs`, {
    method: 'POST',
    headers: { Origin: origin, cookie: sessionCookie },
    body: createJobForm2
  })
  assert.equal(createJob2Res.status, 200)
  const createJob2Body = await json(createJob2Res)
  const jobId2 = createJob2Body?.job?.id
  assert.ok(jobId2)

  await waitForJobSucceeded(jobId2, sessionCookie)

  const bulkDeleteJobsRes = await fetch(`${baseUrl}/api/v1/private/analysis/jobs`, {
    method: 'DELETE',
    headers: { Origin: origin, cookie: sessionCookie }
  })
  assert.equal(bulkDeleteJobsRes.status, 200)
  const bulkDeleteJobsBody = await json(bulkDeleteJobsRes)
  assert.ok(bulkDeleteJobsBody?.ok)
  assert.ok(typeof bulkDeleteJobsBody?.deleted === 'number')
  assert.ok(bulkDeleteJobsBody.deleted >= 1)

  const job2AfterDeleteRes = await fetch(`${baseUrl}/api/v1/private/analysis/jobs/${jobId2}`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(job2AfterDeleteRes.status, 404)

  const bulkDeleteTrainingsRes = await fetch(`${baseUrl}/api/v1/private/trainings`, {
    method: 'DELETE',
    headers: { Origin: origin, cookie: sessionCookie }
  })
  assert.equal(bulkDeleteTrainingsRes.status, 200)
  const bulkDeleteTrainingsBody = await json(bulkDeleteTrainingsRes)
  assert.ok(bulkDeleteTrainingsBody?.ok)
  assert.ok(typeof bulkDeleteTrainingsBody?.deleted === 'number')
  assert.ok(bulkDeleteTrainingsBody.deleted >= 1)

  const training2AfterDeleteRes = await fetch(`${baseUrl}/api/v1/private/trainings/${trainingId2}`, {
    method: 'GET',
    headers: { cookie: sessionCookie },
    cache: 'no-store'
  })
  assert.equal(training2AfterDeleteRes.status, 404)
})

test('安全回归：跨用户访问不可用', async () => {
  const origin = baseUrl
  const password = 'Password_1234'

  const user1Cookie = await registerUser(origin, `e2e_u1_${Date.now()}@example.com`, password)
  const user2Cookie = await registerUser(origin, `e2e_u2_${Date.now()}@example.com`, password)

  const badOriginRes = await fetch(`${baseUrl}/api/v1/private/trainings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: user1Cookie },
    body: JSON.stringify({ note: 'bad origin' })
  })
  assert.equal(badOriginRes.status, 403)

  const createTrainingRes = await fetch(`${baseUrl}/api/v1/private/trainings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, cookie: user2Cookie },
    body: JSON.stringify({ note: 'u2' })
  })
  assert.equal(createTrainingRes.status, 200)
  const created = await json(createTrainingRes)
  const trainingId = created?.session?.id
  assert.ok(trainingId)

  const deleteAsOtherRes = await fetch(`${baseUrl}/api/v1/private/trainings/${trainingId}`, {
    method: 'DELETE',
    headers: { Origin: origin, cookie: user1Cookie }
  })
  assert.equal(deleteAsOtherRes.status, 404)
})
