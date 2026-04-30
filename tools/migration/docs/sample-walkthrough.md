# Sample Walkthrough — Default Env → Cross-Region Production

This is a worked example with realistic values. Replace the fictitious orgs and IDs with yours.

## Scenario

- **Source**: Default environment `https://orgcontoso0a1b.crm.dynamics.com` (region: West US)
- **Target**: Production environment `https://orgcontosoeu0c2d.crm.dynamics.com` (region: West Europe), brand-new, NO connections, will be promoted to default after cutover
- **Tenant**: `contoso.onmicrosoft.com` (id `11111111-1111-1111-1111-111111111111`)
- **Solutions to migrate**:
  - `cr_Core` — 2 Dataverse tables, 4 connection refs, 3 env vars
  - `cr_Flows` — 5 cloud flows (Dataverse + SharePoint + Outlook)
  - `cr_AIBuilder` — 1 custom prompt bound to GPT-4o
  - `cr_Copilots` — 1 Copilot Studio agent with 1 SharePoint knowledge source and 2 generative actions
  - (no `cr_CustomConnectors` in this scenario)

## Step 1: SPN setup

```powershell
cd .\tools\migration
notepad .\templates\config.psd1
```

Edit:

```powershell
@{
    sourceEnvUrl  = 'https://orgcontoso0a1b.crm.dynamics.com'
    targetEnvUrl  = 'https://orgcontosoeu0c2d.crm.dynamics.com'
    tenantId      = '11111111-1111-1111-1111-111111111111'
    spnAppId      = ''       # filled in after step 2
    secretBackend = 'CredentialManager'
    secretPrefix  = 'PPMigration:'
    secrets       = @{ spnClientSecret = 'spn-secret'; azureOpenAIKey = 'aoai-key' }
    solutions     = @('cr_Core','cr_Flows','cr_AIBuilder','cr_Copilots')
    outDir        = 'C:\PPMigration\out'
}
```

Run setup as a tenant admin:

```powershell
.\scripts\Initialize-PPMigrationSpn.ps1 -Config .\templates\config.psd1
# → prints appId, e.g. 22222222-2222-2222-2222-222222222222
```

Update `spnAppId` in config.psd1 to that value.

In Azure Portal: API permissions → Grant admin consent (Dataverse, PowerApps Service, Power Automate, Power Platform API).

In Power Platform Admin Center: Roles → assign `Power Platform Administrator` to the SPN.

## Step 2: Define connections

Run Phase 1 first to extract logical names:

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase PreFlight
```

Open `C:\PPMigration\out\source\cr_Core.deploymentSettings.seed.json` to read the actual logical names. Suppose they are:

- `cr_sharedcommondataserviceforapps_a1b2c3` (Dataverse)
- `cr_sharedsharepointonline_b2c3d4` (SharePoint)
- `cr_sharedoffice365_c3d4e5` (Outlook)
- `cr_sharedazureopenai_d4e5f6` (Azure OpenAI for the AI Builder prompt)

Edit `templates/connection-bootstrap.json`:

```json
{
  "connectors": [],
  "connections": [
    { "logicalName":"cr_sharedcommondataserviceforapps_a1b2c3", "displayName":"Dataverse (SPN)",
      "connectorId":"/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "authMode":"SPN" },
    { "logicalName":"cr_sharedsharepointonline_b2c3d4", "displayName":"SharePoint (Bootstrap)",
      "connectorId":"/providers/Microsoft.PowerApps/apis/shared_sharepointonline", "authMode":"OAuthInteractive" },
    { "logicalName":"cr_sharedoffice365_c3d4e5", "displayName":"Outlook (Bootstrap)",
      "connectorId":"/providers/Microsoft.PowerApps/apis/shared_office365", "authMode":"OAuthInteractive" },
    { "logicalName":"cr_sharedazureopenai_d4e5f6", "displayName":"Azure OpenAI (Key)",
      "connectorId":"/providers/Microsoft.PowerApps/apis/shared_azureopenai", "authMode":"ApiKey",
      "parameters": {
        "azureOpenAIEndpoint": "https://contoso-eu.openai.azure.com",
        "azureOpenAIApiKey":   "@secret:azureOpenAIKey"
      }}
  ]
}
```

Store the Azure OpenAI key in Credential Manager once:

```powershell
Import-Module CredentialManager
$key = Read-Host -AsSecureString "AOAI key"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key))
New-StoredCredential -Target 'PPMigration:aoai-key' -UserName 'aoai' -Password $plain -Persist LocalMachine | Out-Null
Remove-Variable plain
```

## Step 3: Disable owner notifications

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Notifications
```

