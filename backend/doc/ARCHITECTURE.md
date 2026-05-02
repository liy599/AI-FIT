# Backend Architecture

## 1. Responsibility Boundary
- Frontend (`frontend`): UI rendering, local MoveNet inference, interaction orchestration, and consent UX.
- Backend (`backend`): identity/auth, persistence, policy/config distribution, optional server inference queue, and audit-safe data lifecycle.

## 2. Core Modules
- `app/routes/auth.py`: login/register/forgot/reset and token flows.
- `app/routes/pose.py`: pose domain API (videos/tasks/reports/training/policy/capabilities).
- `app/routes/feedback.py`: feedback ingestion and admin-side listing.
- `app/services/pose/*`: AI report generation and server worker pipeline.
- `app/models.py`: domain entities (`VideoAsset`, `AnalysisTask`, `AnalysisResult`, `TrainingSession`, `TrainingSet`, ...).
- `app/utils/*`: cross-cutting concerns (privacy masking/encryption, pagination, rate limiting, upload token).

## 3. Privacy-First Execution Model
- Default path is local inference in browser; raw camera stream stays client-side.
- Optional server inference requires explicit consent and is feature-flagged by `POSE_SERVER_INFERENCE_ENABLED`.
- Uploaded pose assets are user-scoped and can be canceled/purged.

## 4. Industrialization Decisions
- Policy values (fps/limits/allowed actions) are backend-configurable and exposed via `GET /api/pose/policy`.
- Capabilities are discoverable via `GET /api/pose/capabilities` for transparent UX.
- Worker claim path uses atomic status transition to avoid duplicate processing in multi-worker deployments.

## 5. Runtime Data Flow (Server Inference)
1. Client obtains consent from user and uploads video.
2. Backend creates `VideoAsset` + `AnalysisTask(status=uploaded)`.
3. Worker atomically claims task (`uploaded -> running`).
4. Worker performs analysis and writes `AnalysisResult`; task becomes `succeeded`/`failed`.
5. Client polls task endpoint and renders result.
