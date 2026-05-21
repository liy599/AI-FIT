# AI-FIT

AI-FIT 是一个前后端分离的健身应用，当前核心功能包括账号体系、个人资料、训练记录、博客社区、后台管理和浏览器端姿态训练工具。

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Flask + SQLAlchemy + Alembic
- 数据库：PostgreSQL
- 可选组件：Redis，用于分布式限流等生产能力

## 目录结构

- `frontend/`：前端页面、组件、业务模块、浏览器端交互逻辑
- `backend/`：后端 API、认证授权、数据持久化、迁移和测试
- `scripts/`：本地开发脚本
- `info/`：需求、审查、治理和阶段性文档
- `backend/doc/`：后端架构、配置、安全和运维文档
- `frontend/doc/`：前端架构治理和重构记录

## 本地开发

推荐在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

该脚本会准备后端虚拟环境、安装前端依赖，并启动本地开发服务。

也可以手动启动：

```powershell
docker compose up -d db redis

cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py

cd ..\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
npm.cmd install
npm.cmd run dev
```

## 常用地址

- 前端：`http://localhost:5173`
- 后端健康检查：`http://127.0.0.1:5000/api/health`

## 配置

后端配置模板：

- `backend/.env.example`
- `backend/.env.production.example`

前端配置模板：

- `frontend/.env.example`

生产环境需要显式配置强密钥、`DATABASE_URL`、`CORS_ORIGINS`、`REDIS_URL` 和邮件相关配置。发布前应执行数据库迁移，不依赖运行时自动建表。

## 数据库迁移

```powershell
cd .\backend
.\.venv\Scripts\flask.exe --app run.py db upgrade
```

新增迁移时：

```powershell
cd .\backend
.\.venv\Scripts\flask.exe --app run.py db migrate -m "describe change"
```

## 质量检查

前端类型检查：

```powershell
cd .\frontend
npm.cmd run typecheck
```

前端边界检查：

```powershell
cd .\frontend
npm.cmd run lint:boundaries
```

后端测试：

```powershell
cd .\backend
.\.venv\Scripts\pytest.exe -q
```
