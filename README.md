# AI-FIT

AI-FIT 是一个前后端分离的健身与营养应用。

- 前端：React + TypeScript + Vite
- 后端：Flask + SQLAlchemy
- 数据库：PostgreSQL
- 可选组件：Redis（分布式限流）、AI 服务集成

## 1. 你的问题（直接回答）

本地调试仍然可以使用这条命令：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

当前脚本路径：

- `scripts/dev.ps1`

## 2. 项目目录说明

- `frontend/`：前端 UI、浏览器端姿态推理、交互逻辑
- `backend/`：鉴权、策略下发、数据持久化、可选服务端推理队列
- `scripts/`：本地开发脚本
- `backend/doc/`：后端架构/配置/安全/运维文档
- `frontend/doc/`：前端架构治理与重构追踪文档

## 3. 本地开发（推荐）

### 3.1 前置依赖

- Python 3.10+
- Node.js 18+
- Docker Desktop（推荐用于本地 PostgreSQL/Redis）

### 3.2 一键启动

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

该脚本通常会：

- 准备后端虚拟环境并安装依赖
- 安装前端依赖
- 启动本地基础服务（如 Docker 中的数据库）
- 启动前后端开发服务

### 3.3 手动启动（需要时）

1. 启动数据库（和 Redis）：

```powershell
docker compose up -d db redis
```

2. 启动后端：

```powershell
cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

3. 启动前端：

```powershell
cd .\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
npm.cmd install
npm.cmd run dev
```

## 4. 本地访问地址

- 前端：`http://localhost:5173`
- 后端健康检查：`http://127.0.0.1:5000/api/health`

## 5. 配置说明

### 5.1 后端环境变量

参考：

- 本地模板：`backend/.env.example`
- 生产模板：`backend/.env.production.example`

关键项：

- `APP_ENV`（`development` / `production`）
- `DB_AUTO_INIT`
- `SECRET_KEY`、`JWT_SECRET_KEY`
- `DATABASE_URL`
- `CORS_ORIGINS`
- `ADMIN_EMAIL`
- `REDIS_URL`

### 5.2 前端环境变量

参考 `frontend/.env.example`，重点：

- `VITE_API_BASE`

## 6. 数据库迁移流程（生产级）

当前已采用迁移优先流程。  
生产环境不要依赖运行时自动建表。

常用命令：

```powershell
cd .\backend
.\.venv\Scripts\flask.exe --app run.py db migrate -m "描述本次变更"
.\.venv\Scripts\flask.exe --app run.py db upgrade
```

迁移目录：

- `backend/migrations/`

## 7. 生产部署要点

- 必须使用强密钥，不能用默认值
- 保持 `PASSWORD_RESET_DEBUG_RETURN_LINK=0`
- 必须显式配置 `CORS_ORIGINS`
- 必须配置 `REDIS_URL`（分布式限流）
- 每次发布后端前先执行 `db upgrade`

完整部署指引见：

- `DEPLOYMENT_SERVER_GUIDE_2026-05-02.md`

## 8. 质量检查

前端类型检查：

```powershell
cd .\frontend
npm.cmd run typecheck
```

后端测试：

```powershell
cd .\backend
.\.venv\Scripts\pytest.exe -q
```

