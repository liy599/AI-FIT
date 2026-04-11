export async function extractPose33FromVideoUrl(videoUrl, opts = {}) {
    const { maxFrames = 4000, targetFps = 30, minVisibility = 0.2, onProgress } = opts;
    if (typeof window === 'undefined')
        throw new Error('Browser only');
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    onProgress?.({ processed: 0, total: 1, stage: 'loading' });
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
    });
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    await new Promise((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () => reject(new Error('Video load failed'));
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration || duration <= 0)
        throw new Error('Invalid video duration');
    const fps = Math.max(1, Math.min(60, Math.round(targetFps)));
    const total = Math.min(maxFrames, Math.max(1, Math.floor(duration * fps)));
    const frames = [];
    for (let i = 0; i < total; i++) {
        const tMs = (i / fps) * 1000;
        const timeSec = i / fps;
        await seekVideo(video, timeSec);
        const result = landmarker.detectForVideo(video, tMs);
        const landmarks = result.landmarks?.[0] ?? null;
        frames.push({
            tMs,
            landmarks: landmarks ? filterByVisibility(landmarks, minVisibility) : null
        });
        onProgress?.({ processed: i + 1, total, stage: 'extracting' });
    }
    landmarker.close();
    return { fps, frames };
}
async function seekVideo(video, timeSec) {
    if (Math.abs(video.currentTime - timeSec) < 1e-4)
        return;
    await new Promise((resolve, reject) => {
        const onSeeked = () => resolve();
        const onError = () => reject(new Error('Video seek failed'));
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = Math.min(Math.max(0, timeSec), Math.max(0, (video.duration || 0) - 1e-3));
    });
}
function filterByVisibility(lms, minVisibility) {
    return lms.map((point) => {
        const visibility = typeof point.visibility === 'number' ? point.visibility : 1;
        if (visibility < minVisibility) {
            return { x: point.x, y: point.y, z: point.z, visibility, presence: point.presence };
        }
        return point;
    });
}
