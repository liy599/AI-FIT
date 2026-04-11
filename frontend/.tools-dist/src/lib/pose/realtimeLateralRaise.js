export class RealtimeLateralRaiseAnalyzer {
    repCount = 0;
    correctCount = 0;
    incorrectCount = 0;
    currentState = null;
    lastRepResult = null;
    lastRepMessage = null;
    lastRepFrameCount = null;
    enteredTop = false;
    frameCount = 0;
    analyze(landmarks) {
        const lShoulder = landmarks[11];
        const rShoulder = landmarks[12];
        const lElbow = landmarks[13];
        const rElbow = landmarks[14];
        const lWrist = landmarks[15];
        const rWrist = landmarks[16];
        const lHip = landmarks[23];
        const rHip = landmarks[24];
        const midShoulder = this.midpoint(lShoulder, rShoulder);
        const midHip = this.midpoint(lHip, rHip);
        const leftRaise = this.shoulderRaiseDeg(lShoulder, lElbow, lHip);
        const rightRaise = this.shoulderRaiseDeg(rShoulder, rElbow, rHip);
        const armRaise = this.avg([leftRaise, rightRaise]);
        const leftElbowAngle = this.angleDeg(lShoulder, lElbow, lWrist);
        const rightElbowAngle = this.angleDeg(rShoulder, rElbow, rWrist);
        const elbowAngle = this.avg([leftElbowAngle, rightElbowAngle]);
        const symmetryGap = leftRaise !== null && rightRaise !== null ? Math.abs(leftRaise - rightRaise) : null;
        const torsoAngle = this.angleFromVerticalDeg(midShoulder, midHip);
        const frontAlignment = this.frontAlignmentDeg(lShoulder, rShoulder);
        const trackingQuality = this.avgVisibility(landmarks, [11, 12, 13, 14, 15, 16, 23, 24]);
        const warnings = [];
        const issues = [];
        const isCountingPaused = trackingQuality < 0.45 || armRaise === null;
        const nextState = isCountingPaused ? this.currentState : this.detectState(armRaise);
        if (trackingQuality < 0.45) {
            warnings.push('Low keypoint confidence. Keep your full upper body in frame with better lighting.');
        }
        if (torsoAngle !== null && torsoAngle > 20) {
            issues.push({ message: 'Avoid torso sway and keep your trunk upright.', joints: [11, 12, 23, 24] });
        }
        if (symmetryGap !== null && symmetryGap > 22) {
            issues.push({ message: 'Raise both arms evenly to improve symmetry.', joints: [11, 12, 13, 14] });
        }
        if (elbowAngle !== null && elbowAngle < 125) {
            warnings.push('Keep elbows softly fixed. Avoid turning this into an elbow curl.');
        }
        if (frontAlignment !== null && frontAlignment > 20) {
            warnings.push('Face the camera more directly for better left-right comparison.');
        }
        this.updateState(nextState);
        const primaryIssue = issues[0]?.message ?? null;
        const primaryWarn = warnings[0] ?? null;
        return {
            phase: this.stateToPhase(nextState),
            state: nextState,
            mode: 'beginner',
            kneeAngle: armRaise ? Math.round(armRaise) : null,
            hipAngle: elbowAngle ? Math.round(elbowAngle) : null,
            torsoAngle: torsoAngle ? Math.round(torsoAngle) : null,
            kneeVerticalAngle: symmetryGap ? Math.round(symmetryGap) : null,
            offsetAngle: frontAlignment ? Math.round(frontAlignment) : null,
            trackingQuality: Math.round(trackingQuality * 100) / 100,
            isCountingPaused,
            warnings,
            issues,
            stateSequence: [],
            lastRepResult: this.lastRepResult,
            lastRepMessage: this.lastRepMessage ?? primaryIssue ?? primaryWarn,
            lastRepReasonCodes: [],
            lastRepReasonLabels: [],
            lastRepCorrections: [],
            correctCount: this.correctCount,
            incorrectCount: this.incorrectCount,
            repCount: this.repCount,
            lastRepFrameCount: this.lastRepFrameCount,
            inactiveSeconds: 0,
            session: {
                totalReps: this.repCount,
                correctReps: this.correctCount,
                incorrectReps: this.incorrectCount,
                accuracyPct: this.repCount > 0 ? Math.round((this.correctCount / this.repCount) * 100) : 0,
                depthInsufficientCount: 0,
                kneeOverToeCount: 0,
                forwardLeanCount: 0,
                backwardLeanCount: 0,
                sideViewWarningCount: 0
            }
        };
    }
    resetSession() {
        this.repCount = 0;
        this.correctCount = 0;
        this.incorrectCount = 0;
        this.currentState = null;
        this.lastRepResult = null;
        this.lastRepMessage = null;
        this.lastRepFrameCount = null;
        this.enteredTop = false;
        this.frameCount = 0;
    }
    updateState(nextState) {
        if (nextState === null)
            return;
        this.frameCount += 1;
        if (nextState === 's3')
            this.enteredTop = true;
        if (this.currentState !== 's1' && nextState === 's1' && this.enteredTop) {
            this.repCount += 1;
            this.correctCount += 1;
            this.lastRepResult = 'correct';
            this.lastRepMessage = 'Rep completed. Keep shoulders down and movement smooth.';
            this.lastRepFrameCount = this.frameCount;
            this.frameCount = 0;
            this.enteredTop = false;
        }
        this.currentState = nextState;
    }
    detectState(armRaise) {
        if (armRaise === null)
            return null;
        if (armRaise >= 68)
            return 's3';
        if (armRaise >= 28)
            return 's2';
        return 's1';
    }
    stateToPhase(state) {
        if (state === 's1')
            return 'up';
        if (state === 's2')
            return 'ascent';
        if (state === 's3')
            return 'bottom';
        return 'up';
    }
    shoulderRaiseDeg(shoulder, elbow, hip) {
        if (!shoulder || !elbow || !hip)
            return null;
        const vArm = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
        const vTorso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y };
        const armLen = Math.hypot(vArm.x, vArm.y);
        const torsoLen = Math.hypot(vTorso.x, vTorso.y);
        if (!armLen || !torsoLen)
            return null;
        const dot = vArm.x * vTorso.x + vArm.y * vTorso.y;
        const cos = Math.min(1, Math.max(-1, dot / (armLen * torsoLen)));
        return (Math.acos(cos) * 180) / Math.PI;
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
        const dx = top.x - bottom.x;
        const dy = top.y - bottom.y;
        const mag = Math.hypot(dx, dy);
        if (!mag)
            return null;
        const cos = Math.min(1, Math.max(-1, dy / mag));
        return Math.abs((Math.acos(cos) * 180) / Math.PI);
    }
    frontAlignmentDeg(leftShoulder, rightShoulder) {
        if (!leftShoulder || !rightShoulder)
            return null;
        const dx = Math.abs(rightShoulder.x - leftShoulder.x);
        const dy = Math.abs(rightShoulder.y - leftShoulder.y) + 1e-6;
        return (Math.atan2(dy, dx + 1e-6) * 180) / Math.PI;
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
    avgVisibility(landmarks, indices) {
        let total = 0;
        for (const idx of indices)
            total += this.visibilityOf(landmarks[idx]);
        return indices.length > 0 ? total / indices.length : 0;
    }
    visibilityOf(point) {
        if (!point)
            return 0;
        const v = typeof point.visibility === 'number' ? point.visibility : 0.5;
        if (!Number.isFinite(v))
            return 0;
        return Math.max(0, Math.min(1, v));
    }
    avg(values) {
        const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
        if (valid.length === 0)
            return null;
        return valid.reduce((sum, v) => sum + v, 0) / valid.length;
    }
}
