---
title: Network, proxy, and authentication configuration for a governance tool
description: Configure outbound endpoints, TLS inspection, corporate root CAs, and certificate-based authentication for a Power Platform governance tool.
#customer intent: As a Power Platform admin, I want to configure my governance tool host to work through a corporate proxy with TLS inspection and a certificate-based service principal so that my tool runs without stored client secrets.
author: manuelap-msft
ms.component: pa-admin
ms.topic: how-to
ms.subservice: guidance
ms.date: 10/02/2026
ms.author: mapichle
ms.reviewer: jhaskett-msft
---

# Network, proxy, and authentication configuration for a governance tool

>[!IMPORTANT]
>Read [Build a Power Platform governance tool for restricted enterprise networks](overview.md) and [Architecture tiers for a restricted-network governance tool](architecture-tiers.md) first. Some steps apply only to Tier 2 or Tier 3.

This article shows you how to make a governance tool work through a corporate proxy that performs TLS inspection, how to install modules on a host without direct internet access, and how to authenticate with a service principal that uses a client certificate instead of a secret.

## Required outbound endpoints by tier

The list covers the public commercial cloud. For sovereign and government clouds, see [Sovereign and government cloud variations](#sovereign-and-government-cloud-variations).

| Endpoint | Used for | Tier |
|---|---|---|
| `login.microsoftonline.com` | Token acquisition | T2, T3 |
| `api.bap.microsoft.com` | Environments, DLP, tenant settings | T2, T3 |
| `api.powerapps.com` | Power Apps administration | T2, T3 |
| `api.flow.microsoft.com` | Power Automate administration | T2, T3 |
| `api.powerplatform.com` | Power Platform API | T2, T3 |
| `*.dynamics.com` | Dataverse Web API | T2, T3 |
| `graph.microsoft.com` | User lookups and directory data | T2, T3 |
| `manage.office.com` | Office 365 Management Activity API for audit logs | T2, T3 |
| `*.vault.azure.net` | Azure Key Vault | T3 |
| Your SIEM ingestion endpoint | Audit log forwarding | T2, T3 |

Tier 1 runs inside the Power Platform service and doesn't need corporate egress. For the canonical lists, see [Microsoft 365 URLs and IP address ranges](/microsoft-365/enterprise/urls-and-ip-address-ranges) and [Power Platform URLs and IP address ranges](../../admin/online-requirements.md).

Submit this table to your network team as the allowlist request. Avoid wildcards on domains that aren't owned by Microsoft or your SIEM vendor.

## Sovereign and government cloud variations

Endpoint suffixes change in sovereign and government clouds.

| Cloud | Microsoft Entra sign-in | Notes |
|---|---|---|
| Public commercial | `login.microsoftonline.com` | Default |
| US Government (GCC) | `login.microsoftonline.com` | Power Platform endpoints use GCC-specific hosts |
| US GCC High and DoD | `login.microsoftonline.us` | Power Platform and Dataverse use `.us` hosts |
| China operated by 21Vianet | `login.chinacloudapi.cn` | Power Platform and Dataverse use `.cn` hosts |

>[!IMPORTANT]
>Confirm the current endpoint list against [Power Apps US Government](../../admin/powerapps-us-government.md), [About Microsoft Cloud China](../../admin/about-microsoft-cloud-china.md), and the matching Microsoft Entra documentation before you submit an allowlist request. Pass the matching `-Endpoint` value to `Add-PowerAppsAccount` and the matching `--cloud` value to `pac auth create`.

## TLS inspection and corporate root CA trust

Any HTTP client the tool uses must trust the corporate root CA that the proxy re-signs traffic with.

- **Windows.** Import the corporate root CA into the local machine **Trusted Root Certification Authorities** store. PowerShell, PAC CLI, and .NET use the OS store.
- **Linux.** Copy the CA to `/usr/local/share/ca-certificates/` and run `update-ca-certificates` (Debian, Ubuntu), or copy it to `/etc/pki/ca-trust/source/anchors/` and run `update-ca-trust extract` (Red Hat Enterprise Linux).
- **Containers.** Add the CA to the base image or mount it at runtime, and update the trust store at build time.

For Tier 3, configure the same trust in the Azure runtime, or route egress through Azure Firewall without TLS re-signing.

## Set proxy environment variables

PowerShell 7, PAC CLI, and .NET honor these variables:

- `HTTPS_PROXY` and `HTTP_PROXY`, for example `http://proxy.contoso.com:8080`.
- `NO_PROXY`, a comma-separated bypass list, for example `localhost,127.0.0.1,.contoso.com`.

On Windows, set them as machine-level environment variables so scheduled tasks inherit them. On Linux, set them in the service unit or cron environment. Windows PowerShell 5.1 uses the WinHTTP or WinINet proxy instead; configure it with `netsh winhttp set proxy` or set `[System.Net.WebRequest]::DefaultWebProxy` at the start of each script.

## Sideload modules on offline hosts

1. On a connected build host, save the modules:

   ```powershell
   Save-Module -Name Microsoft.PowerApps.Administration.PowerShell -Path C:\offline-modules
   Save-Module -Name Microsoft.PowerApps.PowerShell -Path C:\offline-modules
   ```

1. Scan the folder with your malware scanner and record the module versions and file hashes.

1. Transfer the folder through your approved file transfer path, then copy it into a module path on the jump host:

   ```powershell
   Copy-Item C:\offline-modules\* "$env:ProgramFiles\WindowsPowerShell\Modules" -Recurse -Force
   ```

For PAC CLI, use the Windows MSI or the .NET tool package described in [Install Power Platform CLI](../../developer/cli/introduction.md) and transfer it the same way. To host packages internally instead, register an internal NuGet feed with `Register-PSRepository`.

## Authenticate with a certificate-based service principal

Use a client certificate instead of a client secret wherever possible.

1. Register an app in Microsoft Entra ID and register it as a Power Platform management application. See [Create a service principal for the Power Platform API](../../admin/powerplatform-api-create-service-principal.md).
1. Issue a client certificate from your enterprise CA. Store the private key in the local machine certificate store of the jump host, or in Key Vault for Tier 3. Mark the private key non-exportable where possible.
1. Upload the public key to the app registration under **Certificates & secrets**.
1. Sign in from PowerShell:

   ```powershell
   Add-PowerAppsAccount -TenantID '<tenant-id>' -ApplicationId '<app-id>' -CertificateThumbprint '<thumbprint>'
   ```

1. Sign in from PAC CLI:

   ```bash
   pac auth create --applicationId <app-id> --tenant <tenant-id> --certificateDiskPath <path-to-pfx> --certificatePassword <password>
   ```

1. Track certificate expiry in your enterprise certificate monitoring and rotate before it expires. See [Verify and operate the governance tool](verify-and-operate.md#credential-and-certificate-rotation).

For Tier 3, use the managed identity for Azure resources and Microsoft Graph where supported, and the certificate-based service principal only where Power Platform requires it.

## Proxy authentication

- **Integrated Windows authentication.** Run the scheduled task as a domain service account. The .NET HTTP stack negotiates with the proxy automatically.
- **Explicit proxy credentials.** If your proxy requires basic authentication, read the credential from the same secret store as the certificate at run time. Never hardcode proxy credentials in scripts.

## Verify

Run these checks from the host that runs the tool:

1. `Invoke-WebRequest https://api.bap.microsoft.com -UseBasicParsing` returns an HTTP 401 or 404, not a connection or TLS error. That proves the proxy and CA trust work.
1. `Add-PowerAppsAccount` with the certificate succeeds, and `Get-AdminPowerAppEnvironment` returns a non-empty list.
1. `pac auth create` succeeds, and `pac admin list` returns environments.
1. `Get-Module -ListAvailable Microsoft.PowerApps.Administration.PowerShell` shows the version you approved.

Then continue to [Map governance functions to architecture tiers](functional-mapping.md).

[!INCLUDE[footer-include](../../includes/footer-banner.md)]
