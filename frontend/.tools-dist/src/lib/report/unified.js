export function normalizeReportForArchive(input) {
    return input;
}
export function renderReportPdfBodyHtml(input, opts) {
    const nowText = opts?.nowText ?? new Date().toLocaleString('zh-CN');
    const title = opts?.title ?? 'Pose Report';
    const escapeHtml = (s) => s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const rows = Object.entries(input)
        .map(([k, v]) => {
        const text = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-');
        return `<div class="kv"><div class="kvK">${escapeHtml(k)}</div><div class="kvV">${escapeHtml(text)}</div></div>`;
    })
        .join('');
    return `
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">Generated: ${escapeHtml(nowText)}</div>
    <div class="card">
      <div class="row">${rows}</div>
    </div>
    <div class="card">
      <pre>${escapeHtml(JSON.stringify(input, null, 2))}</pre>
    </div>
  `;
}
