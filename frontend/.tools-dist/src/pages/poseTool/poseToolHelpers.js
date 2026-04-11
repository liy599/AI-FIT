import { normalizeReportForArchive } from '../../lib/report/unified';
import { RealtimeSquatAnalyzer } from '../../lib/pose/realtimeSquat';
import { RealtimeLateralRaiseAnalyzer } from '../../lib/pose/realtimeLateralRaise';
import { RealtimePushupAnalyzer } from '../../lib/pose/realtimePushup';
import { RealtimePullupAnalyzer } from '../../lib/pose/realtimePullup';
import { RealtimeBenchPressAnalyzer } from '../../lib/pose/realtimeBenchPress';
export function buildSquatAlignedReport(input) {
    const sortedIssues = Array.from(input.messageFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    const avgTrackingQuality = input.trackingQualitySamples.length > 0
        ? input.trackingQualitySamples.reduce((acc, value) => acc + value, 0) / input.trackingQualitySamples.length
        : 0;
    const fallbackSuggestion = 'Keep a steady tempo and align your knees with your toes.';
    const currentSuggestion = input.lastFeedback
        ? input.lastFeedback.issues[0]?.message ?? input.lastFeedback.warnings[0] ?? input.lastFeedback.lastRepMessage ?? fallbackSuggestion
        : input.source === 'video'
            ? 'No valid pose frames were detected. Keep your full body in frame and try another video.'
            : 'No valid pose frames were detected in the live session.';
    const issueMessages = sortedIssues
        .filter(([message, count]) => {
        const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0;
        const text = message.toLowerCase();
        const isSideViewWarn = text.includes('side view');
        const isLowConfidenceWarn = text.includes('low keypoint confidence');
        if (text.includes('try to stay in a clear side view for more stable tracking'))
            return false;
        if ((isSideViewWarn || isLowConfidenceWarn) && avgTrackingQuality >= 0.62) {
            return ratio >= 0.35;
        }
        return true;
    })
        .map(([message]) => message);
    const tempoCheck = analyzeSquatTempoFromTimeline(input.timelineRows);
    const sessionFastRepCount = input.lastFeedback?.session.fastRepCount ?? 0;
    const phaseFastRepCount = Math.max(tempoCheck.fastDescentCount, tempoCheck.fastAscentCount);
    const unifiedFastRepCount = Math.max(sessionFastRepCount, phaseFastRepCount);
    const issues = issueMessages.length > 0
        ? issueMessages.map((message) => {
            const count = input.messageFreq.get(message) ?? 0;
            const ratio = input.analyzedFrameCount > 0 ? count / input.analyzedFrameCount : 0;
            const severity = ratio >= 0.35 ? 'error' : ratio >= 0.12 ? 'warning' : 'info';
            return {
                code: toIssueCode(message),
                severity,
                message,
                atFrame: null
            };
        })
        : [
            {
                code: 'NO_OBVIOUS_ISSUES',
                severity: 'info',
                message: input.source === 'video' ? 'No obvious issues detected during analyzer replay.' : 'No obvious issues detected during live analysis.',
                atFrame: null
            }
        ];
    if (tempoCheck.fastDescentCount > 0) {
        issues.push({
            code: 'DESCENT_TOO_FAST',
            severity: tempoCheck.fastDescentCount >= 2 ? 'warning' : 'info',
            message: `Descent too fast detected (${tempoCheck.fastDescentCount} rep${tempoCheck.fastDescentCount > 1 ? 's' : ''}).`,
            atFrame: null
        });
    }
    if (tempoCheck.fastAscentCount > 0) {
        issues.push({
            code: 'ASCENT_TOO_FAST',
            severity: tempoCheck.fastAscentCount >= 2 ? 'warning' : 'info',
            message: `Ascent too fast detected (${tempoCheck.fastAscentCount} rep${tempoCheck.fastAscentCount > 1 ? 's' : ''}).`,
            atFrame: null
        });
    }
    const summaryPrefix = input.source === 'video' ? 'Video replay analysis' : 'Live analysis';
    const summary = input.lastFeedback
        ? `${summaryPrefix}: total ${input.lastFeedback.session.totalReps}, correct ${input.lastFeedback.session.correctReps}, accuracy ${input.lastFeedback.session.accuracyPct}%, avg rep ${input.lastFeedback.session.avgRepDurationSec ?? '-'}s.`
        : `${summaryPrefix}: no stable pose frames were detected.`;
    const suggestions = buildSquatReplaySuggestions(input.lastFeedback, sortedIssues, fallbackSuggestion);
    const keyMetrics = {
        totalReps: input.lastFeedback?.session.totalReps ?? 0,
        correctReps: input.lastFeedback?.session.correctReps ?? 0,
        incorrectReps: input.lastFeedback?.session.incorrectReps ?? 0,
        formAccuracyPct: input.lastFeedback?.session.accuracyPct ?? 0,
        avgRepDurationSec: input.lastFeedback?.session.avgRepDurationSec ?? null,
        fastRepCount: unifiedFastRepCount,
        slowRepCount: input.lastFeedback?.session.slowRepCount ?? 0,
        effectiveFps: input.fps
    };
    const generatedAt = new Date().toISOString();
    const timelineSampled = sampleTimelineRows(input.timelineRows, 180);
    return normalizeReportForArchive({
        version: 3,
        generatedAt,
        status: 'ok',
        task: { id: input.taskId, viewAngle: input.viewAngle, instruction: null },
        exercise: input.exercise,
        video: input.video,
        summary,
        keyMetrics,
        issues,
        suggestions,
        details: {
            type: input.source === 'video' ? 'video_live_replay_squat' : 'live_realtime_squat',
            modelName: input.source === 'video' ? 'MoveNet Lightning (offline replay)' : 'MoveNet Lightning (realtime)',
            analyzer: 'RealtimeSquatAnalyzer',
            effectiveFps: input.fps,
            repCount: input.lastFeedback?.repCount ?? 0,
            correctCount: input.lastFeedback?.correctCount ?? 0,
            incorrectCount: input.lastFeedback?.incorrectCount ?? 0,
            kneeAngle: input.lastFeedback?.kneeAngle ?? null,
            hipAngle: input.lastFeedback?.hipAngle ?? null,
            torsoAngle: input.lastFeedback?.torsoAngle ?? null,
            offsetAngle: input.lastFeedback?.offsetAngle ?? null,
            trackingQuality: input.lastFeedback?.trackingQuality ?? null,
            avgTrackingQuality: Math.round(avgTrackingQuality * 100) / 100,
            currentSuggestion,
            warnings: input.lastFeedback?.warnings ?? [],
            tempo: tempoCheck,
            timelineSampled
        },
        sections: {
            overview: {
                generatedAt,
                status: 'ok',
                taskId: input.taskId,
                viewAngle: input.viewAngle,
                exerciseName: input.exercise?.name ?? null,
                summary
            },
            metrics: keyMetrics,
            errorStats: computeReportErrorStats(issues),
            suggestions,
            timelineSampled
        }
    });
}
export function buildSquatVideoLiveStyleReport(input) {
    const analyzer = new RealtimeSquatAnalyzer();
    let lastFeedback = null;
    let analyzedFrameCount = 0;
    const messageFreq = new Map();
    const trackingQualitySamples = [];
    const timelineRows = [];
    const total = input.frames.length;
    for (let i = 0; i < input.frames.length; i++) {
        const frame = input.frames[i];
        if (frame.landmarks) {
            const feedback = analyzer.analyze(frame.landmarks);
            lastFeedback = feedback;
            analyzedFrameCount += 1;
            if (Number.isFinite(feedback.trackingQuality))
                trackingQualitySamples.push(feedback.trackingQuality);
            for (const message of collectLiveFrameIssueMessages(feedback)) {
                const text = message.trim();
                if (!text)
                    continue;
                messageFreq.set(text, (messageFreq.get(text) ?? 0) + 1);
            }
            timelineRows.push({
                frame: i,
                tMs: frame.tMs,
                phase: feedback.phase,
                trackingQuality: feedback.trackingQuality,
                kneeAngleDeg: feedback.kneeAngle,
                hipAngleDeg: feedback.hipAngle,
                torsoFromVerticalDeg: feedback.torsoAngle
            });
        }
        if (input.onProgress && ((i + 1) % 20 === 0 || i === input.frames.length - 1)) {
            input.onProgress(i + 1, total);
        }
    }
    return buildSquatAlignedReport({
        source: 'video',
        taskId: input.taskId,
        viewAngle: input.viewAngle,
        exercise: input.exercise,
        video: input.video,
        fps: input.fps,
        lastFeedback,
        messageFreq,
        analyzedFrameCount,
        trackingQualitySamples,
        timelineRows
    });
}
export function getRepsFromReport(report) {
    const keyMetrics = report.keyMetrics;
    if (keyMetrics && typeof keyMetrics === 'object' && !Array.isArray(keyMetrics)) {
        const totalReps = keyMetrics.totalReps;
        if (typeof totalReps === 'number' && Number.isFinite(totalReps) && totalReps >= 0)
            return Math.max(0, Math.round(totalReps));
    }
    const repCount = report.repCount;
    if (typeof repCount === 'number' && Number.isFinite(repCount) && repCount >= 0)
        return Math.max(0, Math.round(repCount));
    return 0;
}
export function evaluateRangeCheck(feedback, exerciseSlug) {
    if (!feedback)
        return { ok: false, reason: 'Waiting for stable tracking' };
    if (feedback.lastRepReasonLabels.length > 0) {
        return { ok: false, reason: feedback.lastRepReasonLabels[0] ?? 'Form needs correction' };
    }
    if (feedback.issues.length > 0) {
        return { ok: false, reason: feedback.issues[0]?.message ?? 'Form needs correction' };
    }
    if (exerciseSlug === 'squat' && typeof feedback.torsoAngle === 'number' && feedback.torsoAngle > 35) {
        return { ok: false, reason: 'Excessive forward lean' };
    }
    if (exerciseSlug === 'lateral-raise' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle >= 60) {
        return { ok: true, reason: 'Raise height reached' };
    }
    if ((exerciseSlug === 'pushup' || exerciseSlug === 'pullup' || exerciseSlug === 'bench-press') && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle <= 95) {
        return { ok: true, reason: exerciseSlug === 'pushup' ? 'Push-up depth reached' : exerciseSlug === 'pullup' ? 'Top position reached' : 'Bench depth reached' };
    }
    if (exerciseSlug === 'squat' && typeof feedback.kneeAngle === 'number' && feedback.kneeAngle < 85) {
        return { ok: true, reason: 'Depth reached' };
    }
    return { ok: true, reason: 'Current rep is in range' };
}
export function formatDuration(ms) {
    const safeMs = Math.max(0, Math.round(ms));
    const totalSec = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
export function getSessionComment(accuracyPct, reps, exerciseSlug) {
    if (reps <= 0) {
        return exerciseSlug === 'lateral-raise'
            ? 'No completed reps were detected. Raise both arms to shoulder level with a steady tempo.'
            : exerciseSlug === 'pushup'
                ? 'No completed reps were detected. Lower until elbows bend deeper, then press up in one line.'
                : exerciseSlug === 'pullup'
                    ? 'No completed reps were detected. Pull with full range and lower under control.'
                    : exerciseSlug === 'bench-press'
                        ? 'No completed reps were detected. Lower to stable depth and press with a controlled path.'
                        : 'No completed reps were detected. Try a full-depth squat with a steady tempo.';
    }
    if (accuracyPct >= 90)
        return 'Excellent consistency. Keep the same depth and tempo in your next set.';
    if (accuracyPct >= 75)
        return 'Good overall form. Focus on the repeated issues to improve consistency.';
    if (accuracyPct >= 50)
        return 'Mixed quality set. Slow down and prioritize controlled reps.';
    return 'Form is not stable yet. Reduce speed and focus on one correction cue at a time.';
}
export function getTopIssues(snapshot) {
    if (!snapshot)
        return [];
    const raw = [...(snapshot.lastRepReasonLabels ?? []), ...(snapshot.issues?.map((x) => x.message) ?? []), ...(snapshot.warnings ?? [])];
    const seen = new Set();
    const deduped = [];
    for (const item of raw) {
        const normalized = item.trim();
        if (!normalized || seen.has(normalized))
            continue;
        seen.add(normalized);
        deduped.push(normalized);
        if (deduped.length >= 2)
            break;
    }
    return deduped;
}
export function collectLiveIssueMessages(feedback) {
    if (!feedback)
        return [];
    const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.lastRepReasonLabels ?? []), ...(feedback.warnings ?? [])];
    const seen = new Set();
    const deduped = [];
    for (const item of raw) {
        const text = item.trim();
        if (!text || seen.has(text))
            continue;
        seen.add(text);
        deduped.push(text);
    }
    return deduped;
}
export function collectLiveFrameIssueMessages(feedback) {
    if (!feedback)
        return [];
    const raw = [...(feedback.issues?.map((x) => x.message) ?? []), ...(feedback.warnings ?? [])];
    const seen = new Set();
    const deduped = [];
    for (const item of raw) {
        const text = item.trim();
        if (!text || seen.has(text))
            continue;
        seen.add(text);
        deduped.push(text);
    }
    return deduped;
}
export function buildLiveSuggestions(feedback, fallbackSuggestion, exerciseSlug) {
    const suggestions = new Set();
    const messages = collectLiveIssueMessages(feedback);
    for (const message of messages) {
        const mapped = mapSuggestionFromIssue(message, exerciseSlug);
        if (mapped)
            suggestions.add(mapped);
    }
    if (suggestions.size === 0 && fallbackSuggestion.trim())
        suggestions.add(fallbackSuggestion.trim());
    if (suggestions.size === 0) {
        suggestions.add(exerciseSlug === 'lateral-raise'
            ? 'Keep your movement controlled and face the camera for balanced left-right tracking.'
            : exerciseSlug === 'pushup'
                ? 'Keep your core tight and move through a full push-up range with controlled tempo.'
                : exerciseSlug === 'pullup'
                    ? 'Use a steady pull-up tempo and avoid body swing during both ascent and descent.'
                    : exerciseSlug === 'bench-press'
                        ? 'Keep your setup stable and press with controlled tempo through full range.'
                        : 'Keep your movement controlled and maintain a stable side-view camera angle.');
    }
    return Array.from(suggestions).slice(0, 4);
}
export function createAnalyzer(exerciseSlug) {
    if (exerciseSlug === 'lateral-raise')
        return new RealtimeLateralRaiseAnalyzer();
    if (exerciseSlug === 'pushup')
        return new RealtimePushupAnalyzer();
    if (exerciseSlug === 'pullup')
        return new RealtimePullupAnalyzer();
    if (exerciseSlug === 'bench-press')
        return new RealtimeBenchPressAnalyzer();
    return new RealtimeSquatAnalyzer();
}
function sampleTimelineRows(items, max) {
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
function computeReportErrorStats(issues) {
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
function buildSquatReplaySuggestions(feedback, sortedIssues, fallbackSuggestion) {
    const suggestions = new Set();
    const prioritizedIssues = [...sortedIssues].sort((a, b) => {
        const aKnee = a[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0;
        const bKnee = b[0].toLowerCase().includes('knee is noticeably past the toes') ? 1 : 0;
        if (aKnee !== bKnee)
            return bKnee - aKnee;
        return b[1] - a[1];
    });
    for (const [message] of prioritizedIssues) {
        const mapped = mapSuggestionFromIssue(message, 'squat');
        if (mapped)
            suggestions.add(mapped);
        if (suggestions.size >= 4)
            break;
    }
    if (feedback) {
        if ((feedback.session.totalReps ?? 0) <= 0) {
            suggestions.add('Start fully upright, descend until thighs are near parallel, then stand tall to complete each rep.');
        }
        if ((feedback.session.accuracyPct ?? 0) < 70) {
            suggestions.add('Slow down each rep: 2 seconds down, brief pause, then drive up with controlled tempo.');
        }
        if ((feedback.trackingQuality ?? 0) < 0.5) {
            suggestions.add('Place the camera at hip height, keep your full body visible, and improve front lighting.');
        }
        const avgRepDurationSec = feedback.session.avgRepDurationSec ?? null;
        const fastRepCount = feedback.session.fastRepCount ?? 0;
        const slowRepCount = feedback.session.slowRepCount ?? 0;
        if (avgRepDurationSec !== null) {
            if (fastRepCount >= 1 || avgRepDurationSec < 1.15) {
                suggestions.add('Your squat tempo is a bit fast. Aim for about 2s down, brief pause, and controlled rise.');
            }
            else if (slowRepCount >= 1 || avgRepDurationSec > 3.8) {
                suggestions.add('Your squat tempo is quite slow. Keep tension, but try a smoother continuous rhythm per rep.');
            }
            else {
                suggestions.add('Tempo looks stable. Keep this rhythm to maintain depth control and consistent form.');
            }
        }
    }
    if (suggestions.size === 0)
        suggestions.add(fallbackSuggestion.trim());
    return Array.from(suggestions).slice(0, 5);
}
function analyzeSquatTempoFromTimeline(timelineRows) {
    const DESCENT_FAST_SEC = 0.62;
    const ASCENT_FAST_SEC = 0.58;
    const MIN_PHASE_SEC = 0.2;
    const DIRECTION_SWITCH_MIN_FRAMES = 2;
    let fastDescentCount = 0;
    let fastAscentCount = 0;
    let prevKnee = null;
    let phaseMode = 'idle';
    let phaseStartMs = null;
    let descentStreak = 0;
    let ascentStreak = 0;
    function resetDirectionStreak() {
        descentStreak = 0;
        ascentStreak = 0;
    }
    function maybeCountFast(phase, sec) {
        if (sec < MIN_PHASE_SEC)
            return;
        if (phase === 'descent' && sec < DESCENT_FAST_SEC)
            fastDescentCount += 1;
        if (phase === 'ascent' && sec < ASCENT_FAST_SEC)
            fastAscentCount += 1;
    }
    for (const row of timelineRows) {
        const knee = typeof row.kneeAngleDeg === 'number' ? row.kneeAngleDeg : null;
        if (row.phase === 'bottom') {
            if (phaseMode === 'descent' && phaseStartMs !== null)
                maybeCountFast('descent', (row.tMs - phaseStartMs) / 1000);
            phaseMode = 'idle';
            phaseStartMs = null;
            resetDirectionStreak();
            prevKnee = knee;
            continue;
        }
        if (row.phase === 'up') {
            if (phaseMode === 'ascent' && phaseStartMs !== null)
                maybeCountFast('ascent', (row.tMs - phaseStartMs) / 1000);
            phaseMode = 'idle';
            phaseStartMs = null;
            resetDirectionStreak();
            prevKnee = knee;
            continue;
        }
        if (row.phase !== 'bottom' && knee !== null && prevKnee !== null) {
            const diff = knee - prevKnee;
            if (diff <= -1.2) {
                descentStreak += 1;
                ascentStreak = 0;
                if (descentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'descent') {
                    phaseMode = 'descent';
                    phaseStartMs = row.tMs;
                }
            }
            else if (diff >= 1.2) {
                ascentStreak += 1;
                descentStreak = 0;
                if (ascentStreak >= DIRECTION_SWITCH_MIN_FRAMES && phaseMode !== 'ascent') {
                    phaseMode = 'ascent';
                    phaseStartMs = row.tMs;
                }
            }
            else {
                resetDirectionStreak();
            }
        }
        prevKnee = knee;
    }
    return { fastDescentCount, fastAscentCount };
}
function mapSuggestionFromIssue(issue, exerciseSlug) {
    const text = issue.toLowerCase();
    if (exerciseSlug === 'lateral-raise') {
        if (text.includes('torso sway'))
            return 'Lower the load, brace your core, and avoid swinging the torso.';
        if (text.includes('symmetry'))
            return 'Lift both arms together and match left-right height at the top.';
        if (text.includes('elbow') || text.includes('curl'))
            return 'Keep a soft elbow bend and move from the shoulder joint.';
        if (text.includes('face the camera') || text.includes('front'))
            return 'Rotate to face the camera so both arms stay visible.';
    }
    if (exerciseSlug === 'pushup') {
        if (text.includes('torso') || text.includes('hips'))
            return 'Brace your core and keep shoulders, hips, and ankles in one line.';
        if (text.includes('side-view') || text.includes('side view'))
            return 'Rotate to a clearer side-view to improve depth and body-line checks.';
        if (text.includes('confidence') || text.includes('frame'))
            return 'Improve lighting and keep your full body visible throughout each rep.';
    }
    if (exerciseSlug === 'pullup') {
        if (text.includes('kipping') || text.includes('sway') || text.includes('swing'))
            return 'Reduce swing, brace your core, and keep the pull path controlled.';
        if (text.includes('side-view') || text.includes('side view'))
            return 'Rotate to a clearer side-view to improve pull-up range and alignment checks.';
        if (text.includes('confidence') || text.includes('frame'))
            return 'Improve lighting and keep your full body visible throughout each rep.';
    }
    if (exerciseSlug === 'bench-press') {
        if (text.includes('torso') || text.includes('bridge'))
            return 'Keep your torso braced and avoid excessive arch changes between reps.';
        if (text.includes('side-view') || text.includes('side view'))
            return 'Rotate to a clearer side-view to improve bench depth and elbow tracking.';
        if (text.includes('confidence') || text.includes('frame'))
            return 'Improve lighting and keep shoulders, elbows, wrists, and torso visible.';
    }
    if (text.includes('torso lean'))
        return 'Brace your core and keep your chest up during the descent.';
    if (text.includes('knee') && text.includes('toes')) {
        return 'Your knees are drifting past toes: push hips back first, keep shins more vertical, and drive through mid-foot/heel.';
    }
    if (text.includes('side view'))
        return 'Set the camera exactly side-on at hip height, 2-3 meters away, with your full body always in frame.';
    if (text.includes('confidence') || text.includes('frame'))
        return 'Use brighter front lighting and step back so ankles, knees, hips, and shoulders stay visible.';
    return '';
}
export function toIssueCode(message) {
    return message
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
}
