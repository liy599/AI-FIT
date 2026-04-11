export function sampleItems(items, max) {
    if (items.length <= max)
        return items;
    if (max <= 0)
        return [];
    const step = Math.max(1, Math.ceil(items.length / max));
    const out = [];
    for (let i = 0; i < items.length; i += step)
        out.push(items[i]);
    return out.slice(0, max);
}
export function computeReportErrorStats(issues) {
    const bySeverity = { info: 0, warning: 0, error: 0 };
    const byCode = new Map();
    function rank(value) {
        if (value === 'error')
            return 3;
        if (value === 'warning')
            return 2;
        return 1;
    }
    for (const issue of issues) {
        bySeverity[issue.severity] += 1;
        const prev = byCode.get(issue.code);
        if (!prev) {
            byCode.set(issue.code, { count: 1, maxSeverity: issue.severity });
            continue;
        }
        prev.count += 1;
        if (rank(issue.severity) > rank(prev.maxSeverity))
            prev.maxSeverity = issue.severity;
    }
    return {
        total: issues.length,
        bySeverity,
        byCode: Array.from(byCode.entries())
            .map(([code, value]) => ({ code, count: value.count, maxSeverity: value.maxSeverity }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12)
    };
}
