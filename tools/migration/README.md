# Power Platform Migration Toolkit

PowerShell 5.1 toolkit for migrating Copilot Studio agents, Power Automate cloud flows, and AI Builder custom prompts between Power Platform environments — with automatic connection-reference resolution, GUID remapping in topic content, throttling-aware retries, and a strict OFF-after-import / no-owner-email-during-migration posture.

## Why this exists

The shipped Microsoft tooling (Power Platform pipelines, ALM Accelerator, Build Tools) assumes a target environment that already has connections and a manageable shape. Real-world migrations from a default environment to a freshly-provisioned production environment in another region need:

1. Connections created from scratch in the empty target (SPN, OAuth bootstrap, ApiKey tracks).
2. Source GUIDs embedded inside agent topics, flow definitions, and AI Builder prompts to be rewritten to the target's IDs.
3. Cloud flows imported in OFF state and kept OFF.
4. Copilot Studio agents NOT auto-published.
5. Suppression of owner notification emails during connection re-binding.
6. Throttling-aware HTTP, idempotent steps, and resumable checkpoints.

This toolkit covers all six.

## Layout

```
tools/migration/
├── scripts/
│   ├── Invoke-FullMigration.ps1            # orchestrator
│   ├── Initialize-PPMigrationSpn.ps1       # one-time SPN setup
│   ├── Disable-PPOwnerNotifications.ps1    # Phase 0
│   ├── Restore-PPOwnerNotifications.ps1    # post-validation restore
│   ├── Export-PPResources.ps1              # Phase 1
│   ├── Build-SourceIdInventory.ps1         # Phase 1
│   ├── New-PPConnections.ps1               # Phase 2
│   ├── Build-TargetIdInventory.ps1         # Phase 3
│   ├── Build-IdMap.ps1                     # Phase 3
│   ├── Repair-PPSolutionGuids.ps1          # Phase 3
│   ├── Set-DeploymentSettings.ps1          # Phase 3
│   ├── Import-PPSolution.ps1               # Phase 3
│   ├── Set-AIBuilderModelBinding.ps1       # Phase 3
│   ├── Patch-PostImportReferences.ps1      # Phase 4
│   ├── Assert-PPResourcesOff.ps1           # Phase 4
│   ├── Test-PPMigration.ps1                # Phase 4
│   ├── Reconcile-PPMigration.ps1           # drift detect + targeted fix
│   └── lib/                                 # PPMigration / PPThrottle / PPSecrets / PPAuth / State / Connection-Bootstrap
├── templates/
│   ├── config.psd1                          # primary configuration
│   ├── connection-bootstrap.json            # target connections to create
│   └── deploymentSettings.template.json     # skeleton settings file
└── docs/
    ├── runbook.md                           # step-by-step
    ├── risks.md                             # full risk register
    ├── connector-matrix.md                  # SPN / OAuth / ApiKey by connector
    └── sample-walkthrough.md                # default env → cross-region prod
```

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| Windows PowerShell 5.1 | host | built into Windows 10/11/Server |
| pac CLI 1.34+ | solution / connection / copilot operations | `winget install Microsoft.PowerPlatformCLI` or msi |
| `Microsoft.PowerShell.SecretManagement` | secret abstraction | `Install-Module Microsoft.PowerShell.SecretManagement -Scope CurrentUser` |
| `CredentialManager` | DPAPI-backed local secret vault (default) | `Install-Module CredentialManager -Scope CurrentUser` |
| `MSAL.PS` | device-code admin token | `Install-Module MSAL.PS -Scope CurrentUser` |
| `Microsoft.PowerApps.Administration.PowerShell` | tenant settings (optional) | `Install-Module Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser` |
| `Microsoft.Graph` | SPN registration in `Initialize-PPMigrationSpn.ps1` | `Install-Module Microsoft.Graph -Scope CurrentUser` |
| `Az.KeyVault` (optional) | KeyVault secret backend | `Install-Module Az.KeyVault -Scope CurrentUser` |

## No-pac (REST-only) mode

If `pac` CLI cannot be installed on the Windows VM, the toolkit auto-detects its absence and falls back to direct Power Platform REST APIs. Every phase still works — solution export/import via `ExportSolutionAsync`/`ImportSolutionAsync`, solution unpack/pack via .NET `ZipArchive`, Dataverse SPN connection create via Power Apps RP REST PUT.

