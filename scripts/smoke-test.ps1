param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$email = "smoke-$suffix@example.com"

Write-Host "检查服务健康状态..."
$health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
if (-not $health.success) { throw "健康检查失败" }

Write-Host "注册演示用户并取得 JWT..."
$registerBody = @{
    username = "smoke_$suffix"
    email = $email
    password = "password123"
} | ConvertTo-Json
$registered = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/users/register" -ContentType "application/json" -Body $registerBody
$headers = @{ Authorization = "Bearer $($registered.data.token)" }

Write-Host "创建知识点..."
$knowledgeBody = @{
    title = "冒烟测试知识点"
    content = "验证注册、JWT 与 CRUD 真实可用。"
} | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/knowledge-points" -Headers $headers -ContentType "application/json" -Body $knowledgeBody
$knowledgeId = $created.data.knowledgePoint._id

Write-Host "读取并更新知识点..."
$detail = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/knowledge-points/$knowledgeId" -Headers $headers
if ($detail.data.knowledgePoint.title -ne "冒烟测试知识点") { throw "详情内容不一致" }
$updateBody = @{ status = "mastered"; reviewList = $true } | ConvertTo-Json
$updated = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/api/knowledge-points/$knowledgeId" -Headers $headers -ContentType "application/json" -Body $updateBody
if ($updated.data.knowledgePoint.status -ne "mastered") { throw "更新结果不一致" }

Write-Host "删除知识点..."
Invoke-RestMethod -Method Delete -Uri "$BaseUrl/api/knowledge-points/$knowledgeId" -Headers $headers | Out-Null

Write-Host "冒烟测试通过：服务、数据库、JWT 与 CRUD 均正常。" -ForegroundColor Green
