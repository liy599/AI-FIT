# 批量生成测试账号（部署环境可用）

本项目没有内置固定“测试账号”，推荐通过后端公开的注册接口批量创建。

## 完整引导：先清理旧账号，再生成新账号（推荐日常操作）

如果你想“推倒重来”，获取一批干净的测试账号，可以按以下两步操作：

### 第一步：清理所有已生成的测试账号

按特定规则（如 `qa` 前缀 + `example.com` 邮箱域名）强制删除数据库中的旧测试数据。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Prefix qa -EmailDomain example.com -Commit
```

> **说明**：这会删除所有形如 `qa+...@example.com` 的账号，并**级联删除**它们产生的训练记录、评论、饮食等测试数据。

### 第二步：生成一批新账号

在清理完毕后，立刻生成 10 个新的测试账号，并导出密码：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "http://127.0.0.1:5000" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666" -FailOnError
```

> **说明**：
> - `BaseUrl` 请替换为你的真实后端地址（如 `https://your-domain.com`），不要加反引号。
> - 生成结束后，会输出一个 `test-accounts-<timestamp>.csv`，直接用里面的 `email` 和 `password` 登录即可。

---

## 更多用法与常见问题

### 1. 动态随机密码生成

在仓库根目录执行（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com"
```

说明：
- 会自动生成随机密码（每个账号不同），并打印表格，同时写入 CSV 文件。
- `Prefix` 会用于构造账号：`<prefix>+<timestamp><index>@<domain>`。

### 2. 指定统一密码（可选）

如果你希望“所有测试账号同一个密码”，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666"
```

注意：
- `BaseUrl` 不要带 Markdown 反引号（不要写成 `` `https://...` ``），直接用纯 URL。
- 登录时使用 `email + password`（不是 username）。

### 3. 生成后立刻验证（可选）

脚本会对每个新账号做一次登录校验，并在 CSV 里写 `register_ok` 与 `login_ok`。如果你希望“只要有一个失败就退出”，加上 `-FailOnError`：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666" -FailOnError
```

### 4. 输出文件在哪里

脚本会输出类似：

- `Saved to: D:\...\test-accounts-1712345678.csv`

把这个 CSV 发给测试同学即可直接登录。

### 5. 其他报错排查

- 如果报 `409 email already exists`：说明同名账号已存在；改一下 `Prefix` 或等下一秒再运行即可。
- 如果你不想在控制台显示密码：把脚本输出改成只写 CSV（可以让我帮你加一个 `-Quiet` 参数）。

### 6. 清理的其他方式

推荐用“CSV 精确删除”（最安全）：

1) 找到你生成时输出的 CSV（例如 `test-accounts-1712345678.csv`）
2) 先 dry-run 看会删哪些：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Csv .\test-accounts-1712345678.csv
```

3) 确认无误后执行删除：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Csv .\test-accounts-1712345678.csv -Commit
```

也可以按规则删除（例如删掉 `qa+...@example.com`）：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Prefix qa -EmailDomain example.com -Commit
```