Minimum requirements: PowerShell 5.1 (built into Windows) + network reach to `login.microsoftonline.com`, the Dataverse URL, `api.powerapps.com`, and `api.flow.microsoft.com`. No module installs needed if `secretBackend = 'DPAPIFile'`.

See `docs/no-pac-mode.md` for the full mapping, caveats (especially around the SPN connectionParameters schema), and a minimal config.

## Offline / air-gapped target machine

If the target machine cannot install pac CLI or modules from the internet, populate `vendor/` first on a machine that *can* reach the internet:

```powershell
.\vendor\Download-Dependencies.ps1   # downloads pac CLI nupkg + Save-Module everything
```

Then zip the whole `tools/migration/` folder and ship it. The orchestrator auto-detects `vendor/` and prepends it to `$env:PSModulePath` and `$env:PATH` — no installer runs on the target. See `vendor/README.md`.

## Quick start

```powershell
# 1) One-time SPN setup (creates Entra app, secret, application user in source/target). Run as a tenant admin in interactive PS.
.\scripts\Initialize-PPMigrationSpn.ps1 -Config .\templates\config.psd1

# 2) Edit templates/config.psd1: tenantId, source/target URLs, spnAppId (printed by step 1)
# 3) Edit templates/connection-bootstrap.json: list every connection your solutions need

# 4) Run end-to-end (excluding Restore — operator decides when to re-enable owner notifications)
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase All

# 5) Validate
.\scripts\Test-PPMigration.ps1 -Config .\templates\config.psd1

# 6) When validation looks good, optionally restore owner notifications
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Restore
```

## Phase-by-phase commands

| Phase | Script | What it does |
|---|---|---|
| 0 Notifications | `Disable-PPOwnerNotifications.ps1` | Snapshots and disables `flowFailureAlertSubscribed` on every flow in source/target |
| 1 PreFlight | `Export-PPResources.ps1` + `Build-SourceIdInventory.ps1` | `pac solution export` (Unmanaged), `pac solution create-settings`, then captures source GUIDs |
| 2 Bootstrap | `New-PPConnections.ps1` | Custom connectors first, then SPN/OAuth/ApiKey connections |
| 3 Apply | `Build-TargetIdInventory.ps1` → `Build-IdMap.ps1` → unpack → `Repair-PPSolutionGuids.ps1` → pack → `Set-DeploymentSettings.ps1` → `Import-PPSolution.ps1` → `Set-AIBuilderModelBinding.ps1` | per solution in dependency order |
| 4 PostFlight | `Patch-PostImportReferences.ps1` → `Assert-PPResourcesOff.ps1` → `Test-PPMigration.ps1` | sweep stragglers, force flows OFF, validate |
| Restore | `Restore-PPOwnerNotifications.ps1` | re-enable owner notifications from snapshot |

## Resumable runs

State is persisted to `<outDir>/state/state.json`. Failures append to `<outDir>/state/failures.jsonl`. Re-running the same command resumes automatically — every step is idempotent (Check-then-Act).

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Resume
```

## Drift detection

```powershell
.\scripts\Reconcile-PPMigration.ps1 -Config .\templates\config.psd1            # dry-run plan
.\scripts\Reconcile-PPMigration.ps1 -Config .\templates\config.psd1 -Apply     # execute targeted fixes
```

## Notable design choices (and why)

- **All Unmanaged**. Avoids the immutable-managed-component problem (knowledge source URLs in particular). One-time migration; managed conversion is a separate ALM concern after.
- **No `--activate-plugins` and no `pac copilot publish`**. Honors the requirement that all migrated resources stay OFF / Draft.
- **GUID rewrite happens BEFORE import** via unpack → walk → pack. This is more reliable than post-import patching because solution import resolves a coherent component graph in one shot. Phase 4 patcher exists as a safety net.
- **SPN not used for SharePoint connections**. SharePoint has no Application user type; OAuth interactive consent (Track B) is the only supported path.
- **Tenant-level admin operations use device-code, not SPN**. Avoids needing Global Admin on the SPN.
- **Strict throttling**. `Invoke-PPRest` honors Retry-After, applies exponential backoff, and uses per-host token buckets.

## See also

- `docs/runbook.md` — full step-by-step for the default-env → cross-region prod scenario
- `docs/risks.md` — risk register
- `docs/connector-matrix.md` — which connectors take SPN vs OAuth vs ApiKey
- `docs/sample-walkthrough.md` — worked example
