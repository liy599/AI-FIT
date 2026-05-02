from __future__ import annotations

import os
import threading
import time
from datetime import datetime
from typing import Any

from flask import Flask

from ...extensions import db
from ...models import AnalysisResult, AnalysisTask, VideoAsset
from ...utils.privacy import encrypt_text, protect_json_payload

_WORKER_STARTED = False
_WORKER_LOCK = threading.Lock()


def _build_fallback_server_report(task: AnalysisTask, video: VideoAsset | None) -> dict[str, Any]:
    now = datetime.utcnow().isoformat() + 'Z'
    return {
        'version': 1,
        'generatedAt': now,
        'status': 'ok',
        'summary': 'Server inference finished. This deployment uses a baseline placeholder report pipeline; plug in your model worker to replace this output.',
        'keyMetrics': {
            'processingMode': 'server',
            'privacyConsentRequired': True,
            'videoSizeBytes': int(video.size_bytes) if video is not None else 0,
        },
        'issues': [
            {
                'code': 'SERVER_PIPELINE_BASELINE',
                'severity': 'info',
                'message': 'Server task completed through baseline pipeline. Replace with model-backed inference for production scoring.',
                'atFrame': None,
            }
        ],
        'suggestions': [
            'Use local mode for strongest privacy guarantees.',
            'If server mode is required, keep data-retention short and audit access logs.',
        ],
        'task': {
            'id': task.id,
            'exerciseType': task.exercise_type,
            'viewAngle': task.view_angle,
        },
    }


def _purge_video_payload(video: VideoAsset) -> None:
    from flask import current_app

    upload_root = os.path.realpath(current_app.config['UPLOAD_FOLDER'])
    raw = video.storage_path or ''
    candidate = raw
    if not os.path.isabs(candidate):
        candidate = os.path.realpath(os.path.join(upload_root, candidate))
    else:
        candidate = os.path.realpath(candidate)
    if candidate.startswith(upload_root) and os.path.isfile(candidate):
        try:
            os.remove(candidate)
        except OSError:
            pass
    tombstone = f'deleted/{video.id}'
    video.storage_path = encrypt_text(tombstone) or tombstone
    video.size_bytes = 0
    video.duration_seconds = None


def process_one_server_inference_task(app: Flask) -> bool:
    with app.app_context():
        prefix = 'server_inference_requested_with_explicit_consent:'
        candidate = (
            AnalysisTask.query.filter(
                AnalysisTask.status == 'uploaded',
                AnalysisTask.instruction.isnot(None),
                AnalysisTask.instruction.like(f'{prefix}%'),
            )
            .order_by(AnalysisTask.created_at.asc(), AnalysisTask.id.asc())
            .first()
        )
        if candidate is None:
            return False

        started_at = datetime.utcnow()
        claimed = (
            AnalysisTask.query.filter_by(id=candidate.id, status='uploaded')
            .update(
                {
                    AnalysisTask.status: 'running',
                    AnalysisTask.started_at: candidate.started_at or started_at,
                },
                synchronize_session=False,
            )
        )
        if claimed != 1:
            db.session.rollback()
            return False
        db.session.commit()

        task = db.session.get(AnalysisTask, candidate.id)
        if task is None:
            return False
        video = VideoAsset.query.filter_by(id=task.video_asset_id, user_id=task.user_id).first()
        try:
            report = _build_fallback_server_report(task, video)
            result = AnalysisResult(task_id=task.id, report_json=protect_json_payload(report) or report)
            db.session.add(result)
            task.status = 'succeeded'
            task.finished_at = datetime.utcnow()
            task.error_message = None
            if video is not None:
                _purge_video_payload(video)
            db.session.commit()
            return True
        except Exception as exc:
            task.status = 'failed'
            task.finished_at = datetime.utcnow()
            task.error_message = f'server_worker_error:{type(exc).__name__}'
            if video is not None:
                _purge_video_payload(video)
            db.session.commit()
            return True


def _worker_loop(app: Flask, interval_seconds: float) -> None:
    while True:
        processed = process_one_server_inference_task(app)
        if processed:
            time.sleep(0.2)
        else:
            time.sleep(interval_seconds)


def start_server_inference_worker(app: Flask) -> None:
    global _WORKER_STARTED
    with _WORKER_LOCK:
        if _WORKER_STARTED:
            return
        if not bool(app.config.get('POSE_SERVER_INFERENCE_ENABLED', False)):
            return
        interval = float(app.config.get('POSE_SERVER_INFERENCE_POLL_INTERVAL_SECONDS', 2.0))
        t = threading.Thread(target=_worker_loop, args=(app, max(0.5, interval)), daemon=True, name='pose-server-inference-worker')
        t.start()
        _WORKER_STARTED = True
