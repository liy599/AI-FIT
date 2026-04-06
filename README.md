# AI-FIT

前后端分离的健身/营养 Web 应用：前端 React + Vite，后端 Flask + PostgreSQL。

## 先装这些（不会自动安装）

`dev.ps1`（现已移至 `scripts/`）会自动安装“项目依赖”（Python 包、前端 npm 包）并启动服务，但不会自动安装以下基础软件：
- Python（建议 3.10+）
- Node.js（建议 18+）
- Docker Desktop（必需，用于统一启动 PostgreSQL）

### Windows（推荐用 winget）
以管理员 PowerShell 执行：
```powershell
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Docker.DockerDesktop
```

安装完成后：
- 重启终端/IDE（确保 PATH 生效）
- 启动 Docker Desktop（必须处于 Running 状态）

验证：
```powershell
python --version
npm.cmd --version
docker --version
docker info
```

### 手动下载安装（任意系统）

- Python：到官网下载安装并勾选“Add Python to PATH”（Windows）
- Node.js：安装 LTS 版本
- Docker Desktop：安装后启动应用并完成首次初始化

## 无脑启动（推荐）

前提：安装 Python（建议 3.10+）、Node.js（建议 18+）以及 Docker Desktop（必需）。脚本会自动创建 Python 虚拟环境、安装后端依赖、安装前端依赖，并通过 Docker 启动 PostgreSQL，保证不同电脑环境一致。
在仓库根目录执行（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

说明：
- 首次运行：会创建 `backend/.venv`、安装后端依赖、安装前端依赖、拉起 PostgreSQL（Docker）并启动前后端。
- 之后每次启动：也可以继续运行同一条命令；脚本会复用已存在的虚拟环境与 `node_modules`，通常只会快速启动服务。
- 如需“纯启动”（不做依赖检查/安装）：可以分别开两个终端手动运行后端与前端（见下方“手动启动”）。

启动后：
- 前端：`http://localhost:5173`
- 后端健康检查：`http://127.0.0.1:5000/api/health`

## 手动启动

### 1) 启动数据库（PostgreSQL）
推荐用 Docker：
```powershell
docker compose up -d db
```

如不使用 Docker，也可以手动创建数据库，参考 [backend/db_init.sql](backend/db_init.sql)。但这样会引入“每台电脑环境不一致”的问题，不推荐。

### 2) 启动后端

```powershell
cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

### 3) 启动前端

```powershell
cd .\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue

npm.cmd install
npm.cmd run dev
```

## 配置说明

后端环境变量示例在 [backend/.env.example](backend/.env.example)：
- `DATABASE_URL`：默认 `postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard`
- `SECRET_KEY` / `JWT_SECRET_KEY`：本地可用示例值，部署时务必改成随机强密码
- `CORS_ORIGINS`：可选，逗号分隔；不填时默认允许 `http://localhost:5173` 与 `http://127.0.0.1:5173`

前端环境变量示例在 [frontend/.env.example](frontend/.env.example)：
- `VITE_API_BASE`：后端基地址（默认 `http://127.0.0.1:5000`）

## 快速冒烟验证

后端启动后，可以运行：
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo.ps1
```

会依次调用 health、注册、获取当前用户、提交反馈等接口。

## 批量生成测试账号
见 [info/ops/TEST_ACCOUNTS.md](info/ops/TEST_ACCOUNTS.md)。

## 常见问题

- Docker 相关报错（`failed to connect to the docker API ... dockerDesktopLinuxEngine`）：表示 Docker Desktop 未启动或 Docker daemon 不可用。启动 Docker Desktop 后重试；本项目的一键脚本要求 Docker 以保证环境一致。
- PowerShell 报 `npm.ps1` 执行策略限制：建议直接使用 `npm.cmd`（本仓库文档与脚本已默认使用），或自行调整当前用户执行策略。

## Dependency Note

When frontend dependencies change, run `npm.cmd install` inside [frontend/package.json](/d:/trae/trae_projects/AI-FIT/frontend/package.json) or rerun `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1`.

This matters for the Pose migration because the realtime page adds browser-side MoveNet / TensorFlow packages, and an existing `node_modules` directory does not guarantee those new packages are present.
