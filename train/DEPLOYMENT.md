# 部署说明

## 前置条件
- Node.js 20+
- npm
- SQLite（默认使用 SQLite 文件数据库）

## 环境变量清单（不包含任何密钥内容）
- DATABASE_URL（必填）：Prisma 数据库连接串（SQLite 示例：`file:./dev.db` 或 `file:/abs/path/app.db`）
- UPLOADS_DIR（可选）：上传文件存储根目录；默认 `./uploads`
- PORT（可选）：服务监听端口；默认 Next.js 的 `3000`
- NODE_ENV（可选）：生产环境建议设置为 `production`（会启用 Secure Cookie）

## 部署步骤（生产环境推荐）
1. 安装依赖

```bash
npm ci
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 应用数据库迁移

```bash
npx prisma migrate deploy
```

4. 构建并启动

```bash
npm run build
npm run start
```

## 运行注意事项
- 反向代理场景下需正确透传 `Host` 与 `X-Forwarded-For`，否则速率限制与 Origin 校验可能失效或误判。
- `UPLOADS_DIR` 对应目录需要可写权限；若启用容器化部署，建议将其挂载为持久化卷。
