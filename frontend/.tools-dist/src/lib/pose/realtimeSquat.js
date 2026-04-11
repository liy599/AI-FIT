const LM = {
    left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, heel: 29, footIndex: 31, nose: 0, rShoulder: 12 },
    right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, heel: 30, footIndex: 32, nose: 0, rShoulder: 11 }
};
const KNEE_OVER_TOE_WARN_RATIO = 0.07;
const KNEE_OVER_TOE_FAIL_RATIO = 0.1;
const KNEE_OVER_TOE_FAIL_MIN_FRAMES = 3;
const FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL = 49;
const FORWARD_LEAN_FAIL_MIN_FRAMES = 5;
const ASSUMED_ANALYZER_FPS = 24;
const REP_FAST_SEC = 0.95;
const REP_SLOW_SEC = 3.6;
const DEPTH_OK_KNEE_ANGLE = 112;
const DEPTH_WARN_KNEE_ANGLE = 118;
const DEPTH_FAIL_KNEE_ANGLE = 125;
const HEEL_LIFT_MINOR_Y = 0.012;
const HEEL_LIFT_MODERATE_Y = 0.025;
const HEEL_LIFT_SEVERE_Y = 0.04;
const HEEL_LIFT_FAIL_MIN_FRAMES = 3;
const KNEE_VALGUS_OK_RATIO = 0.92;
const KNEE_VALGUS_MINOR_RATIO = 0.85;
const KNEE_VALGUS_MODERATE_RATIO = 0.75;
const KNEE_VALGUS_FAIL_MIN_FRAMES = 3;
const TORSO_LEAN_OK_ANGLE_FROM_VERTICAL = 30;
const TORSO_LEAN_MODERATE_ANGLE_FROM_VERTICAL = 40;
const TORSO_LEAN_SEVERE_ANGLE_FROM_VERTICAL = 49;
const REP_COUNT_MIN_FRAMES = 5;
const REP_VALID_MIN_FRAMES = 8;
const REP_VALID_RATIO_MIN = 0.45;
const TRACKING_QUALITY_MIN = 0.28;
const S1_ENTER_KNEE_ANGLE = 150;
const S1_EXIT_KNEE_ANGLE = 145;
const S3_ENTER_KNEE_ANGLE = 125;
const S3_EXIT_KNEE_ANGLE = 133;
const FORWARD_LEAN_WARN_ANGLE_FROM_VERTICAL = 35;
export class RealtimeSquatAnalyzer {
    mode = 'beginner';
    repCount = 0;
    correctCount = 0;
    incorrectCount = 0;
    unassessedCount = 0;
    kneeOverToeRepCount = 0;
    forwardLeanRepCount = 0;
    depthInsufficientRepCount = 0;
    kneeValgusRepCount = 0;
    heelLiftRepCount = 0;
    torsoLeanRepCount = 0;
    tempoIssueRepCount = 0;
    currentState = null;
    lastRepResult = null;
    lastRepMessage = null;
    lastRepReasonCodes = [];
    lastRepReasonLabels = [];
    lastRepCorrections = [];
    lastRepFrameCount = null;
    enteredBottom = false;
    frameCount = 0;
    repPeakKneeOverToeRatio = 0;
    repKneeOverToeHardFrames = 0;
    repPeakTorsoLeanAngle = 0;
    repForwardLeanHardFrames = 0;
    repMinKneeAngle = null;
    repPeakHeelLiftY = 0;
    repHeelLiftHardFrames = 0;
    repMinKneeSpacingRatio = null;
    repKneeValgusHardFrames = 0;
    repValidFrameCount = 0;
    repDurationTotalSec = 0;
    repDurationCount = 0;
    fastRepCount = 0;
    slowRepCount = 0;
    repDurationsSec = [];
    setMode(mode) {
        this.mode = mode;
    }
    analyzeFrame(input) {
        return this.analyzeWithGate(input.landmarks, input.gatePaused);
    }
    analyze(landmarks) {
        return this.analyzeWithGate(landmarks, false);
    }
    analyzeWithGate(landmarks, gatePaused) {
        const side = this.chooseSide(landmarks);
        const idx = LM[side];
        const lShoulder = landmarks[11];
        const rShoulder = landmarks[12];
        const lHip = landmarks[23];
        const rHip = landmarks[24];
        const lKnee = landmarks[25];
        const rKnee = landmarks[26];
        const lAnkle = landmarks[27];
        const rAnkle = landmarks[28];
        const midShoulder = this.midpoint(lShoulder, rShoulder);
        const midHip = this.midpoint(lHip, rHip);
        const midKnee = this.midpoint(lKnee, rKnee);
        const midAnkle = this.midpoint(lAnkle, rAnkle);
        const shoulder = landmarks[idx.shoulder];
        const hip = landmarks[idx.hip];
        const knee = landmarks[idx.knee];
        const ankle = landmarks[idx.ankle];
        const footIndex = landmarks[idx.footIndex];
        const nose = landmarks[idx.nose];
        const otherShoulder = landmarks[idx.rShoulder];
        const kneeAngle = this.angleDeg(midHip ?? hip, midKnee ?? knee, midAnkle ?? ankle);
        const hipAngle = this.angleDeg(midShoulder ?? shoulder, midHip ?? hip, midKnee ?? knee);
        const torsoAngle = this.angleFromVerticalDeg(midShoulder ?? shoulder, midHip ?? hip);
        const kneeVerticalAngle = this.lineToVerticalDeg(midHip ?? hip, midKnee ?? knee);
        const offsetAngle = this.offsetAngleDeg(nose, shoulder, otherShoulder);
        const trackingQuality = this.avgVisibility(landmarks, [idx.nose, idx.shoulder, idx.hip, idx.knee, idx.ankle, idx.footIndex]);
        const warnings = [];
        const issues = [];
        const wrongAngle = offsetAngle !== null && offsetAngle > 55;
        const lowConfidence = trackingQuality < TRACKING_QUALITY_MIN || kneeVerticalAngle === null || torsoAngle === null;
        const isCountingPaused = gatePaused || wrongAngle || lowConfidence;
        const nextState = isCountingPaused ? this.currentState : this.detectState(kneeAngle);
        let kneeOverToeRatio = null;
        const heelLiftY = this.heelLiftY(landmarks, idx.heel, idx.footIndex);
        const kneeSpacingRatio = this.kneeSpacingRatio(landmarks, offsetAngle);
        if (wrongAngle) {
            warnings.push('Try to stay in a clear side view for more stable tracking.');
        }
        if (lowConfidence) {
            warnings.push('Low keypoint confidence. Improve lighting and keep your full body in frame.');
        }
        if (!isCountingPaused) {
            const torsoCorr = this.computeTorsoLeanCorrection(torsoAngle, shoulder, hip, ankle);
            if (torsoCorr.level === 'severe' || torsoCorr.level === 'moderate') {
                issues.push({ message: torsoCorr.title, joints: torsoCorr.joints });
            }
            else if (torsoCorr.level === 'minor') {
                warnings.push(torsoCorr.title);
            }
            const heelCorr = this.computeHeelLiftCorrection(heelLiftY, idx);
            if (heelCorr.level === 'severe' || heelCorr.level === 'moderate') {
                issues.push({ message: heelCorr.title, joints: heelCorr.joints });
            }
            else if (heelCorr.level === 'minor') {
                warnings.push(heelCorr.title);
            }
            const depthCorr = this.computeDepthCorrection(kneeAngle);
            if (nextState === 's3') {
                if (depthCorr.level === 'severe' || depthCorr.level === 'moderate') {
                    issues.push({ message: depthCorr.title, joints: depthCorr.joints });
                }
                else if (depthCorr.level === 'minor') {
                    warnings.push(depthCorr.title);
                }
            }
            const valgusCorr = this.computeKneeValgusCorrection(kneeSpacingRatio);
            if (valgusCorr.level === 'severe' || valgusCorr.level === 'moderate') {
                issues.push({ message: valgusCorr.title, joints: valgusCorr.joints });
            }
            else if (valgusCorr.level === 'minor') {
                warnings.push(valgusCorr.title);
            }
            if (knee !== undefined && footIndex !== undefined && hip !== undefined && ankle !== undefined) {
                const dir = Math.sign((ankle.x - hip.x) || 1);
                kneeOverToeRatio = (knee.x - footIndex.x) * dir;
                if (kneeOverToeRatio > KNEE_OVER_TOE_WARN_RATIO) {
                    warnings.push('Knee is moving past toes. Push hips back first and keep shins more vertical.');
                }
                if (kneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO) {
                    issues.push({ message: 'Knee is noticeably past the toes', joints: [idx.knee, idx.footIndex] });
                }
            }
            this.updateState(nextState, kneeOverToeRatio, torsoAngle, kneeAngle, heelLiftY, kneeSpacingRatio);
        }
        const coreCorrections = this.buildCoreCorrections({
            kneeAngle,
            torsoAngle,
            shoulder,
            hip,
            ankle,
            heelLiftY,
            kneeSpacingRatio
        });
        const tempoCorr = coreCorrections.find((x) => x.type === 'TEMPO_DRIFT');
        if (tempoCorr && (tempoCorr.level === 'moderate' || tempoCorr.level === 'severe')) {
            warnings.push(tempoCorr.title);
        }
        const primaryIssue = issues[0]?.message ?? null;
        const primaryWarn = warnings[0] ?? null;
        return {
            phase: this.stateToPhase(nextState),
            state: nextState,
            mode: this.mode,
            kneeAngle: kneeAngle !== null ? Math.round(kneeAngle) : null,
            hipAngle: hipAngle !== null ? Math.round(hipAngle) : null,
            torsoAngle: torsoAngle !== null ? Math.round(torsoAngle) : null,
            kneeVerticalAngle: kneeVerticalAngle !== null ? Math.round(kneeVerticalAngle) : null,
            offsetAngle: offsetAngle !== null ? Math.round(offsetAngle) : null,
            trackingQuality: Math.round(trackingQuality * 100) / 100,
            isCountingPaused,
            warnings,
            issues,
            coreCorrections,
            stateSequence: [],
            lastRepResult: this.lastRepResult,
            lastRepMessage: this.lastRepMessage ?? primaryIssue ?? primaryWarn,
            lastRepReasonCodes: this.lastRepReasonCodes,
            lastRepReasonLabels: this.lastRepReasonLabels,
            lastRepCorrections: this.lastRepCorrections,
            correctCount: this.correctCount,
            incorrectCount: this.incorrectCount,
            repCount: this.repCount,
            lastRepFrameCount: this.lastRepFrameCount,
            inactiveSeconds: 0,
            session: {
                totalReps: this.repCount,
                correctReps: this.correctCount,
                incorrectReps: this.incorrectCount,
                accuracyPct: this.correctCount + this.incorrectCount > 0
                    ? Math.round((this.correctCount / (this.correctCount + this.incorrectCount)) * 100)
                    : 0,
                unassessedReps: this.unassessedCount,
                depthInsufficientCount: this.depthInsufficientRepCount,
                kneeOverToeCount: this.kneeOverToeRepCount,
                kneeValgusCount: this.kneeValgusRepCount,
                heelLiftCount: this.heelLiftRepCount,
                forwardLeanCount: this.forwardLeanRepCount,
                backwardLeanCount: 0,
                torsoLeanCount: this.torsoLeanRepCount,
                sideViewWarningCount: 0,
                avgRepDurationSec: this.repDurationCount > 0 ? Math.round((this.repDurationTotalSec / this.repDurationCount) * 100) / 100 : null,
                fastRepCount: this.fastRepCount,
                slowRepCount: this.slowRepCount,
                tempoDriftCount: this.tempoIssueRepCount
            }
        };
    }
    resetSession() {
        this.mode = 'beginner';
        this.repCount = 0;
        this.correctCount = 0;
        this.incorrectCount = 0;
        this.unassessedCount = 0;
        this.kneeOverToeRepCount = 0;
        this.forwardLeanRepCount = 0;
        this.depthInsufficientRepCount = 0;
        this.kneeValgusRepCount = 0;
        this.heelLiftRepCount = 0;
        this.torsoLeanRepCount = 0;
        this.tempoIssueRepCount = 0;
        this.currentState = null;
        this.lastRepResult = null;
        this.lastRepMessage = null;
        this.lastRepReasonCodes = [];
        this.lastRepReasonLabels = [];
        this.lastRepCorrections = [];
        this.lastRepFrameCount = null;
        this.enteredBottom = false;
        this.frameCount = 0;
        this.repPeakKneeOverToeRatio = 0;
        this.repKneeOverToeHardFrames = 0;
        this.repPeakTorsoLeanAngle = 0;
        this.repForwardLeanHardFrames = 0;
        this.repMinKneeAngle = null;
        this.repPeakHeelLiftY = 0;
        this.repHeelLiftHardFrames = 0;
        this.repMinKneeSpacingRatio = null;
        this.repKneeValgusHardFrames = 0;
        this.repValidFrameCount = 0;
        this.repDurationTotalSec = 0;
        this.repDurationCount = 0;
        this.fastRepCount = 0;
        this.slowRepCount = 0;
        this.repDurationsSec = [];
    }
    updateState(nextState, kneeOverToeRatio, torsoAngle, kneeAngle, heelLiftY, kneeSpacingRatio) {
        if (nextState === null)
            return;
        const startedRep = this.currentState === 's1' && nextState === 's2';
        if (startedRep) {
            // Start a fresh per-rep window when descent begins from standing.
            this.frameCount = 0;
            this.repPeakKneeOverToeRatio = 0;
            this.repKneeOverToeHardFrames = 0;
            this.repPeakTorsoLeanAngle = 0;
            this.repForwardLeanHardFrames = 0;
            this.repMinKneeAngle = null;
            this.repPeakHeelLiftY = 0;
            this.repHeelLiftHardFrames = 0;
            this.repMinKneeSpacingRatio = null;
            this.repKneeValgusHardFrames = 0;
            this.repValidFrameCount = 0;
        }
        this.frameCount += 1;
        this.repValidFrameCount += 1;
        if (typeof kneeOverToeRatio === 'number' && Number.isFinite(kneeOverToeRatio) && kneeOverToeRatio > 0) {
            this.repPeakKneeOverToeRatio = Math.max(this.repPeakKneeOverToeRatio, kneeOverToeRatio);
            if (kneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO)
                this.repKneeOverToeHardFrames += 1;
        }
        if (typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) && torsoAngle > 0) {
            this.repPeakTorsoLeanAngle = Math.max(this.repPeakTorsoLeanAngle, torsoAngle);
            if (torsoAngle >= FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL)
                this.repForwardLeanHardFrames += 1;
        }
        if (typeof kneeAngle === 'number' && Number.isFinite(kneeAngle) && kneeAngle > 0) {
            this.repMinKneeAngle = this.repMinKneeAngle === null ? kneeAngle : Math.min(this.repMinKneeAngle, kneeAngle);
        }
        if (typeof heelLiftY === 'number' && Number.isFinite(heelLiftY) && heelLiftY > 0) {
            this.repPeakHeelLiftY = Math.max(this.repPeakHeelLiftY, heelLiftY);
            if (heelLiftY >= HEEL_LIFT_SEVERE_Y)
                this.repHeelLiftHardFrames += 1;
        }
        if (typeof kneeSpacingRatio === 'number' && Number.isFinite(kneeSpacingRatio) && kneeSpacingRatio > 0) {
            this.repMinKneeSpacingRatio = this.repMinKneeSpacingRatio === null ? kneeSpacingRatio : Math.min(this.repMinKneeSpacingRatio, kneeSpacingRatio);
            if (kneeSpacingRatio <= KNEE_VALGUS_MODERATE_RATIO)
                this.repKneeValgusHardFrames += 1;
        }
        if (nextState === 's3')
            this.enteredBottom = true;
        if (this.currentState !== 's1' && nextState === 's1' && this.enteredBottom) {
            const enoughForCounting = this.frameCount >= REP_COUNT_MIN_FRAMES;
            if (!enoughForCounting) {
                this.lastRepResult = null;
                this.lastRepMessage = 'Rep ignored: movement was too short to count.';
                this.lastRepReasonCodes = ['REP_TOO_SHORT'];
                this.lastRepReasonLabels = ['Movement was too short to count'];
                this.lastRepCorrections = ['Use a full range and finish the standing phase before the next rep.'];
                this.lastRepFrameCount = this.frameCount;
                this.frameCount = 0;
                this.enteredBottom = false;
                this.repPeakKneeOverToeRatio = 0;
                this.repKneeOverToeHardFrames = 0;
                this.repPeakTorsoLeanAngle = 0;
                this.repForwardLeanHardFrames = 0;
                this.repMinKneeAngle = null;
                this.repPeakHeelLiftY = 0;
                this.repHeelLiftHardFrames = 0;
                this.repMinKneeSpacingRatio = null;
                this.repKneeValgusHardFrames = 0;
                this.repValidFrameCount = 0;
                this.currentState = nextState;
                return;
            }
            const validRatio = this.frameCount > 0 ? this.repValidFrameCount / this.frameCount : 0;
            const hasReliableTracking = this.repValidFrameCount >= REP_VALID_MIN_FRAMES && validRatio >= REP_VALID_RATIO_MIN;
            this.repCount += 1;
            const repDurationSec = Math.max(0.1, this.frameCount / ASSUMED_ANALYZER_FPS);
            this.repDurationTotalSec += repDurationSec;
            this.repDurationCount += 1;
            if (repDurationSec < REP_FAST_SEC)
                this.fastRepCount += 1;
            if (repDurationSec > REP_SLOW_SEC)
                this.slowRepCount += 1;
            this.repDurationsSec.push(repDurationSec);
            if (this.repDurationsSec.length > 20)
                this.repDurationsSec.shift();
            if (hasReliableTracking) {
                const kneeOverToeFailed = this.repPeakKneeOverToeRatio >= KNEE_OVER_TOE_FAIL_RATIO && this.repKneeOverToeHardFrames >= KNEE_OVER_TOE_FAIL_MIN_FRAMES;
                const forwardLeanFailed = this.repPeakTorsoLeanAngle >= FORWARD_LEAN_FAIL_ANGLE_FROM_VERTICAL &&
                    this.repForwardLeanHardFrames >= FORWARD_LEAN_FAIL_MIN_FRAMES;
                const depthFailed = (this.repMinKneeAngle ?? 999) > DEPTH_WARN_KNEE_ANGLE;
                const heelLiftFailed = this.repPeakHeelLiftY >= HEEL_LIFT_SEVERE_Y && this.repHeelLiftHardFrames >= HEEL_LIFT_FAIL_MIN_FRAMES;
                const kneeValgusFailed = (this.repMinKneeSpacingRatio ?? 1) <= KNEE_VALGUS_MODERATE_RATIO && this.repKneeValgusHardFrames >= KNEE_VALGUS_FAIL_MIN_FRAMES;
                const torsoLeanFailed = forwardLeanFailed;
                const tempoFailed = repDurationSec < REP_FAST_SEC || repDurationSec > REP_SLOW_SEC;
                if (kneeOverToeFailed || forwardLeanFailed || depthFailed || heelLiftFailed || kneeValgusFailed || tempoFailed) {
                    this.incorrectCount += 1;
                    this.lastRepResult = 'incorrect';
                    const reasonCodes = [];
                    const reasonLabels = [];
                    const corrections = [];
                    if (kneeOverToeFailed) {
                        this.kneeOverToeRepCount += 1;
                        reasonCodes.push('KNEE_OVER_TOE_EXCESSIVE');
                        reasonLabels.push('Knees drifted too far past toes');
                        corrections.push('Push hips back first and keep shins more vertical.');
                    }
                    if (torsoLeanFailed) {
                        this.forwardLeanRepCount += 1;
                        this.torsoLeanRepCount += 1;
                        reasonCodes.push('FORWARD_LEAN_EXCESSIVE');
                        reasonLabels.push('Torso leaned too far forward');
                        corrections.push('Keep chest up and brace your core as you descend.');
                    }
                    if (depthFailed) {
                        this.depthInsufficientRepCount += 1;
                        reasonCodes.push('DEPTH_INSUFFICIENT');
                        reasonLabels.push('Depth was insufficient');
                        corrections.push('Aim to descend until thighs are near parallel while keeping balance over mid-foot.');
                    }
                    if (kneeValgusFailed) {
                        this.kneeValgusRepCount += 1;
                        reasonCodes.push('KNEE_VALGUS');
                        reasonLabels.push('Knees collapsed inward');
                        corrections.push('Drive knees out to track over toes and keep feet rooted.');
                    }
                    if (heelLiftFailed) {
                        this.heelLiftRepCount += 1;
                        reasonCodes.push('HEEL_LIFT');
                        reasonLabels.push('Heels lifted off the ground');
                        corrections.push('Shift pressure to mid-foot/heel and widen stance slightly if needed.');
                    }
                    if (tempoFailed) {
                        this.tempoIssueRepCount += 1;
                        reasonCodes.push(repDurationSec < REP_FAST_SEC ? 'TEMPO_TOO_FAST' : 'TEMPO_TOO_SLOW');
                        reasonLabels.push(repDurationSec < REP_FAST_SEC ? 'Tempo was too fast' : 'Tempo was too slow');
                        corrections.push('Use a steady tempo: ~2s down, brief pause, and controlled rise.');
                    }
                    this.lastRepReasonCodes = reasonCodes;
                    this.lastRepReasonLabels = reasonLabels;
                    this.lastRepCorrections = corrections;
                    this.lastRepMessage = reasonLabels.length > 1 ? `Rep failed: ${reasonLabels.slice(0, 2).join(' + ')}.` : `Rep failed: ${reasonLabels[0] ?? 'form issue'}.`;
                }
                else {
                    this.correctCount += 1;
                    this.lastRepResult = 'correct';
                    this.lastRepMessage = 'Rep completed. Keep the tempo steady.';
                    this.lastRepReasonCodes = [];
                    this.lastRepReasonLabels = [];
                    this.lastRepCorrections = [];
                }
            }
            else {
                this.unassessedCount += 1;
                this.lastRepResult = null;
                this.lastRepMessage = 'Rep counted, but quality was not assessed due to incomplete keypoints.';
                this.lastRepReasonCodes = ['KEYPOINTS_INCOMPLETE'];
                this.lastRepReasonLabels = ['Keypoints were incomplete'];
                this.lastRepCorrections = ['Improve lighting and keep your full body in frame before continuing.'];
            }
            this.lastRepFrameCount = this.frameCount;
            this.frameCount = 0;
            this.enteredBottom = false;
            this.repPeakKneeOverToeRatio = 0;
            this.repKneeOverToeHardFrames = 0;
            this.repPeakTorsoLeanAngle = 0;
            this.repForwardLeanHardFrames = 0;
            this.repMinKneeAngle = null;
            this.repPeakHeelLiftY = 0;
            this.repHeelLiftHardFrames = 0;
            this.repMinKneeSpacingRatio = null;
            this.repKneeValgusHardFrames = 0;
            this.repValidFrameCount = 0;
        }
        this.currentState = nextState;
    }
    buildCoreCorrections(input) {
        const depth = this.computeDepthCorrection(input.kneeAngle);
        const valgus = this.computeKneeValgusCorrection(input.kneeSpacingRatio);
        const heel = this.computeHeelLiftCorrection(input.heelLiftY, null);
        const torso = this.computeTorsoLeanCorrection(input.torsoAngle, input.shoulder, input.hip, input.ankle);
        const tempo = this.computeTempoDriftCorrection();
        return [depth, valgus, heel, torso, tempo];
    }
    computeDepthCorrection(kneeAngle) {
        const value = typeof kneeAngle === 'number' && Number.isFinite(kneeAngle) ? kneeAngle : null;
        const score = value === null
            ? null
            : value > DEPTH_FAIL_KNEE_ANGLE
                ? 3
                : value > DEPTH_WARN_KNEE_ANGLE
                    ? 2
                    : value > DEPTH_OK_KNEE_ANGLE
                        ? 1
                        : 0;
        const level = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe';
        return {
            type: 'DEPTH',
            title: level === 'unknown'
                ? 'Depth check unavailable'
                : level === 'ok'
                    ? 'Depth looks good'
                    : level === 'minor'
                        ? 'Depth slightly shallow'
                        : level === 'moderate'
                            ? 'Depth insufficient'
                            : 'Depth far too shallow',
            level,
            levelScore: score,
            evidence: { kneeAngleDeg: value !== null ? Math.round(value) : null, okAtOrBelowDeg: DEPTH_OK_KNEE_ANGLE },
            suggestion: 'Aim to descend until thighs are near parallel while keeping balance over mid-foot.',
            joints: [23, 24, 25, 26, 27, 28]
        };
    }
    computeKneeValgusCorrection(kneeSpacingRatio) {
        const value = typeof kneeSpacingRatio === 'number' && Number.isFinite(kneeSpacingRatio) ? kneeSpacingRatio : null;
        const score = value === null
            ? null
            : value >= KNEE_VALGUS_OK_RATIO
                ? 0
                : value >= KNEE_VALGUS_MINOR_RATIO
                    ? 1
                    : value >= KNEE_VALGUS_MODERATE_RATIO
                        ? 2
                        : 3;
        const level = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe';
        return {
            type: 'KNEE_VALGUS',
            title: level === 'unknown'
                ? 'Knee tracking unavailable'
                : level === 'ok'
                    ? 'Knee tracking looks good'
                    : level === 'minor'
                        ? 'Knees slightly collapsing inward'
                        : level === 'moderate'
                            ? 'Knees collapsing inward'
                            : 'Severe knee collapse inward',
            level,
            levelScore: score,
            evidence: { kneeSpacingRatio: value !== null ? Math.round(value * 1000) / 1000 : null, okAtOrAbove: KNEE_VALGUS_OK_RATIO },
            suggestion: 'Drive knees out to track over toes and keep feet rooted.',
            joints: [23, 24, 25, 26, 27, 28]
        };
    }
    computeHeelLiftCorrection(heelLiftY, idx) {
        const value = typeof heelLiftY === 'number' && Number.isFinite(heelLiftY) ? heelLiftY : null;
        const score = value === null
            ? null
            : value >= HEEL_LIFT_SEVERE_Y
                ? 3
                : value >= HEEL_LIFT_MODERATE_Y
                    ? 2
                    : value >= HEEL_LIFT_MINOR_Y
                        ? 1
                        : 0;
        const level = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe';
        return {
            type: 'HEEL_LIFT',
            title: level === 'unknown'
                ? 'Heel contact unavailable'
                : level === 'ok'
                    ? 'Heels stay grounded'
                    : level === 'minor'
                        ? 'Heels slightly lifting'
                        : level === 'moderate'
                            ? 'Heels lifting off the ground'
                            : 'Heels lifting significantly',
            level,
            levelScore: score,
            evidence: { heelLiftY: value !== null ? Math.round(value * 1000) / 1000 : null, severeAtOrAbove: HEEL_LIFT_SEVERE_Y },
            suggestion: 'Shift pressure to mid-foot/heel and widen stance slightly if needed.',
            joints: idx ? [idx.ankle, idx.heel, idx.footIndex] : [27, 28, 29, 30, 31, 32]
        };
    }
    computeTorsoLeanCorrection(torsoAngle, shoulder, hip, ankle) {
        const value = typeof torsoAngle === 'number' && Number.isFinite(torsoAngle) ? torsoAngle : null;
        const forward = shoulder && hip && ankle ? this.isForwardLean(shoulder, hip, ankle) : null;
        const score = value === null
            ? null
            : value > TORSO_LEAN_SEVERE_ANGLE_FROM_VERTICAL
                ? 3
                : value > TORSO_LEAN_MODERATE_ANGLE_FROM_VERTICAL
                    ? 2
                    : value > TORSO_LEAN_OK_ANGLE_FROM_VERTICAL
                        ? 1
                        : 0;
        const level = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe';
        return {
            type: 'TORSO_LEAN',
            title: level === 'unknown'
                ? 'Torso lean unavailable'
                : level === 'ok'
                    ? 'Torso stays upright'
                    : level === 'minor'
                        ? 'Torso leaning forward slightly'
                        : level === 'moderate'
                            ? 'Excessive forward torso lean'
                            : 'Severe torso forward lean',
            level,
            levelScore: score,
            evidence: { torsoFromVerticalDeg: value !== null ? Math.round(value) : null, direction: forward === null ? null : forward ? 'forward' : 'backward' },
            suggestion: 'Keep chest up and brace your core as you descend.',
            joints: [11, 12, 23, 24]
        };
    }
    computeTempoDriftCorrection() {
        const n = this.repDurationsSec.length;
        const avg = n > 0 ? this.repDurationsSec.reduce((a, b) => a + b, 0) / n : null;
        const variance = avg !== null && n >= 2 ? this.repDurationsSec.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / (n - 1) : null;
        const sd = variance !== null ? Math.sqrt(Math.max(0, variance)) : null;
        const cv = avg !== null && sd !== null && avg > 1e-6 ? sd / avg : null;
        const fast = this.fastRepCount;
        const slow = this.slowRepCount;
        const score = n < 2 || avg === null
            ? null
            : cv !== null && cv >= 0.35
                ? 3
                : (fast + slow) >= Math.max(2, Math.ceil(this.repCount * 0.5))
                    ? 2
                    : cv !== null && cv >= 0.22
                        ? 2
                        : (fast + slow) >= 1 || (cv !== null && cv >= 0.16)
                            ? 1
                            : 0;
        const level = score === null ? 'unknown' : score === 0 ? 'ok' : score === 1 ? 'minor' : score === 2 ? 'moderate' : 'severe';
        const title = level === 'unknown'
            ? 'Tempo drift unavailable'
            : level === 'ok'
                ? 'Tempo looks steady'
                : level === 'minor'
                    ? 'Tempo slightly inconsistent'
                    : level === 'moderate'
                        ? 'Tempo drift detected'
                        : 'Tempo highly inconsistent';
        return {
            type: 'TEMPO_DRIFT',
            title,
            level,
            levelScore: score,
            evidence: {
                reps: this.repCount,
                avgRepDurationSec: avg !== null ? Math.round(avg * 100) / 100 : null,
                durationCv: cv !== null ? Math.round(cv * 1000) / 1000 : null,
                fastReps: fast,
                slowReps: slow
            },
            suggestion: 'Use a steady tempo: ~2s down, brief pause, and controlled rise.',
            joints: [11, 12, 23, 24, 25, 26]
        };
    }
    detectState(kneeAngle) {
        if (kneeAngle === null)
            return null;
        // Apply small hysteresis so state does not jitter near angle boundaries.
        if (this.currentState === 's1') {
            if (kneeAngle >= S1_EXIT_KNEE_ANGLE)
                return 's1';
            if (kneeAngle > S3_ENTER_KNEE_ANGLE)
                return 's2';
            return 's3';
        }
        if (this.currentState === 's3') {
            if (kneeAngle <= S3_EXIT_KNEE_ANGLE)
                return 's3';
            if (kneeAngle < S1_ENTER_KNEE_ANGLE)
                return 's2';
            return 's1';
        }
        if (kneeAngle >= S1_ENTER_KNEE_ANGLE)
            return 's1';
        if (kneeAngle > S3_ENTER_KNEE_ANGLE)
            return 's2';
        return 's3';
    }
    stateToPhase(state) {
        if (state === 's1')
            return 'up';
        if (state === 's2')
            return 'descent';
        if (state === 's3')
            return 'bottom';
        return 'up';
    }
    chooseSide(landmarks) {
        let leftVis = 0;
        let rightVis = 0;
        for (const k of [11, 23, 25, 27])
            leftVis += landmarks[k]?.visibility ?? 0;
        for (const k of [12, 24, 26, 28])
            rightVis += landmarks[k]?.visibility ?? 0;
        return rightVis > leftVis ? 'right' : 'left';
    }
    isForwardLean(shoulder, hip, ankle) {
        const dir = Math.sign((ankle.x - hip.x) || 1);
        return (shoulder.x - hip.x) * dir > 0;
    }
    heelLiftY(landmarks, heelIdx, footIdx) {
        const heel = landmarks[heelIdx];
        const foot = landmarks[footIdx];
        if (!heel || !foot)
            return null;
        if (Math.min(this.visibilityOf(heel), this.visibilityOf(foot)) < 0.3)
            return null;
        const y = foot.y - heel.y;
        if (!Number.isFinite(y))
            return null;
        return Math.max(0, y);
    }
    kneeSpacingRatio(landmarks, offsetAngle) {
        if (offsetAngle === null)
            return null;
        if (offsetAngle < 18 || offsetAngle > 55)
            return null;
        const lKnee = landmarks[25];
        const rKnee = landmarks[26];
        const lAnkle = landmarks[27];
        const rAnkle = landmarks[28];
        if (!lKnee || !rKnee || !lAnkle || !rAnkle)
            return null;
        if (Math.min(this.visibilityOf(lKnee), this.visibilityOf(rKnee), this.visibilityOf(lAnkle), this.visibilityOf(rAnkle)) < 0.35)
            return null;
        const kneeDist = Math.abs(lKnee.x - rKnee.x);
        const ankleDist = Math.abs(lAnkle.x - rAnkle.x);
        if (!Number.isFinite(kneeDist) || !Number.isFinite(ankleDist) || ankleDist < 1e-6)
            return null;
        return Math.max(0, Math.min(2, kneeDist / ankleDist));
    }
    avgVisibility(landmarks, indices) {
        let total = 0;
        for (const idx of indices)
            total += this.visibilityOf(landmarks[idx]);
        return indices.length > 0 ? total / indices.length : 0;
    }
    visibilityOf(p) {
        if (!p)
            return 0;
        const v = typeof p.visibility === 'number' ? p.visibility : 0.5;
        if (!Number.isFinite(v))
            return 0;
        return Math.max(0, Math.min(1, v));
    }
    angleDeg(a, b, c) {
        if (!a || !b || !c)
            return null;
        const ba = { x: a.x - b.x, y: a.y - b.y };
        const bc = { x: c.x - b.x, y: c.y - b.y };
        const dot = ba.x * bc.x + ba.y * bc.y;
        const mag = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
        if (!mag)
            return null;
        const cos = Math.min(1, Math.max(-1, dot / mag));
        return (Math.acos(cos) * 180) / Math.PI;
    }
    angleFromVerticalDeg(top, bottom) {
        if (!top || !bottom)
            return null;
        const dx = bottom.x - top.x;
        const dy = bottom.y - top.y;
        const mag = Math.hypot(dx, dy);
        if (!mag)
            return null;
        const cos = Math.min(1, Math.max(-1, dy / mag));
        return Math.abs((Math.acos(cos) * 180) / Math.PI);
    }
    lineToVerticalDeg(a, b) {
        if (!a || !b)
            return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const mag = Math.hypot(dx, dy);
        if (!mag)
            return null;
        const cos = Math.min(1, Math.max(-1, dy / mag));
        return Math.abs((Math.acos(cos) * 180) / Math.PI);
    }
    offsetAngleDeg(nose, shoulder, otherShoulder) {
        if (!nose || !shoulder || !otherShoulder)
            return null;
        const shoulderSpanX = Math.abs(shoulder.x - otherShoulder.x);
        const shoulderSpanY = Math.abs(shoulder.y - otherShoulder.y) + 1e-6;
        const frontalLikeDeg = (Math.atan2(shoulderSpanX, shoulderSpanY) * 180) / Math.PI;
        const noseDx = Math.abs(nose.x - shoulder.x);
        const noseDy = Math.abs(nose.y - shoulder.y) + 1e-6;
        const noseOffsetDeg = (Math.atan2(noseDx, noseDy) * 180) / Math.PI;
        return (frontalLikeDeg + noseOffsetDeg) / 2;
    }
    midpoint(a, b) {
        if (!a || !b)
            return null;
        if (Math.min(a.visibility ?? 0, b.visibility ?? 0) < 0.15)
            return null;
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            z: (a.z + b.z) / 2,
            visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0)
        };
    }
}
