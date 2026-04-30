# Runbook — Default Environment → Cross-Region Production

This runbook walks through migrating from the source default environment to a freshly-provisioned production environment in another region (same tenant), with all migrated resources kept OFF and owner notifications suppressed.

## 0. Prerequisites checklist

- [ ] Windows machine with PowerShell 5.1
- [ ] `pac --version` ≥ 1.34
- [ ] PowerShell modules installed (see `README.md`)
- [ ] Tenant admin or Power Platform Admin available for one-time SPN creation
- [ ] An operator who can interactively consent to SharePoint/Office 365 connections (Track B)
- [ ] Source and target environment URLs in hand
- [ ] Tenant ID

## 1. One-time SPN setup

Open an elevated PowerShell 5.1 session:

```powershell
cd <repo>\tools\migration

# Edit templates/config.psd1: tenantId, sourceEnvUrl, targetEnvUrl
notepad templates\config.psd1

.\scripts\Initialize-PPMigrationSpn.ps1 -Config .\templates\config.psd1
```

What this does:

1. Connects to Microsoft Graph (device code).
2. Creates the Entra app `PP-Migration-SPN` (or reuses by `-ReuseAppId`).
3. Adds a 6-month client secret and stores it in the chosen secret backend (Windows Credential Manager by default).
4. Lists the API permissions you must grant from the Azure portal (script does NOT auto-consent first-party PP service principals — that is admin-driven).
5. Registers the SPN as Application User with **System Administrator** in source and target environments via `pac admin assign-user --application-user`.

Capture the printed `appId` and paste it into `templates/config.psd1` under `spnAppId`.

### Manual steps after the script

In Azure Portal → Microsoft Entra → App registrations → `PP-Migration-SPN`:

1. **API permissions** → Add a permission → APIs my organization uses:
   - Dataverse → Application permissions → `user_impersonation`
   - PowerApps Service → `User`
   - Microsoft Power Automate → `User`
   - Power Platform API → `.default`
2. Click **Grant admin consent for <tenant>**.

In Power Platform Admin Center:

3. Roles → assign `Power Platform Administrator` to the SPN's service principal.

## 2. Define connections

```powershell
notepad templates\connection-bootstrap.json
```

For each connection reference in your solutions, add an entry. Pick the right `authMode`:

- **SPN** for Dataverse-class connectors.
- **OAuthInteractive** for SharePoint, Office 365 Outlook/Users, Teams, Approvals, Planner.
- **ApiKey** for Azure OpenAI key-auth, custom HTTP, generic API key connectors.

`logicalName` MUST match the connection reference logical name in the solution. If you do not know it, run Phase 1 first; the seed deployment settings file will list every logical name.

## 3. Phase 0 — Disable owner notifications

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Notifications
```

Reads every flow in source AND target, captures `flowFailureAlertSubscribed` to `out\state\notifications.snapshot.json`, then PATCHes them all to `false`. Idempotent.

## 4. Phase 1 — Pre-flight

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase PreFlight
```

Output (in `<outDir>\source\`):

- `<solution>_unmanaged.zip` — Unmanaged export per solution
- `<solution>.deploymentSettings.seed.json` — connection refs + env vars (empty values)
- `inventory.source.json` — full inventory
- `source-ids.json` — compact GUID lookup used for repair

If `connection-bootstrap.json` was not yet filled in, open the seed files now and copy each `LogicalName` into the bootstrap JSON.

## 5. Phase 2 — Bootstrap target connections

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Bootstrap
```

For each entry in `connection-bootstrap.json`:

- **SPN**: fully automated. Result captured into `<outDir>\target\connection-map.json`.
- **OAuthInteractive**: opens a consent URL in the browser. The operator signs in (with rights to that data source) and clicks Accept. Script polls every 5 s until the connection becomes `Connected`.
- **ApiKey**: pulls the key from the secret backend (`@secret:<name>` references), submits via REST PUT. No human interaction.

If you got partway and one connection failed, fix the underlying issue (e.g., SharePoint permission), then re-run:

```powershell
.\scripts\New-PPConnections.ps1 -Config .\templates\config.psd1 -OnlyLogicalName cr_sharedsharepointonline_xxxx
```

## 6. Phase 3 — Apply

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Apply
```

Per solution:

1. `Build-TargetIdInventory` (once) — captures target env GUIDs.
2. `Build-IdMap` (once) — joins source + target + connection-map into `id-map.json`.
3. `pac solution unpack` to `<outDir>\target\repair\<solution>\`.
4. `Repair-PPSolutionGuids` rewrites every embedded source GUID and URL using id-map.
5. `pac solution pack` to `<outDir>\target\<solution>_unmanaged_repaired.zip`.
6. `Set-DeploymentSettings` produces `<outDir>\target\<solution>.deploymentSettings.json` (fails fast if any connection ref is missing in the map).
7. `Import-PPSolution` invokes `pac solution import --async --publish-changes --skip-lower-version` (NO `--activate-plugins`).
8. After all solutions: `Set-AIBuilderModelBinding` re-binds AI Builder prompt versions to target models.

If a solution import times out:

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Apply -OnlySolutions cr_Flows -Resume
```

## 7. Phase 4 — Post-flight

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase PostFlight
```

1. `Patch-PostImportReferences` — last-mile sweep of botcomponents/workflows/aiplugins for any source GUID still embedded.
2. `Assert-PPResourcesOff` — forces every flow `statecode=0`. Reports any published bots without unpublishing.
3. `Test-PPMigration` — full validation; non-zero exit if anything fails.

Open `<outDir>\target\validation-report.json`. Resolve any FAIL items via `Reconcile-PPMigration.ps1`.

## 8. Manual operator steps (intentionally not automated)

- **Activate flows** when ready: Power Automate → Solutions → `cr_Flows` → turn on each flow.
- **Publish bots** when ready: Copilot Studio → open agent → Publish.
- **Share AI Builder prompts** with end users when ready.

## 9. Restore notifications

After validation has passed and you are happy:

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Restore
```

This restores `flowFailureAlertSubscribed` from the Phase 0 snapshot.

## 10. Decommission source

When the new environment is promoted to default and tested in production:

- Disable flows in source environment (do not delete yet).
- Keep source for at least 30 days for fallback.
- Remove SPN's Application User from source environment.
