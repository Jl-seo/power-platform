#Requires -Version 5.1
<#
.SYNOPSIS
    Direct nupkg downloader. Bypasses PackageManagement / PowerShellGet entirely.
    Only requires Invoke-WebRequest reachability to powershellgallery.com and nuget.org
    (or to whichever proxy/CDN those redirect to).

    Use this when Save-Module fails because the NuGet provider cannot be installed
    (e.g. corporate networks that block go.microsoft.com).

.PARAMETER Proxy
    Optional HTTP proxy URL, e.g. http://proxy.corp:8080
.PARAMETER ProxyUseDefaultCredentials
    Use the current logged-in Windows credentials for the proxy (NTLM).
#>
[CmdletBinding()]
param(
    [string] $VendorDir = $PSScriptRoot,
    [string] $PacVersion = '1.40.4',
    [string] $Proxy,
    [switch] $ProxyUseDefaultCredentials,
    [switch] $SkipPac,
    [switch] $SkipModules
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

# Build common Invoke-WebRequest args (proxy aware)
$iwrCommon = @{ UseBasicParsing = $true; TimeoutSec = 120 }
if ($Proxy) {
    $iwrCommon.Proxy = $Proxy
    if ($ProxyUseDefaultCredentials) { $iwrCommon.ProxyUseDefaultCredentials = $true }
    Write-Host "Using proxy: $Proxy" -ForegroundColor DarkGray
}

$modulesDir = Join-Path $VendorDir 'modules'
$pacDir     = Join-Path $VendorDir 'pac'
$tmpDir     = Join-Path $VendorDir '_tmp'
New-Item -ItemType Directory -Force -Path $modulesDir,$pacDir,$tmpDir | Out-Null

# Pinned, known-good versions. Override one off by editing here or with -Version on the function below.
# Only includes what the toolkit actually needs.
$Modules = @(
    @{ Name = 'CredentialManager';                              Version = '2.0';      Required = $true  },
    @{ Name = 'MSAL.PS';                                        Version = '4.37.0.0'; Required = $true  },
    @{ Name = 'Microsoft.PowerApps.Administration.PowerShell';  Version = '2.0.180';  Required = $false },
    # Microsoft.Graph submodules — only the ones Initialize-PPMigrationSpn.ps1 actually imports
    @{ Name = 'Microsoft.Graph.Authentication';                 Version = '2.15.0';   Required = $false },
    @{ Name = 'Microsoft.Graph.Applications';                   Version = '2.15.0';   Required = $false },
    @{ Name = 'Microsoft.Graph.Identity.SignIns';               Version = '2.15.0';   Required = $false }
)

function Get-Nupkg {
    param([string] $Url, [string] $OutFile)
    Write-Host "  GET $Url" -ForegroundColor DarkGray
    Invoke-WebRequest @iwrCommon -Uri $Url -OutFile $OutFile
    if (-not (Test-Path $OutFile) -or (Get-Item $OutFile).Length -lt 1024) {
        throw "Download appears too small: $OutFile"
    }
}

function Expand-Nupkg {
    param([string] $NupkgPath, [string] $DestDir)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $DestDir) { Remove-Item $DestDir -Recurse -Force }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($NupkgPath, $DestDir)
    # nupkg has metadata files we don't need at runtime
    Get-ChildItem $DestDir -Force | Where-Object {
        $_.Name -in '_rels','package','[Content_Types].xml' -or $_.Name -like '*.nuspec'
    } | Remove-Item -Recurse -Force
}

# ---- Modules ----
if (-not $SkipModules) {
    foreach ($m in $Modules) {
        $name = $m.Name; $ver = $m.Version
        $nupkg = Join-Path $tmpDir "$name.$ver.nupkg"
        $url = "https://www.powershellgallery.com/api/v2/package/$name/$ver"
        try {
            Write-Host "Module: $name $ver" -ForegroundColor Cyan
            Get-Nupkg -Url $url -OutFile $nupkg
            $dest = Join-Path (Join-Path $modulesDir $name) $ver
            Expand-Nupkg -NupkgPath $nupkg -DestDir $dest
            $manifest = Join-Path $dest "$name.psd1"
            if (Test-Path $manifest) {
                Write-Host "  OK: $manifest" -ForegroundColor Green
            } else {
                # Some modules nest the psd1 deeper; surface the issue but don't fail
                Write-Warning "  $name.psd1 not at expected root; module layout may differ"
            }
        } catch {
            $msg = "Failed: $name $ver -> $($_.Exception.Message)"
            if ($m.Required) { throw $msg } else { Write-Warning $msg }
        }
    }
}

# ---- pac CLI ----
if (-not $SkipPac) {
    Write-Host "pac CLI: $PacVersion" -ForegroundColor Cyan
    $nupkg = Join-Path $tmpDir "Microsoft.PowerApps.CLI.$PacVersion.nupkg"
    $url = "https://www.nuget.org/api/v2/package/Microsoft.PowerApps.CLI/$PacVersion"
    try {
        Get-Nupkg -Url $url -OutFile $nupkg
        $extract = Join-Path $tmpDir "pac-$PacVersion"
        Expand-Nupkg -NupkgPath $nupkg -DestDir $extract

        # Find pac.exe in the extract; layout is tools\pac\<rid>\pac.exe in newer pkgs,
        # or tools\pac\pac.exe in older ones.
        $pacExe = Get-ChildItem -Path $extract -Filter 'pac.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $pacExe) { throw "pac.exe not found inside nupkg $nupkg" }

        # Stage everything from pac.exe's directory into vendor/pac/
        Get-ChildItem -Path (Split-Path -Parent $pacExe.FullName) -File | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $pacDir -Force
        }
        # Some packages put native deps in subfolders (runtimes/), copy whole tree above pac.exe too
        $pacBase = Split-Path -Parent $pacExe.FullName
        if (Test-Path (Join-Path $pacBase 'runtimes')) {
            Copy-Item -LiteralPath (Join-Path $pacBase 'runtimes') -Destination $pacDir -Recurse -Force
        }
        Write-Host "  OK: $(Join-Path $pacDir 'pac.exe')" -ForegroundColor Green
    } catch {
        Write-Warning "pac CLI download failed: $($_.Exception.Message)"
        Write-Warning "Manual fallback: download the nupkg in a browser at $url, extract, copy tools\pac\* into $pacDir"
    }
}

# Manifest + cleanup
$manifest = @{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    pacVersion   = $PacVersion
    modules      = (Get-ChildItem $modulesDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                        @{ name = $_.Name; versions = (Get-ChildItem $_.FullName -Directory | ForEach-Object { $_.Name }) }
                    })
}
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $VendorDir 'manifest.json') -Encoding utf8
Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Verify with:" -ForegroundColor Green
Write-Host "    . .\vendor\Initialize-OfflineEnv.ps1"
Write-Host "    pac --version"
Write-Host "    Get-Module -ListAvailable CredentialManager, MSAL.PS"
