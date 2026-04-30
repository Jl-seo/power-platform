# Connector Authentication Matrix

How to set `authMode` for common connectors in `templates/connection-bootstrap.json`.

| Connector | connectorId (suffix after `/apis/`) | Recommended authMode | Notes |
|---|---|---|---|
| Microsoft Dataverse (current) | `shared_commondataserviceforapps` | **SPN** | Uses SPN with Application User in env |
| Microsoft Dataverse (legacy) | `shared_commondataservice` | **SPN** | Same; legacy schema |
| SharePoint | `shared_sharepointonline` | **OAuthInteractive** | Service principal cannot create; one-time human consent |
| Office 365 Outlook | `shared_office365` | **OAuthInteractive** | User-context only |
| Office 365 Users | `shared_office365users` | **OAuthInteractive** | |
| Microsoft Teams | `shared_teams` | **OAuthInteractive** | |
| Approvals | `shared_approvals` | **OAuthInteractive** | |
| Planner | `shared_planner` | **OAuthInteractive** | |
| OneDrive for Business | `shared_onedriveforbusiness` | **OAuthInteractive** | |
| Excel Online | `shared_excelonlinebusiness` | **OAuthInteractive** | |
| HTTP with Azure AD | `shared_webcontents` | **SPN** if Azure AD app available, else **OAuthInteractive** | |
| Azure OpenAI | `shared_azureopenai` | **ApiKey** | Endpoint + API key in `parameters`; reference key with `@secret:<name>` |
| HTTP (generic) | `shared_http` | **ApiKey** | If using API key auth |
| Custom connector (your APIs) | `shared_<your_internal_name>` | depends | If your custom connector supports SPN auth, use SPN; otherwise ApiKey or OAuthInteractive |
| Microsoft Forms | `shared_microsoftforms` | **OAuthInteractive** | |
| Outlook.com | `shared_outlook` | **OAuthInteractive** | |
| Power BI | `shared_powerbi` | **OAuthInteractive** | |
| Azure Blob | `shared_azureblob` | **ApiKey** (account key) or **SPN** | |
| Azure Service Bus | `shared_servicebus` | **ApiKey** (connection string) or **SPN** | |
| SQL Server | `shared_sql` | **SPN** if Azure AD auth available, else **OAuthInteractive** | |

## How to find the right `connectorId`

In source env, run:

```powershell
$cm = .\scripts\Build-SourceIdInventory.ps1 -Config .\templates\config.psd1
# inventory.source.json -> connectionReferences[].connectorid is the suffix after /apis/
```

Or from a flow:

```powershell
pac connection list --environment <sourceUrl> --json
```

## OAuth interactive bootstrap caveats

- The user who clicks "Accept" on the consent URL becomes the connection owner. For service-account bootstraps, sign in as a dedicated, MFA-protected service account, NOT a personal account.
- Once consented, the connection is reusable across all flows that reference its connection-reference logical name.
- You cannot rotate the bootstrap user without re-creating the connection (and re-binding everything).

## ApiKey caveats

- The key itself never lands on disk; it lives in the secret backend (Credential Manager by default).
- Reference with `@secret:<secretName>` in `parameters`. The runner resolves it just-in-time during PUT.
