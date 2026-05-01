#Requires -Version 5.1
<#
.SYNOPSIS
    Run on an INTERNET-CONNECTED Windows machine (PowerShell 5.1) to populate
    the vendor/ folder with every PowerShell module and the pac CLI binary that
    the migration toolkit needs.  After this finishes, zip the entire
    tools/migration/ folder (including vendor/) and ship it to the air-gapped
    target machine.

.NOTES
    Total download is roughly 50–80 MB depending on Microsoft.Graph version.
#>
[CmdletBinding()]
param(
    [string] $VendorDir       = (Join-Path $PSScriptRoot ''),
    [string] $PacVersion      = '1.40.4',     # pin a known-good version; bump as needed
    [switch] $SkipPac,
    [switch] $SkipModules
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

$modulesDir = Join-Path $VendorDir 'modules'
$pacDir     = Join-Path $VendorDir 'pac'
New-Item -ItemType Directory -Force -Path $modulesDir | Out-Null
New-Item -ItemType Directory -Force -Path $pacDir     | Out-Null

# ---- Modules ----
$modules = @(
    @{ Name = 'CredentialManager';                              Required = $true  },
    @{ Name = 'MSAL.PS';                                        Required = $true  },
    @{ Name = 'Microsoft.PowerShell.SecretManagement';          Required = $false },
    @{ Name = 'Microsoft.PowerApps.Administration.PowerShell';  Required = $false },
    @{ Name = 'Microsoft.Graph.Authentication';                 Required = $false },
    @{ Name = 'Microsoft.Graph.Applications';                   Required = $false },
    @{ Name = 'Microsoft.Graph.Identity.SignIns';               Required = $false }
)

if (-not $SkipModules) {
    # Make sure NuGet provider + PSGallery trust are set so Save-Module works non-interactively
    if (-not (Get-PackageProvider -ListAvailable -Name NuGet -ErrorAction SilentlyContinue)) {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
    }
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue

    foreach ($m in $modules) {
        $name = $m.Name
        try {
            Write-Host "Saving $name ..." -ForegroundColor Cyan
            Save-Module -Name $name -Path $modulesDir -Force -AcceptLicense -ErrorAction Stop
            Write-Host "  OK"
        } catch {
            $msg = "Failed to save $name : $($_.Exception.Message)"
            if ($m.Required) { throw $msg } else { Write-Warning $msg }
        }
    }
}

# ---- pac CLI ----
if (-not $SkipPac) {
    Write-Host "Downloading pac CLI $PacVersion ..." -ForegroundColor Cyan
    # The Microsoft.PowerApps.CLI nupkg is a standalone (no install) package.
    $nupkgUrl = "https://www.nuget.org/api/v2/package/Microsoft.PowerApps.CLI/$PacVersion"
    $nupkgPath = Join-Path $pacDir "Microsoft.PowerApps.CLI.$PacVersion.nupkg"
    Invoke-WebRequest -Uri $nupkgUrl -OutFile $nupkgPath -UseBasicParsing

    # nupkg is just a zip; extract.
    $extractDir = Join-Path $pacDir "Microsoft.PowerApps.CLI.$PacVersion"
    if (Test-Path $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($nupkgPath, $extractDir)

    # The Windows binaries land under tools\pac\
    $pacExe = Join-Path $extractDir 'tools\pac\pac.exe'
    if (-not (Test-Path $pacExe)) {
        # Some package layouts use tools\
        $pacExe = Get-ChildItem -Path $extractDir -Filter 'pac.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pacExe) { $pacExe = $pacExe.FullName }
    }
    if (-not $pacExe -or -not (Test-Path $pacExe)) {
        Write-Warning "Could not locate pac.exe under $extractDir. You may need to download a different package layout (Microsoft.PowerApps.CLI.MSI) and extract manually."
    } else {
        # Stage a stable path: vendor/pac/pac.exe
        $stable = Join-Path $pacDir 'pac.exe'
        Copy-Item -LiteralPath $pacExe -Destination $stable -Force

        # Copy the entire bin folder alongside (pac.exe needs its DLLs)
        $pacBinDir = Split-Path -Parent $pacExe
        Get-ChildItem -Path $pacBinDir -File | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $pacDir -Force
        }
        Write-Host "pac.exe staged at $stable" -ForegroundColor Green
    }
}

# Manifest
$manifest = @{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    pacVersion   = $PacVersion
    modules      = (Get-ChildItem $modulesDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                        @{ name = $_.Name; versions = (Get-ChildItem $_.FullName -Directory | ForEach-Object { $_.Name }) }
                    })
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $VendorDir 'manifest.json') -Encoding utf8

Write-Host ""
Write-Host "vendor/ ready. Now zip the entire tools/migration/ folder and ship it to the target machine." -ForegroundColor Green
Write-Host "Manifest: $(Join-Path $VendorDir 'manifest.json')"
