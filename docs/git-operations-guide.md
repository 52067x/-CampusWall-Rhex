# Git 与 GitHub 操作指南

本文档记录本项目在本机上传 GitHub、日常提交、部署检查时常用的 Git 操作。

## 当前仓库状态

- 本地分支：`main`
- 当前远程：`origin -> https://github.com/52067x/-CampusWall-Rhex.git`
- 初始提交：`a296ecb Initial commit`
- 提交用户名：`52067x`
- 提交邮箱：`52067x@gmail.com`

## 首次上传到 GitHub

如果 GitHub 上还没有仓库，先在 GitHub 创建一个空仓库，仓库名建议使用：

```bash
-CampusWall-Rhex
```

不要勾选自动创建 `README`、`.gitignore` 或 `LICENSE`，因为本地仓库已经有这些文件。

创建后确认远程地址：

```bash
git remote -v
```

如果地址不对，替换为自己的仓库地址：

```bash
git remote set-url origin https://github.com/52067x/-CampusWall-Rhex.git
```

推送本地 `main` 分支：

```bash
git push -u origin main
```

## GitHub 登录

本机使用 Git Credential Manager 管理 GitHub 登录状态。

查看已登录账号：

```bash
git credential-manager github list
```

登录 GitHub：

```bash
git credential-manager github login
```

命令可能会打开浏览器或弹出登录窗口。登录完成后再执行：

```bash
git push -u origin main
```

如果需要退出某个账号：

```bash
git credential-manager github logout <account>
```

## 日常提交流程

查看当前改动：

```bash
git status
```

查看具体差异：

```bash
git diff
```

暂存全部改动：

```bash
git add -A
```

创建提交：

```bash
git commit -m "描述本次修改"
```

推送到 GitHub：

```bash
git push
```

## 拉取远程更新

```bash
git pull
```

如果多人协作，建议在改代码前先拉取：

```bash
git pull --rebase
```

## 部署前检查

本项目使用 `pnpm`。在 Windows PowerShell 中如果 `pnpm` 或 `npm` 被执行策略阻止，可以使用 `corepack pnpm`。

安装依赖：

```bash
corepack pnpm install --frozen-lockfile
```

生成 Prisma Client：

```bash
corepack pnpm run prisma:generate
```

生产构建：

```bash
corepack pnpm run build
```

代码检查：

```bash
corepack pnpm run lint
```

当前项目没有 `test/*.test.ts` 测试文件，因此 `pnpm test` 暂时没有可执行测试集。

## 常见问题

### Repository not found

常见原因：

- GitHub 上还没有创建对应仓库
- 当前账号没有仓库权限
- 远程地址写错
- 本机 GitHub 登录状态缺失或登录了错误账号

排查：

```bash
git remote -v
git credential-manager github list
```

### PowerShell 禁止运行 npm.ps1

可以直接使用：

```bash
npm.cmd --version
corepack pnpm --version
```

项目命令优先使用：

```bash
corepack pnpm <command>
```

### Docker 构建上下文过大

本项目已添加 `.dockerignore`，会排除：

- `.git`
- `.next`
- `node_modules`
- `.pnpm-store`
- `.env`
- `uploads`
- `backups`
- 插件运行时目录

这可以避免把本机依赖或敏感环境文件打进 Docker 构建上下文。

### Windows ARM64 Prisma 引擎提示不兼容

当前本机可能出现 Prisma Windows 原生引擎兼容提示。Docker Linux 部署会在 Linux 镜像内重新安装依赖并生成 Prisma Client，通常不受本机 Windows ARM64 引擎影响。

## 推荐的服务器部署方式

项目 README 推荐两种方式：

- Docker Compose：需要 Docker Engine / Docker Desktop / Docker Compose Plugin
- 源码部署：需要 Node.js 20+、PostgreSQL 16+、Redis 6+、pnpm

Docker Compose 启动：

```bash
cp .env.example .env
docker compose up -d
```

源码部署：

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
corepack pnpm run setup
corepack pnpm run build
corepack pnpm run start
```

后台 worker 需要单独启动：

```bash
corepack pnpm run worker
```
