# Vendor folder — offline / air-gapped bundle

When the target Windows machine cannot install pac CLI or PowerShell modules from the internet, pre-stage everything here.

## One-time bundling (on a machine WITH internet)

```powershell
cd <repo>\tools\migration
.\vendor\Download-Dependencies.ps1
```

What it does:

- `Save-Module` of CredentialManager, MSAL.PS, Microsoft.PowerShell.SecretManagement,
  Microsoft.PowerApps.Administration.PowerShell, Microsoft.Graph.Authentication/Applications/Identity.SignIns
  into `vendor/modules/`.
- Downloads `Microsoft.PowerApps.CLI.<version>.nupkg` from nuget.org and extracts `pac.exe` + DLLs into `vendor/pac/`.
- Writes `vendor/manifest.json` for traceability.

When done, **zip the entire `tools/migration/` folder** and ship it to the air-gapped machine.

## What runs on the air-gapped machine

The orchestrator (`scripts/Invoke-FullMigration.ps1`) automatically dot-sources `vendor/Initialize-OfflineEnv.ps1` when this folder exists. That helper:

- Prepends `vendor/modules` to `$env:PSModulePath` so `Import-Module` finds local copies.
- Prepends `vendor/pac` to `$env:PATH` so `pac.exe` resolves without installing the MSI.
- Probes each dependency and prints OK / MISSING.

No installer runs, no network call is made.

## Manual fallback

If `Download-Dependencies.ps1` cannot reach nuget.org or the gallery, populate the folders by hand:

| Target | Source |
|---|---|
| `vendor/pac/pac.exe` (+ neighboring DLLs from `tools\pac\` of the nupkg) | https://www.nuget.org/packages/Microsoft.PowerApps.CLI |
| `vendor/modules/<ModuleName>/<Version>/...` | https://www.powershellgallery.com/packages/<ModuleName> (Manual download → unzip) |

The folder structure under `vendor/modules/<ModuleName>/<Version>/` must match the Save-Module layout (a `<ModuleName>.psd1` at that level).

## Validating

On the target machine, dot-source the helper and confirm everything reports OK:

```powershell
. .\vendor\Initialize-OfflineEnv.ps1
pac --version
Get-Module -ListAvailable CredentialManager, MSAL.PS
```
