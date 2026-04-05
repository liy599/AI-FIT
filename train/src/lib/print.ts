export function openPdfPrint(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  const safeTitle = escapeHtml(title)
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Segoe UI, Arial, Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft Yahei', sans-serif; color: #111827; background: #ffffff; }
      .page { padding: 28px; max-width: 900px; margin: 0 auto; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      .muted { color: #6b7280; font-size: 12px; }
      .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-top: 12px; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
      .kv { flex: 1 1 180px; border: 1px solid #f3f4f6; border-radius: 12px; padding: 10px; background: #fafafa; }
      .kvK { font-size: 12px; color: #6b7280; }
      .kvV { font-size: 16px; font-weight: 700; margin-top: 2px; }
      ul, ol { margin: 8px 0 0; padding-left: 18px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0b1220; color: #e5e7eb; border-radius: 12px; padding: 12px; }
      @media print {
        .page { padding: 0; }
        .card { break-inside: avoid; }
        pre { color: #111827; background: #ffffff; border: 1px solid #e5e7eb; }
      }
    </style>
  </head>
  <body>
    <div class="page">${bodyHtml}</div>
    <script>
      setTimeout(function () { window.focus(); window.print(); }, 60);
    </script>
  </body>
</html>`
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

