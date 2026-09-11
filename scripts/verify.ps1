$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

Write-Host "[1/2] 安装锁定版本依赖..."
npm ci

Write-Host "[2/2] 执行格式、静态检查和自动测试..."
npm run verify

Write-Host "验收通过：前三课自动检查全部成功。" -ForegroundColor Green
