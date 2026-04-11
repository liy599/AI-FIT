import { analyzeGenericMotion } from '../src/lib/pose/genericMotion';
import { buildGenericMotionReport } from '../src/lib/pose/report';
import { buildSquatVideoLiveStyleReport } from '../src/lib/pose/analyzer/squatReport';
export function runOfflineCase(input) {
    const exerciseName = input.exercise.name ?? input.exercise.slug;
    if (input.exercise.slug === 'squat') {
        return buildSquatVideoLiveStyleReport({
            taskId: input.id,
            viewAngle: input.viewAngle,
            exercise: { id: input.exercise.slug, name: exerciseName },
            video: null,
            fps: input.fps,
            frames: input.frames
        });
    }
    const analysis = analyzeGenericMotion(input.frames);
    return buildGenericMotionReport({
        taskId: input.id,
        viewAngle: input.viewAngle,
        instruction: null,
        exercise: { id: input.exercise.slug, name: exerciseName },
        video: null,
        fps: input.fps,
        analysis
    });
}
