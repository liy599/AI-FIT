import { buildPoseFrame } from './poseFrame';
export class PoseMetricTracker {
    last = null;
    window = [];
    windowMs;
    constructor(opts) {
        this.windowMs = opts?.stabilityWindowMs ?? 900;
    }
    update(landmarks, tsMs) {
        const frame = buildPoseFrame(landmarks, tsMs, {
            prev: this.last,
            stabilityWindow: this.window,
            stabilityWindowMs: this.windowMs
        });
        this.last = frame;
        this.window.push(frame);
        const cutoff = tsMs - this.windowMs;
        while (this.window.length > 0 && this.window[0].tsMs < cutoff)
            this.window.shift();
        return frame;
    }
    reset() {
        this.last = null;
        this.window = [];
    }
}
