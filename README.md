# AI-FIT

AI-FIT 是一个前后端分离的个人健身与健康管理应用。项目以浏览器端姿态分析为核心，同时整合了食品记录、课程学习和健身社区功能。

## 功能概览

- **账号与个人资料**
  - 注册、登录、退出登录
  - 邮箱验证和密码重置
  - 个人资料、头像和账号删除
- **Pose 训练**
  - 深蹲、俯卧撑、侧平举、俯身划船
  - 浏览器端摄像头/视频分析
  - 动作质量、节奏和训练报告
  - 训练历史和报告查看
- **食品与营养**
  - 食品目录和关键词搜索
  - 早餐、午餐、晚餐和加餐记录
  - 热量、蛋白质、脂肪和碳水统计
  - 图片上传识别食品（配置 StepFun 服务后启用）
  - 食品卡片使用项目内本地图片资源
- **课程**
  - 课程列表和详情
  - 免费/付费课程标记
  - 课程报名
  - 课程评论和点赞
  - 课程封面优先使用数据库图片，没有图片时使用本地默认图
- **社区与管理**
  - 博客发布、编辑、评论和点赞
  - 标签和通知
  - 管理员用户、博客和系统概览

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router |
| 姿态分析 | TensorFlow.js、MediaPipe Tasks Vision |
| 后端 | Flask、SQLAlchemy、Flask-Migrate |
| 数据库 | PostgreSQL 16（生产/容器开发）、SQLite（本地快速开发） |
| 缓存与限流 | Redis 7（可选） |
| 认证 | JWT + HttpOnly Cookie + CSRF 防护 |
| 文件处理 | Pillow、实例目录上传存储 |

## 项目结构

```text
AI-FIT/
├─ backend/
│  ├─ app/
│  │  ├─ routes/          # 认证、用户、Pose、食品、课程、博客和管理 API
│  │  ├─ services/        # 食品目录、识别和业务服务
│  │  ├─ models.py        # SQLAlchemy 数据模型
│  │  └─ config.py        # 配置读取
│  ├─ migrations/         # Alembic/Flask-Migrate 迁移
│  ├─ tests/              # 后端测试
│  ├─ instance/           # 本地数据库和上传文件
│  ├─ .env.example
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ pages/           # 页面和路由页面
│  │  ├─ components/      # 公共组件
│  │  ├─ lib/             # API 客户端和业务类型
│  │  └─ state/           # 登录态等全局状态
│  ├─ public/assets/      # 图片、字体、Pose 模型和训练视频
│  ├─ .env.example
│  └─ package.json
├─ scripts/
│  └─ dev.ps1             # Windows 本地开发启动脚本
├─ docker-compose.yml
└─ README.md
```

## 环境要求

Windows 开发环境建议安装：

- Python 3.11 或更高版本
- Node.js 18 或更高版本
- npm
- Docker Desktop（使用 PostgreSQL/Redis 时需要）

浏览器端 Pose 功能需要支持摄像头访问和 WebGL 的现代浏览器。通过非 `localhost` 的地址访问摄像头时，还需要 HTTPS。

## 快速启动

### 方式一：SQLite 本地开发（最简单）

不依赖 PostgreSQL 和 Redis，适合快速运行和功能调试：

```powershell
cd C:\AI_Fit\Ai_Fit_Guard\AI-FIT
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -UseSqlite
```

脚本会自动：

1. 创建或复用 `backend/.venv`
2. 安装后端依赖
3. 使用 `backend/instance/aifitguard_dev.db`
4. 根据当前模型自动创建开发表
5. 在新 PowerShell 窗口启动 Flask 后端和 Vite 前端

### 方式二：Docker PostgreSQL + Redis

先确保 Docker Desktop 正在运行，然后执行：