Snapshot saved at `C:\PPMigration\out\state\notifications.snapshot.json`. Owner notifications now silenced for both source and target flows.

## Step 4: Bootstrap connections

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Bootstrap
```

Watch the console:

- Dataverse: created automatically (SPN). connectionId returned, e.g. `aabbccdd-...`.
- SharePoint: console prints a consent URL. Operator opens browser, signs in as the dedicated bootstrap account, clicks Accept. Script polls every 5 s until status is Connected. ~30 seconds.
- Outlook: same.
- Azure OpenAI: created via REST PUT with the API key from Cred Manager.

`C:\PPMigration\out\target\connection-map.json` now has 4 entries.

## Step 5: Apply

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Apply
```

Per solution, the orchestrator:

1. Builds target inventory + id-map.
2. `pac solution unpack` of `cr_Core_unmanaged.zip` → `C:\PPMigration\out\target\repair\cr_Core\`
3. `Repair-PPSolutionGuids` rewrites:
   - source `https://orgcontoso0a1b.crm.dynamics.com` → target `https://orgcontosoeu0c2d.crm.dynamics.com`
   - any embedded GUIDs whose source/target IDs are known
4. `pac solution pack` to `cr_Core_unmanaged_repaired.zip`
5. `Set-DeploymentSettings.ps1` populates the deployment settings JSON with target ConnectionIds.
6. `pac solution import --async --publish-changes --skip-lower-version` (NO --activate-plugins).
7. Repeat for cr_Flows, cr_AIBuilder, cr_Copilots.
8. `Set-AIBuilderModelBinding` re-binds the GPT-4o prompt to the target model.

## Step 6: Post-flight

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase PostFlight
```

- `Patch-PostImportReferences`: scans target for any source GUID still embedded; PATCHes them (unmanaged, so writable).
- `Assert-PPResourcesOff`: forces every flow OFF; reports bot publish state (the agent should be in Draft because we never invoked publish).
- `Test-PPMigration`: writes `validation-report.json` and exits non-zero on any failure.

Expected report:

```json
{
  "result": "PASS",
  "checks": {
    "connections": { "expected": 4, "mapped": 4, "missing": [] },
    "flows":       { "total": 5, "on": 0, "offRequired": true },
    "aiPrompts":   { "total": 1, "missingModel": 0 },
    "envVars":     { "total": 3, "missing": 0 }
  }
}
```

## Step 7: Manual cutover

In Power Apps maker portal (target):

1. Open each flow → turn ON. Verify with a test trigger.
2. Open the Copilot Studio agent → click Publish. Verify in the chat canvas.
3. Re-share the AI Builder prompt to the necessary Microsoft 365 group.

## Step 8: Restore notifications

```powershell
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase Restore
```

`flowFailureAlertSubscribed` restored on all flows from snapshot.

## Step 9: Promote target to default

In Power Platform Admin Center: Environments → orgcontosoeu0c2d → set as default. Existing default reverts to Production-type and continues running until you decommission.

## Common reruns

- Bootstrap a single connection failed: `.\scripts\New-PPConnections.ps1 -Config .\templates\config.psd1 -OnlyLogicalName cr_sharedsharepointonline_b2c3d4`
- One solution import timed out: `.\scripts\Invoke-FullMigration.ps1 -Phase Apply -OnlySolutions cr_Copilots -Resume`
- Drift after manual edits: `.\scripts\Reconcile-PPMigration.ps1 -Config .\templates\config.psd1` then add `-Apply`.
