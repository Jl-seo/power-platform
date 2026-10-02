---
title: Verify and operate the governance tool
description: Acceptance tests, monitoring, credential rotation, and runbooks for a Power Platform governance tool across all tiers.
#customer intent: As a Power Platform admin, I want acceptance tests and runbooks for my governance tool so that I can confirm it works before go-live and operate it reliably.
author: manuelap-msft
ms.component: pa-admin
ms.topic: how-to
ms.subservice: guidance
ms.date: 10/02/2026
ms.author: mapichle
ms.reviewer: jhaskett-msft
---

# Verify and operate the governance tool

>[!IMPORTANT]
>Read [Build a Power Platform governance tool for restricted enterprise networks](overview.md) and the other articles in this guide first.

This article gives acceptance tests for each tier and the operational practices that keep the tool working.

## Acceptance tests per tier

### Tier 1 — In-tenant

1. The governance solution imports without errors and its cloud flows turn on.
1. The inventory flow populates Dataverse with non-zero app and flow counts for every environment in scope.
1. The [CoE Power BI dashboard](../coe/power-bi.md) shows current data.
1. A test environment request goes through approval and creation.

### Tier 2 — Jump host

1. `Get-Module -ListAvailable Microsoft.PowerApps.Administration.PowerShell` shows the approved version.
1. `Add-PowerAppsAccount` with the certificate succeeds, and `Get-AdminPowerAppEnvironment` returns environments.
1. A dry-run inventory job's counts match the admin center.
1. A known admin action appears in the SIEM after the next scheduled run.
1. A tracked DLP change is applied, and a manual change is reported as drift.

### Tier 3 — Azure-hosted

1. The runtime acquires tokens with both the managed identity and the Key Vault certificate.
1. The runtime reaches every allowlisted endpoint and is blocked from others.
1. Cross-tenant inventory counts match each tenant's admin center.
1. Restarting the app mid-job doesn't duplicate or lose events.
1. Invocations appear in Application Insights or Log Analytics.

## Ongoing health checks

| Pillar | Check | Expected result |
|---|---|---|
| Inventory | `(Get-AdminPowerApp -EnvironmentName <id>).Count` | Matches the admin center |
| Audit forwarding | SIEM query for Power Platform events in the last hour | Events during business hours |
| DLP | `Get-DlpPolicy` compared with source control | No drift |
| Environment lifecycle | `Get-AdminPowerAppEnvironment` | Managed Environments enabled where required |

See also [Observability](../adoption/observability.md), [List tenant settings](../../admin/list-tenantsettings.md), and [Dataverse auditing](../../admin/enable-use-comprehensive-auditing.md).

## Monitoring and alerting

Send alerts to your existing monitoring system:

- Daily inventory job fails twice in a row.
- Newest forwarded audit event is more than two intervals old.
- DLP drift that the tool can't correct automatically.
- Unexpected 401 or 403 responses from Power Platform endpoints.
- A service principal certificate expires within 30 days.

For Tier 3, also alert on function failures, Key Vault access denials, and blocked egress.

## Credential and certificate rotation

1. Issue a new certificate before the current one expires.
1. Add the new public key to the app registration so both certificates are valid.
1. Deploy the new certificate to the host or Key Vault and update the thumbprint in configuration.
1. Run a verification job.
1. Remove the old certificate from the app registration and the store.

## Incident response touchpoints

- **Unexpected DLP block.** Compare the live policy with source control. If they match, the issue is policy intent, not drift.
- **Suspicious environment creation.** Use inventory data to identify the maker and time, and follow your incident process.
- **Leaver still owns critical apps.** Run the ownership transfer job and review its output.
- **The tool fails.** Fall back to the Power Platform admin center and follow the rollback in [Phase adoption from in-tenant to cross-tenant](phased-adoption.md).

## Decommissioning

- Disable scheduled jobs and cloud flows.
- Revoke service principal credentials.
- Remove certificates from stores and Key Vault.
- Archive required data and delete the rest.
- Update runbooks and notify stakeholders.

## Verify

The tool is operational when acceptance tests run on a schedule, alerts fire only on real issues, at least one certificate rotation completed without an outage, and a rollback drill finished within the documented recovery time.

Related guidance: [Manage adoption at scale](../adoption/govern-at-scale.md) and [Implement reactive governance controls](../adoption/reactive-governance.md).

[!INCLUDE[footer-include](../../includes/footer-banner.md)]
