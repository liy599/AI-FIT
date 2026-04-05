import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function getUploadsRootDir() {
  const configured = process.env.UPLOADS_DIR?.trim()
  if (!configured) return path.join(process.cwd(), 'uploads')
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
}

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true })
}

export function safeExtFromFilename(filename: string) {
  const ext = path.extname(filename || '').toLowerCase()
  if (!ext || ext.length > 10) return ''
  if (!/^\.[a-z0-9]+$/.test(ext)) return ''
  return ext
}

export async function writeWebFileToDisk(file: File, targetPath: string) {
  const buf = Buffer.from(await file.arrayBuffer())
  await ensureDir(path.dirname(targetPath))
  await writeFile(targetPath, buf)
}