```powershell
cd C:\AI_Fit\Ai_Fit_Guard\AI-FIT
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

脚本会启动 `db` 和 `redis` 容器，并在健康检查通过后启动本地 Flask/Vite 服务。开发模式默认使用：

```text
DB_AUTO_INIT=1
EMAIL_VERIFY_REQUIRED=0
```

开发模式会通过当前 SQLAlchemy 模型创建缺失的开发表结构，不会自动执行完整历史迁移链。不要把该模式作为生产部署方式。

### 启动单个服务

```powershell
# 只启动后端
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -BackendOnly -UseSqlite

# 只启动前端
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -FrontendOnly
```

脚本还支持以下选项：

```text
-SkipDb      不启动 Docker 数据库，使用已有数据库服务
-ResetDb     删除 Docker Compose 数据卷后重新创建数据库（会删除本地数据）
-UseSqlite   使用 SQLite 开发数据库
-BackendOnly 只启动后端
-FrontendOnly 只启动前端
```

只有在明确希望清空 Docker 数据时才使用 `-ResetDb`。

## 访问地址

启动成功后：

| 服务 | 地址 |
| --- | --- |
| 前端 | http://127.0.0.1:5173/ |
| 后端健康检查 | http://127.0.0.1:5000/api/health |
| Pose 工具 | http://127.0.0.1:5173/tools/pose |
| 食品模块 | http://127.0.0.1:5173/food |
| 课程模块 | http://127.0.0.1:5173/courses |
| 博客社区 | http://127.0.0.1:5173/blogs |

食品和课程页面需要登录。未登录访问时会跳转到登录页。

## 手动安装与启动

### 后端

```powershell
cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
.\.venv\Scripts\python.exe .\run.py
```

### 前端

```powershell
cd .\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
npm.cmd install
npm.cmd run dev
```

前端默认通过 `VITE_API_BASE` 访问后端。开发环境模板中的默认值是：

```text
VITE_API_BASE=http://127.0.0.1:5000
```

## 配置

后端配置模板：

- `backend/.env.example`：本地开发配置
- `backend/.env.production.example`：生产配置参考

前端配置模板：

- `frontend/.env.example`

至少应关注以下变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 或 SQLite 连接地址 |
| `SECRET_KEY` | Flask 会话和安全功能密钥 |
| `JWT_SECRET_KEY` | JWT 签名密钥 |
| `DATA_ENCRYPTION_KEY` | 私密用户数据加密密钥 |
| `CORS_ORIGINS` | 允许访问后端的前端来源 |
| `REDIS_URL` | Redis 地址；不使用时可留空 |
| `EMAIL_VERIFY_REQUIRED` | 是否强制邮箱验证 |
| `SMTP_*` | 邮件发送配置 |
| `STEPFUN_API_URL`、`STEPFUN_API_KEY`、`STEPFUN_MODEL` | 图片食品识别服务 |
| `AI_REPORT_API_URL`、`AI_REPORT_API_KEY`、`AI_REPORT_MODEL` | 可选训练报告服务 |

不要把真实密钥、数据库密码或生产 `.env` 文件提交到版本库。生产环境必须使用长度足够且随机的密钥，并关闭调试回传链接。

## API 模块

后端 API 统一使用 `/api` 前缀，主要模块如下：

```text
/api/health                         健康检查
/api/auth/register                  注册
/api/auth/login                     登录
/api/auth/me                        当前用户
/api/user/profile                   个人资料
/api/pose/policy                    Pose 分析策略
/api/pose/trainings                 训练记录
/api/foods                          食品目录
/api/food/meta                      食品元数据
/api/meals                          餐食记录、今日汇总和历史
/api/recognize                      图片食品识别
/api/courses                        课程列表和详情
/api/courses/<id>/enroll            课程报名
/api/courses/<id>/comments          课程评论
/api/blogs                          博客列表、详情和发布
/api/admin                          管理员接口
```

食品和课程图片的默认资源位于 `frontend/public/assets/images/`。数据库中存在有效的课程封面 URL 时，前端优先使用数据库图片；为空时使用本地默认图片。

## 数据库迁移

### 生产或正式部署

正式环境不要依赖 `DB_AUTO_INIT=1`。设置好生产环境变量后执行：

```powershell
cd .\backend
.\.venv\Scripts\flask.exe --app wsgi db upgrade
```

创建新迁移：

```powershell
cd .\backend
.\.venv\Scripts\flask.exe --app wsgi db migrate -m "describe change"
```

检查迁移头：

```powershell
.\.venv\Scripts\flask.exe --app wsgi db heads
```

当前项目包含食品和课程模块迁移。已有旧项目数据库如果处于混合 schema 状态，不要直接删除数据卷；应先备份数据库，再检查迁移状态和表结构。

## 测试与质量检查

### 后端测试

```powershell
cd .\backend
.\.venv\Scripts\pytest.exe -q
```

### 前端类型检查

```powershell
cd .\frontend
npm.cmd run typecheck
```

### 前端生产构建

```powershell
cd .\frontend
npm.cmd run build
```

### 前端边界检查

```powershell
cd .\frontend
npm.cmd run lint:boundaries
```

建议在修改认证、食品、课程或数据库模型后，至少运行对应的后端测试和前端 `typecheck`。

## Docker 部署

完整容器编排包含：

- `db`：PostgreSQL 16
- `redis`：Redis 7
- `backend`：Flask/Gunicorn 后端
- `web`：Nginx 前端静态服务

启动完整服务：

```powershell
docker compose up -d --build
```

查看服务状态：

```powershell
docker compose ps
```

查看日志：

```powershell
docker compose logs -f backend
docker compose logs -f web
```

完整容器部署前请确认 `backend/.env` 已配置生产数据库、密钥、CORS、Redis 和邮件参数，并在发布流程中显式执行数据库迁移。

## 常见问题

### Docker 无法启动

确认 Docker Desktop 已启动：

```powershell
docker info
docker compose version
```

如果只是想本地调试，可以改用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -UseSqlite
```

