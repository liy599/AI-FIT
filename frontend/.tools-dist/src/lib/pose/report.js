export function buildGenericMotionReport(input) {
    const keyMetrics = {
        fps: input.fps,
        repEstimate: input.analysis.repEstimate,
        coverage: input.analysis.coverage,
        stabilityScore: input.analysis.stabilityScore,
        mobilityScore: input.analysis.mobilityScore,
        rhythmScore: input.analysis.rhythmScore,
        symmetryScore: input.analysis.symmetryScore
    };
    const issues = input.analysis.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        atFrame: issue.atFrame
    }));
    const timelineSampled = sampleGenericTimeline(input.analysis.timeline, input.fps, 5);
    const errorStats = computeErrorStats(issues);
    const generatedAt = new Date().toISOString();
    return {
        version: 3,
        generatedAt,
        status: 'ok',
        task: { id: input.taskId, viewAngle: input.viewAngle, instruction: input.instruction },
        exercise: input.exercise,
        video: input.video,
        summary: input.analysis.summary,
        keyMetrics,
        issues,
        suggestions: input.analysis.suggestions,
        details: {
            type: 'generic_motion',
            timelineSampled
        },
        sections: {
            overview: {
                generatedAt,
                status: 'ok',
                taskId: input.taskId,
                viewAngle: input.viewAngle,
                exerciseName: input.exercise?.name ?? null,
                summary: input.analysis.summary
            },
            metrics: keyMetrics,
            errorStats,
            suggestions: input.analysis.suggestions,
            timelineSampled
        }
    };
}
function computeErrorStats(issues) {
    const bySeverity = { info: 0, warning: 0, error: 0 };
    const map = new Map();
    function severityRank(s) {
        if (s === 'error')
            return 3;
        if (s === 'warning')
            return 2;
        return 1;
    }
    for (const issue of issues) {
        bySeverity[issue.severity] += 1;
        const prev = map.get(issue.code);
        if (!prev) {
            map.set(issue.code, { count: 1, maxSeverity: issue.severity });
            continue;
        }
        prev.count += 1;
        if (severityRank(issue.severity) > severityRank(prev.maxSeverity))
            prev.maxSeverity = issue.severity;
    }
    const byCode = Array.from(map.entries())
        .map(([code, value]) => ({ code, count: value.count, maxSeverity: value.maxSeverity }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    return { total: issues.length, bySeverity, byCode };
}
function sampleGenericTimeline(timeline, fps, sampleFps) {
    const step = Math.max(1, Math.round(fps / Math.max(1, sampleFps)));
    const out = [];
    for (let i = 0; i < timeline.length; i += step)
        out.push(timeline[i]);
    return out;
}
