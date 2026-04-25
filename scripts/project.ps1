param(
  [Parameter(Position = 0)]
  [ValidateSet("setup", "dev", "build", "seed", "deploy", "restart", "logs", "clean", "clean-volumes", "ps", "health")]
  [string] $Command = "setup"
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string] $File,
    [string[]] $Arguments
  )

  Write-Host "> $File $($Arguments -join ' ')"
  & $File @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $File $($Arguments -join ' ')"
  }
}

function Invoke-Compose {
  param([string[]] $Arguments)
  Invoke-Step "docker" (@("compose") + $Arguments)
}

function Invoke-DevCompose {
  param([string[]] $Arguments)
  Invoke-Step "docker" (@("compose", "-f", "docker-compose.yml", "-f", "docker-compose.dev.yml") + $Arguments)
}

function Ensure-EnvFile {
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "created .env from .env.example"
  }
}

function Sync-Database {
  Invoke-Compose @("run", "--rm", "db-sync")
}

function Seed-Database {
  Invoke-Compose @("run", "--rm", "db-seed")
}

switch ($Command) {
  "setup" {
    Ensure-EnvFile
    Invoke-Compose @("build")
    Invoke-Compose @("up", "-d", "postgres", "redis", "minio")
    Sync-Database
    Seed-Database
    Invoke-Compose @("up", "-d", "api", "web", "worker")
    Invoke-Compose @("ps")
  }
  "dev" {
    Ensure-EnvFile
    Invoke-DevCompose @("build")
    Invoke-DevCompose @("run", "--rm", "api", "pnpm", "install", "--frozen-lockfile", "--prefer-offline")
    Invoke-DevCompose @("run", "--rm", "api", "pnpm", "--filter", "@offergo/db", "db:generate")
    Invoke-DevCompose @("run", "--rm", "api", "pnpm", "--filter", "@offergo/db", "exec", "prisma", "db", "push", "--skip-generate")
    Invoke-DevCompose @("run", "--rm", "api", "pnpm", "--filter", "@offergo/db", "db:seed")
    Invoke-DevCompose @("up")
  }
  "build" {
    Invoke-Compose @("build")
  }
  "seed" {
    Ensure-EnvFile
    Seed-Database
  }
  "deploy" {
    if (Test-Path ".git") {
      Invoke-Step "git" @("pull", "--ff-only")
    }

    Invoke-Compose @("build")
    Invoke-Compose @("up", "-d", "postgres", "redis", "minio")
    Sync-Database
    Invoke-Compose @("up", "-d", "api", "web", "worker")
    Invoke-Compose @("ps")
  }
  "restart" {
    Invoke-Compose @("up", "-d", "api", "web", "worker")
    Invoke-Compose @("ps")
  }
  "logs" {
    Invoke-Compose @("logs", "-f", "--tail=200")
  }
  "clean" {
    Invoke-Compose @("down", "--remove-orphans")
    Invoke-DevCompose @("down", "--remove-orphans")
  }
  "clean-volumes" {
    Invoke-Compose @("down", "--remove-orphans", "--volumes")
    Invoke-DevCompose @("down", "--remove-orphans", "--volumes")
  }
  "ps" {
    Invoke-Compose @("ps")
  }
  "health" {
    Invoke-Compose @("ps")
    Invoke-Compose @("exec", "-T", "api", "node", "-e", "fetch('http://127.0.0.1:3001/api/v1/health').then(async (r)=>{ console.log(await r.text()); process.exit(r.ok?0:1) }).catch((e)=>{ console.error(e); process.exit(1) })")
  }
}
