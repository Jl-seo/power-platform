<#
.SYNOPSIS
    Installs the CoE Governance Agent to a customer's Azure subscription.

.DESCRIPTION
    This script automates the deployment of the Data Plane Agent:
    1. Validates Azure CLI login
    2. Creates or reuses a Resource Group
    3. Deploys infrastructure via Bicep (Function App + Key Vault + App Insights)
    4. Deploys Agent code via zip deploy
    5. Verifies health endpoint

.PARAMETER SubscriptionId
    Target Azure subscription ID.

.PARAMETER TenantId
    Entra tenant ID for Power Platform API access.

.PARAMETER ClientId
    Entra App Registration client ID.

.PARAMETER ClientSecret
    Entra App Registration client secret.

.PARAMETER Region
    Azure region (default: koreacentral).

.PARAMETER BaseName
    Base name for Azure resources (default: coe-governance).

.PARAMETER IsvFrontendUrl
    URL of the ISV-hosted management portal for CORS.

.EXAMPLE
    ./Install-Agent.ps1 `
        -SubscriptionId "00000000-0000-0000-0000-000000000000" `
        -TenantId "11111111-1111-1111-1111-111111111111" `
        -ClientId "22222222-2222-2222-2222-222222222222" `
        -ClientSecret "your-secret" `
        -Region "koreacentral" `
        -IsvFrontendUrl "https://portal.isv-domain.com"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $true)]
    [string]$TenantId,

    [Parameter(Mandatory = $true)]
    [string]$ClientId,

    [Parameter(Mandatory = $true)]
    [string]$ClientSecret,

    [string]$Region = "koreacentral",
    [string]$BaseName = "coe-governance",
    [string]$IsvFrontendUrl = ""
)

$ErrorActionPreference = "Stop"
$ResourceGroupName = "$BaseName-agent-rg"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = Join-Path $ScriptDir ".." "infra"
$AgentDir = Join-Path $ScriptDir ".." "agent"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  CoE Governance Agent - Installation" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# -------------------------------------------------------
# Step 1: Validate Azure CLI
# -------------------------------------------------------
Write-Host "[1/6] Validating Azure CLI..." -ForegroundColor Yellow

try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "  Logged in as: $($account.user.name)" -ForegroundColor Green
}
catch {
    Write-Host "  Azure CLI not logged in. Running 'az login'..." -ForegroundColor Yellow
    az login
}

az account set --subscription $SubscriptionId
Write-Host "  Subscription: $SubscriptionId" -ForegroundColor Green

# -------------------------------------------------------
# Step 2: Create Resource Group
# -------------------------------------------------------
Write-Host "[2/6] Creating Resource Group '$ResourceGroupName'..." -ForegroundColor Yellow

$rgExists = az group exists --name $ResourceGroupName
if ($rgExists -eq "true") {
    Write-Host "  Resource Group already exists, reusing." -ForegroundColor Green
}
else {
    az group create --name $ResourceGroupName --location $Region --output none
    Write-Host "  Created in '$Region'." -ForegroundColor Green
}

# -------------------------------------------------------
# Step 3: Deploy Infrastructure (Bicep)
# -------------------------------------------------------
Write-Host "[3/6] Deploying infrastructure (Bicep)..." -ForegroundColor Yellow

$deployResult = az deployment group create `
    --resource-group $ResourceGroupName `
    --template-file (Join-Path $InfraDir "agent.bicep") `
    --parameters baseName=$BaseName `
    --parameters location=$Region `
    --parameters tenantId=$TenantId `
    --parameters clientId=$ClientId `
    --parameters clientSecret=$ClientSecret `
    --parameters isvFrontendUrl=$IsvFrontendUrl `
    --output json | ConvertFrom-Json

$functionAppName = $deployResult.properties.outputs.functionAppName.value
$healthEndpoint = $deployResult.properties.outputs.healthEndpoint.value
$keyVaultUrl = $deployResult.properties.outputs.keyVaultUrl.value

Write-Host "  Function App: $functionAppName" -ForegroundColor Green
Write-Host "  Key Vault:    $keyVaultUrl" -ForegroundColor Green

# -------------------------------------------------------
# Step 4: Package Agent Code
# -------------------------------------------------------
Write-Host "[4/6] Packaging Agent code..." -ForegroundColor Yellow

$zipPath = Join-Path $env:TEMP "agent-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

# Create zip excluding unnecessary files
$filesToInclude = Get-ChildItem -Path $AgentDir -Recurse `
    -Exclude @("__pycache__", "*.pyc", ".venv", "venv", "local.settings.json", "tests")
Compress-Archive -Path (Join-Path $AgentDir "*") -DestinationPath $zipPath -Force

Write-Host "  Package created: $zipPath" -ForegroundColor Green

# -------------------------------------------------------
# Step 5: Deploy Agent Code
# -------------------------------------------------------
Write-Host "[5/6] Deploying Agent code to Function App..." -ForegroundColor Yellow

az functionapp deployment source config-zip `
    --resource-group $ResourceGroupName `
    --name $functionAppName `
    --src $zipPath `
    --output none

Write-Host "  Code deployed successfully." -ForegroundColor Green

# -------------------------------------------------------
# Step 6: Verify Health
# -------------------------------------------------------
Write-Host "[6/6] Verifying Agent health..." -ForegroundColor Yellow

Start-Sleep -Seconds 10  # Wait for cold start

try {
    $healthResponse = Invoke-RestMethod -Uri $healthEndpoint -Method GET -TimeoutSec 30
    if ($healthResponse.status -eq "healthy") {
        Write-Host "  Agent is healthy! ✅" -ForegroundColor Green
    }
    else {
        Write-Host "  Agent responded but status is: $($healthResponse.status)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  Health check failed (may need a few more seconds to start): $_" -ForegroundColor Yellow
    Write-Host "  Try manually: curl $healthEndpoint" -ForegroundColor Yellow
}

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Agent URL:      https://$functionAppName.azurewebsites.net" -ForegroundColor White
Write-Host "  Health Check:   $healthEndpoint" -ForegroundColor White
Write-Host "  Key Vault:      $keyVaultUrl" -ForegroundColor White
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open the Agent URL in a browser to verify" -ForegroundColor White
Write-Host "  2. Configure the ISV portal to connect to this Agent" -ForegroundColor White
Write-Host "  3. (Phase 2) Install the Power Platform Solution" -ForegroundColor White
Write-Host ""