### 端口被占用

- 后端默认端口：`5000`
- 前端默认端口：`5173`

开发脚本会尝试停止占用 `5000` 的 Python 后端进程；如果端口被其他程序占用，需要手动停止该程序或调整启动配置。

### 页面能打开但食品/课程没有内容

1. 确认后端健康检查返回 `200`。
2. 确认已经登录。
3. 检查浏览器开发者工具中的 `/api/foods` 或 `/api/courses` 请求。
4. 确认当前数据库已经创建食品和课程表。

开发模式下食品目录会在首次访问时自动初始化基础食品数据。

### 图片食品识别不可用

食品目录和手动餐食记录不依赖外部 AI 服务。只有 `/api/recognize` 图片识别需要配置 StepFun：

```text
STEPFUN_API_URL=
STEPFUN_API_KEY=
STEPFUN_MODEL=step-1v-8k
```

未配置时仍可以正常搜索食品、选择食品并保存餐食。

## 安全说明

- 生产环境不要使用 `.env.example` 中的默认密钥。
- 生产环境设置 `DB_AUTO_INIT=0`，通过迁移管理 schema。
- 生产环境关闭密码重置和邮箱验证的 debug 回传链接。
- 使用 HTTPS 保护登录态、摄像头权限和上传接口。
- 不要提交 `.env`、数据库文件、上传文件或包含密钥的日志。
- 变更用户隐私字段时，同时检查加密、哈希、迁移和日志输出。

## 开发约定

- 前端业务页面放在 `frontend/src/pages/`，公共逻辑放在 `frontend/src/lib/` 或 `frontend/src/components/`。
- 后端路由放在 `backend/app/routes/`，跨路由业务逻辑放在 `backend/app/services/`。
- 数据模型修改必须同步添加迁移和测试。
- 不要在前端提交真实密钥，也不要把用户私密字段写入普通日志。
- 新功能完成后运行对应测试、类型检查和构建。
