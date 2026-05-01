# No-pac (REST-only) mode

When `pac` CLI cannot be installed on the Windows VM, the toolkit automatically falls back to direct Power Platform REST APIs. **No code change required** — the toolkit detects `pac.exe` on `$env:PATH` and chooses pac when present, REST otherwise.

## What changes

| Operation | pac mode | REST-only mode |
|---|---|---|
| Auth | `pac auth create -t -a -cs` profile | SPN client_credentials token at `login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| Solution export | `pac solution export --async` | `POST /api/data/v9.2/ExportSolutionAsync` + poll asyncoperations + `POST /api/data/v9.2/DownloadSolutionExportData` |
| Solution import | `pac solution import --async --publish-changes --skip-lower-version` | `POST /api/data/v9.2/ImportSolutionAsync` (PublishWorkflows=false) + poll |
| `create-settings` | `pac solution create-settings` | PowerShell parses `Solution.xml` + `Customizations.xml` from the exported zip |
| Solution unpack/pack | `pac solution unpack/pack` | `[System.IO.Compression.ZipFile]` (PS 5.1 built-in) |
| Connection create (Dataverse SPN) | `pac connection create -t -a -cs` | `PUT api.powerapps.com/.../apis/shared_commondataserviceforapps/connections/{name}` with SPN connectionParameters |
| Connection list | `pac connection list --json` | `GET api.powerapps.com/.../connections` |

## Force REST mode

If pac is installed but you still want REST (e.g. for testing):

```powershell
.\scripts\Export-PPResources.ps1 -Config .\templates\config.psd1 -ForceRest
.\scripts\Import-PPSolution.ps1  -Config .\templates\config.psd1 -SolutionZip ... -SettingsFile ... -ForceRest
```

`Invoke-FullMigration.ps1` itself doesn't take `-ForceRest`; instead, remove pac from `$env:PATH` for the session if you want a clean test:

```powershell
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notlike '*\pac*' }) -join ';'
.\scripts\Invoke-FullMigration.ps1 -Config .\templates\config.psd1 -Phase All
```

## Caveats and known risks

1. **Repacked zip is not byte-identical to pac-packed zip.** Dataverse accepts standard zip, but if you observe parser errors on import, fall back to pac for that one solution: install pac on a separate machine, repack, copy zip, retry import REST.
2. **Dataverse SPN connection's `connectionParameters` schema is partially undocumented.** The shape used in `lib/PPConnectionRest.psm1` (`token:TenantId` / `token:clientId` / `token:clientSecret` / `token:resourceUri`) matches what the maker portal sends and what's documented in third-party samples, but Microsoft has not published the official schema. If your tenant rejects with "invalid parameter":
   ```powershell
   Import-Module .\scripts\lib\PPConnectionRest.psm1 -Force
   $token = ...   # SPN token for service.powerapps.com
   Get-PPConnectionParameterSchema -Token $token -EnvironmentId <id> -ConnectorId '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps' | ConvertTo-Json -Depth 100
   ```
   The output shows the connector's expected parameter names; adjust the body in `New-PPConnectionSpn` accordingly.
3. **Solution import async timeouts** are visible from the asyncoperation polling log. Increase `-MaxWaitMin` for large solutions (default 60).
4. **Solution import error log** is fetched from `RetrieveFormattedImportJobResults` and saved next to the zip as `import-<jobId>.xml`. Open it in a browser for human-readable diagnostics.
5. **Custom connector install** still uses pac in the current build (`pac connector create`). REST replacement (`PUT api.powerapps.com/.../apis/{id}`) is straightforward but not yet wired; if you have custom connectors and no pac, do that one step manually in the maker portal.

## What still requires pac (current state)

- Custom connector install (`pac connector create`). Workaround: maker portal once, then add the connector to your `cr_CustomConnectors` solution and let the toolkit import it as a normal solution.

Everything else — auth, solution export/import, solution unpack/pack, deployment-settings generation, Dataverse SPN connection create, OAuth interactive bootstrap, AI prompt re-binding, post-import GUID patching, flow OFF enforcement, validation — runs in REST-only mode.

## Minimum dependencies for REST-only mode

- Windows PowerShell 5.1 (built into Windows)
- Network access from the Windows VM to:
  - `login.microsoftonline.com` (token)
  - your source/target Dataverse URL (Web API)
  - `api.powerapps.com` (Power Apps RP for connections)
  - `api.flow.microsoft.com` (Flow API for owner-notification toggle)

That's it. No module installs, no pac install, no `vendor/` folder.

## Recommended config for no-pac mode

```powershell
# templates/config.psd1
@{
    sourceEnvUrl  = 'https://orgSOURCE.crm.dynamics.com'
    sourceEnvId   = '<source env GUID>'
    targetEnvUrl  = 'https://orgTARGET.crm.dynamics.com'
    targetEnvId   = 'f7862d09-ee88-ee8e-bc80-afc7ead10e86'
    tenantId      = '<tenant GUID>'
    spnAppId      = '<SPN appId, created manually in Azure Portal>'
    secretBackend = 'DPAPIFile'   # avoids needing CredentialManager module
    secretPrefix  = 'PPMigration:'
    secrets       = @{ spnClientSecret = 'spn-secret' }
    solutions     = @('cr_Core','cr_Flows','cr_AIBuilder','cr_Copilots')
    outDir        = 'D:\jlseo\PPMigration\out'
}
```

Storing the SPN secret without any module:

```powershell
$dir = "$env:LOCALAPPDATA\PPMigration"; New-Item -ItemType Directory -Path $dir -Force | Out-Null
Read-Host -AsSecureString | ConvertFrom-SecureString | Set-Content "$dir\spn-secret.sec" -Encoding ascii
```
