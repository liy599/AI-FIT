import { PoseMetricTracker } from './poseMetricTracker';
export function analyzeGenericMotion(frames) {
    const tracker = new PoseMetricTracker({ stabilityWindowMs: 900 });
    const timeline = frames.map((frame, index) => {
        if (!frame.landmarks) {
            return { frame: index, tMs: frame.tMs, centerY: null, shoulderTiltDeg: null, kneeFlexDeg: null };
        }
        const ls = frame.landmarks[11];
        const rs = frame.landmarks[12];
        const poseFrame = tracker.update(frame.landmarks, frame.tMs);
        const shoulderTiltDeg = ls && rs ? Math.abs((Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180) / Math.PI) : null;
        return {
            frame: index,
            tMs: frame.tMs,
            centerY: poseFrame.metrics.centerY,
            shoulderTiltDeg,
            kneeFlexDeg: poseFrame.metrics.kneeAvgDeg
        };
    });
    const validFrames = timeline.filter((x) => x.centerY !== null).length;
    const coverage = frames.length > 0 ? validFrames / frames.length : 0;
    const centerSeries = timeline.map((x) => x.centerY).filter((x) => x !== null);
    const shoulderSeries = timeline.map((x) => x.shoulderTiltDeg).filter((x) => x !== null);
    const kneeSeries = timeline.map((x) => x.kneeFlexDeg).filter((x) => x !== null);
    const centerStd = std(centerSeries);
    const shoulderStd = std(shoulderSeries);
    const kneeRange = range(kneeSeries);
    const repEstimate = estimateReps(centerSeries);
    const rhythmScore = scoreRhythm(centerSeries);
    const stabilityScore = clamp01(1 - centerStd * 6 - shoulderStd / 150);
    const mobilityScore = clamp01(kneeRange / 70);
    const symmetryScore = clamp01(1 - Math.min(1, shoulderStd / 45));
    const issues = [];
    const suggestions = new Set();
    if (coverage < 0.6) {
        issues.push({ code: 'LOW_VISIBILITY', severity: 'warning', message: 'Pose coverage is low. Improve framing and lighting.', atFrame: null });
        suggestions.add('Place the camera near chest height and keep the full body inside the frame.');
    }
    if (stabilityScore < 0.45) {
        issues.push({ code: 'LOW_STABILITY', severity: 'warning', message: 'Body trajectory is unstable during the motion.', atFrame: null });
        suggestions.add('Slow down slightly and stabilize the path before adding speed.');
    }
    if (mobilityScore < 0.35) {
        issues.push({ code: 'LOW_RANGE_OF_MOTION', severity: 'warning', message: 'Range of motion looks limited.', atFrame: null });
        suggestions.add('Increase depth gradually within a safe, controlled range.');
    }
    if (rhythmScore < 0.35) {
        issues.push({ code: 'RHYTHM_UNEVEN', severity: 'info', message: 'Rep rhythm is inconsistent.', atFrame: null });
        suggestions.add('Use a fixed cadence such as 2-1-2 to keep the movement consistent.');
    }
    const summary = repEstimate && repEstimate > 0
        ? `Generic analysis complete. Estimated ${repEstimate} usable reps.`
        : 'Generic analysis complete. No stable rep cycle was confidently detected.';
    return {
        summary,
        repEstimate,
        coverage: round(coverage, 3),
        stabilityScore: round(stabilityScore, 3),
        mobilityScore: round(mobilityScore, 3),
        rhythmScore: round(rhythmScore, 3),
        symmetryScore: round(symmetryScore, 3),
        issues,
        suggestions: Array.from(suggestions),
        timeline
    };
}
function estimateReps(series) {
    if (series.length < 20)
        return null;
    const smooth = movingAverage(series, 5);
    let peaks = 0;
    for (let i = 1; i < smooth.length - 1; i++) {
        if (smooth[i] > smooth[i - 1] && smooth[i] > smooth[i + 1])
            peaks++;
    }
    return peaks > 0 ? peaks : null;
}
function scoreRhythm(series) {
    if (series.length < 20)
        return 0.5;
    const smooth = movingAverage(series, 5);
    const peakIdx = [];
    for (let i = 1; i < smooth.length - 1; i++) {
        if (smooth[i] > smooth[i - 1] && smooth[i] > smooth[i + 1])
            peakIdx.push(i);
    }
    if (peakIdx.length < 3)
        return 0.5;
    const intervals = [];
    for (let i = 1; i < peakIdx.length; i++)
        intervals.push(peakIdx[i] - peakIdx[i - 1]);
    const meanValue = mean(intervals);
    if (!meanValue)
        return 0.5;
    const cv = std(intervals) / meanValue;
    return clamp01(1 - cv);
}
function movingAverage(series, size) {
    const out = [];
    for (let i = 0; i < series.length; i++) {
        const start = Math.max(0, i - size + 1);
        out.push(mean(series.slice(start, i + 1)));
    }
    return out;
}
function mean(xs) {
    if (!xs.length)
        return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs) {
    if (!xs.length)
        return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / xs.length);
}
function range(xs) {
    if (!xs.length)
        return 0;
    let min = xs[0];
    let max = xs[0];
    for (const x of xs) {
        if (x < min)
            min = x;
        if (x > max)
            max = x;
    }
    return max - min;
}
function clamp01(v) {
    if (v < 0)
        return 0;
    if (v > 1)
        return 1;
    return v;
}
function round(v, digits) {
    const base = 10 ** digits;
    return Math.round(v * base) / base;
}
