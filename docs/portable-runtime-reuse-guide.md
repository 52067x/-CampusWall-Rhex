# Portable PostgreSQL / Redis Reuse Guide

This machine already has a portable runtime under:

```powershell
C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime
```

It contains:

- PostgreSQL: `.runtime\postgresql-16.14\pgsql`
- PostgreSQL data: `.runtime\postgres-data`
- Redis: `.runtime\redis-8.8.0\Redis-8.8.0-Windows-x64-msys2`
- Redis data: `.runtime\redis-data`

You can reuse this runtime for multiple local projects. Do not copy the database data directory into every project unless you intentionally want separate database servers.

## 1. Shared Paths

Use these paths in PowerShell:

```powershell
$RuntimeHome = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime"
$PgBin = "$RuntimeHome\postgresql-16.14\pgsql\bin"
$PgData = "$RuntimeHome\postgres-data"
$RedisBin = "$RuntimeHome\redis-8.8.0\Redis-8.8.0-Windows-x64-msys2"
$RedisData = "$RuntimeHome\redis-data"
$LogDir = "$RuntimeHome\logs"
```

Optional: add PostgreSQL and Redis tools to your user PATH:

```powershell
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$addPaths = @(
  "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime\postgresql-16.14\pgsql\bin",
  "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime\redis-8.8.0\Redis-8.8.0-Windows-x64-msys2"
)
$nextPath = (@($currentPath -split ";") + $addPaths | Where-Object { $_ } | Select-Object -Unique) -join ";"
[Environment]::SetEnvironmentVariable("Path", $nextPath, "User")
```

Open a new terminal after changing PATH.

## 2. Start Shared Services

Start PostgreSQL:

```powershell
$RuntimeHome = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime"
$PgBin = "$RuntimeHome\postgresql-16.14\pgsql\bin"
$PgData = "$RuntimeHome\postgres-data"
$LogDir = "$RuntimeHome\logs"

& "$PgBin\pg_ctl.exe" start -D "$PgData" -l "$LogDir\postgres.log" -o '"-h" "127.0.0.1" "-p" "5432"'
```

Start Redis:

```powershell
$RuntimeHome = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime"
$RedisBin = "$RuntimeHome\redis-8.8.0\Redis-8.8.0-Windows-x64-msys2"
$RedisData = "$RuntimeHome\redis-data"
$LogDir = "$RuntimeHome\logs"

Start-Process -FilePath "$RedisBin\redis-server.exe" -ArgumentList @(
  "--port", "6379",
  "--bind", "127.0.0.1",
  "--dir", "$RedisData",
  "--logfile", "$LogDir\redis.log"
) -WindowStyle Hidden
```

Verify ports:

```powershell
netstat -ano | Select-String ':5432|:6379'
```

## 3. Stop Shared Services

Stop PostgreSQL:

```powershell
$RuntimeHome = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime"
& "$RuntimeHome\postgresql-16.14\pgsql\bin\pg_ctl.exe" stop -D "$RuntimeHome\postgres-data" -m fast
```

Stop Redis:

```powershell
$RuntimeHome = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime"
& "$RuntimeHome\redis-8.8.0\Redis-8.8.0-Windows-x64-msys2\redis-cli.exe" -h 127.0.0.1 -p 6379 shutdown
```

## 4. Per-Project Configuration

Each project should use its own PostgreSQL database name and Redis key prefix.

Example for this project:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/campuswall_rhex?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
REDIS_KEY_PREFIX="campuswall-rhex"
```

Example for another project:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/another_project?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
REDIS_KEY_PREFIX="another-project"
```

Avoid sharing the same `DATABASE_URL` database between different projects unless they are the same app and schema. Different projects can overwrite each other's tables.

## 5. Create A Database For A Project

After PostgreSQL is running:

```powershell
$PgBin = "C:\Users\26303\Downloads\Rhex-main\Rhex-main\.runtime\postgresql-16.14\pgsql\bin"
$env:PGPASSWORD = "postgres"
& "$PgBin\createdb.exe" -h 127.0.0.1 -p 5432 -U postgres campuswall_rhex
```

If it already exists, `createdb` will report an error. That is harmless if the database is already intended for this project.

## 6. Run A Project

In each project directory:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run doctor
corepack pnpm run setup
corepack pnpm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is occupied, Next.js may choose another port, or you can set:

```powershell
$env:PORT = "3001"
corepack pnpm run dev
```

## 7. Current Project Quick Start

The shared runtime has already been tested with this project:

```powershell
cd C:\Users\26303\Downloads\CampusWall-Rhex
corepack pnpm run doctor
corepack pnpm run setup
corepack pnpm run dev
```

Current expected service URLs:

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- Web app: `http://localhost:3000`

