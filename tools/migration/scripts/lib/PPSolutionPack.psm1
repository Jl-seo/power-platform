#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPSolutionPack.psm1 — pure PowerShell 5.1 replacements for `pac solution unpack`,
`pac solution pack`, and `pac solution create-settings`. Uses the .NET
ZipArchive APIs directly (preserves byte order of stored entries; not
guaranteed byte-identical to pac, but Dataverse accepts standard zip).

For our migration toolkit we only need:
  - faithful unpack of zip contents to a working directory (no normalization)
  - faithful repack to a zip Dataverse will accept
  - generation of the deploymentSettings seed file from solution.xml /
    customizations.xml (lists ConnectionReferences and EnvironmentVariables
    found in the solution package).
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force

Add-Type -AssemblyName System.IO.Compression       -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue

function Expand-PPSolutionZip {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $ZipPath,
        [Parameter(Mandatory)][string] $DestDir
    )
    if (-not (Test-Path $ZipPath)) { throw "Zip not found: $ZipPath" }
    if (Test-Path $DestDir) { Remove-Item -LiteralPath $DestDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestDir)
    Write-PPLog -Level Info -Message "Unpacked: $ZipPath -> $DestDir"
}

function Compress-PPSolutionFolder {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $FolderPath,
        [Parameter(Mandatory)][string] $OutZipPath
    )
    if (Test-Path $OutZipPath) { Remove-Item -LiteralPath $OutZipPath -Force }
    $dir = Split-Path -Parent $OutZipPath
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    # Use NoCompression for entries Dataverse cares about? Standard Optimal works for solutions.
    [System.IO.Compression.ZipFile]::CreateFromDirectory($FolderPath, $OutZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    Write-PPLog -Level Info -Message "Packed: $FolderPath -> $OutZipPath"
}

function _Read-PackageXml {
    param([Parameter(Mandatory)][string] $WorkDir)
    # Solution.xml lists Solution metadata; Customizations.xml lists components.
    $candidates = @('Solution.xml','solution.xml','Other\Solution.xml','other/solution.xml')
    $solutionXml = $null
    foreach ($c in $candidates) {
        $p = Join-Path $WorkDir $c
        if (Test-Path $p) { $solutionXml = $p; break }
    }
    $customXml = $null
    foreach ($c in @('Customizations.xml','customizations.xml','Other\Customizations.xml')) {
        $p = Join-Path $WorkDir $c
        if (Test-Path $p) { $customXml = $p; break }
    }
    return @{ Solution = $solutionXml; Customizations = $customXml }
}

function New-PPDeploymentSettingsSeed {
    <#
    .SYNOPSIS  Builds a deploymentSettings.json skeleton from the unpacked
               solution: lists every ConnectionReference logical name and every
               EnvironmentVariable schema name found in solution.xml /
               customizations.xml. Values are blank for the operator/toolkit to
               populate.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $SolutionZipPath,
        [Parameter(Mandatory)][string] $OutFile,
        [string] $WorkDir
    )
    if (-not $WorkDir) {
        $WorkDir = Join-Path $env:TEMP ("pp-seed-" + [Guid]::NewGuid().ToString('N'))
    }
    Expand-PPSolutionZip -ZipPath $SolutionZipPath -DestDir $WorkDir
    try {
        $xml = _Read-PackageXml -WorkDir $WorkDir
        $connRefs = New-Object System.Collections.ArrayList
        $envVars  = New-Object System.Collections.ArrayList

        # Connection references: in customizations.xml under <connectionreferences>
        if ($xml.Customizations -and (Test-Path $xml.Customizations)) {
            $cust = [xml](Get-Content -LiteralPath $xml.Customizations -Raw -Encoding utf8)
            $crNodes = $cust.SelectNodes('//connectionreferences/connectionreference')
            foreach ($n in $crNodes) {
                $logical = $n.connectionreferencelogicalname
                if (-not $logical) { $logical = $n.GetAttribute('connectionreferencelogicalname') }
                $connectorId = $null
                if ($n.SelectSingleNode('connectorid')) { $connectorId = $n.SelectSingleNode('connectorid').'#text' }
                if (-not $connectorId) { $connectorId = $n.GetAttribute('connectorid') }
                if ($logical) {
                    $null = $connRefs.Add(@{
                        LogicalName  = $logical
                        ConnectionId = ''
                        ConnectorId  = ($connectorId | ForEach-Object { $_ })
                    })
                }
            }

            # Environment variables: <environmentvariabledefinitions><environmentvariabledefinition>
            $evNodes = $cust.SelectNodes('//environmentvariabledefinitions/environmentvariabledefinition')
            foreach ($n in $evNodes) {
                $schema = $n.SelectSingleNode('schemaname')
                $sname = if ($schema) { $schema.'#text' } else { $n.GetAttribute('schemaname') }
                if ($sname) { $null = $envVars.Add(@{ SchemaName = $sname; Value = '' }) }
            }
        }

        # Some packages place these under a separate folder
        $altCrDir = Join-Path $WorkDir 'connectionreferences'
        if (Test-Path $altCrDir) {
            Get-ChildItem -Path $altCrDir -Filter '*.xml' -File | ForEach-Object {
                try {
                    $x = [xml](Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8)
                    $logical = $x.SelectSingleNode('//connectionreferencelogicalname').'#text'
                    $connectorId = $x.SelectSingleNode('//connectorid').'#text'
                    if ($logical -and -not ($connRefs | Where-Object { $_.LogicalName -eq $logical })) {
                        $null = $connRefs.Add(@{ LogicalName = $logical; ConnectionId = ''; ConnectorId = $connectorId })
                    }
                } catch { }
            }
        }
        $altEvDir = Join-Path $WorkDir 'environmentvariabledefinitions'
        if (Test-Path $altEvDir) {
            Get-ChildItem -Path $altEvDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                $sname = $_.Name
                if ($sname -and -not ($envVars | Where-Object { $_.SchemaName -eq $sname })) {
                    $null = $envVars.Add(@{ SchemaName = $sname; Value = '' })
                }
            }
        }

        $seed = @{
            EnvironmentVariables = ,$envVars.ToArray()
            ConnectionReferences = ,$connRefs.ToArray()
        }
        Write-PPJson -InputObject $seed -Path $OutFile
        Write-PPLog -Level Info -Message ("Seed written: {0} (CR={1}, EV={2})" -f $OutFile, $connRefs.Count, $envVars.Count)
    }
    finally {
        try { Remove-Item -LiteralPath $WorkDir -Recurse -Force -ErrorAction SilentlyContinue } catch {}
    }
}

Export-ModuleMember -Function Expand-PPSolutionZip, Compress-PPSolutionFolder, New-PPDeploymentSettingsSeed
