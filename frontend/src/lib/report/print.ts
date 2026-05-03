export function openPdfPrint(title: string, bodyHtml: string) {
  const safeTitle = escapeHtml(title)
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; background: #ffffff; }
      .page { padding: 28px; max-width: 900px; margin: 0 auto; }
      h1 { margin: 0 0 8px; font-size: 22px; }
      .muted { color: #6b7280; font-size: 12px; }
      .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-top: 12px; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      .kv { flex: 1 1 180px; border: 1px solid #f3f4f6; border-radius: 12px; padding: 10px; background: #fafafa; }
      .kvK { font-size: 12px; color: #6b7280; }
      .kvV { font-size: 15px; font-weight: 700; margin-top: 3px; word-break: break-word; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0b1220; color: #e5e7eb; border-radius: 12px; padding: 12px; }
    </style>
  </head>
  <body>
    <div class="page">${bodyHtml}</div>
  </body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    URL.revokeObjectURL(url)
    return
  }

  const cleanup = () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const printWhenReady = () => {
    try {
      w.focus()
      setTimeout(() => {
        try {
          w.print()
        } finally {
          cleanup()
        }
      }, 250)
    } catch {
      cleanup()
    }
  }

  try {
    w.addEventListener('load', printWhenReady, { once: true })
  } catch {
    setTimeout(printWhenReady, 300)
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

