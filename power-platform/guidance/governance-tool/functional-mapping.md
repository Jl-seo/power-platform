---
title: Map governance functions to architecture tiers
description: Match app and flow inventory, audit log forwarding, DLP policy management, and environment lifecycle controls to each governance tier.
#customer intent: As a Power Platform admin, I want to know which tier delivers each governance pillar so that I can scope my tool and spot gaps that require a tier escalation.
author: manuelap-msft
ms.component: pa-admin
ms.topic: concept-article
ms.subservice: guidance
ms.date: 10/02/2026
ms.author: mapichle
ms.reviewer: jhaskett-msft
---

# Map governance functions to architecture tiers

>[!IMPORTANT]
>Read [Architecture tiers for a restricted-network governance tool](architecture-tiers.md) and [Network, proxy, and authentication configuration](network-and-auth.md) first.

This article maps each governance pillar to the tiers that can deliver it, names the cmdlets, APIs, and connectors involved, and describes how to verify the pillar end to end.

## App and flow inventory and ownership

| Capability | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| List all apps and flows | Yes | Yes | Yes |
| Detect orphaned apps and flows | Yes | Yes | Yes |
| Bulk reassign ownership | Limited | Yes | Yes |
| Cross-tenant inventory | No | Limited | Yes |
| Ownership transfer triggered by an HR leaver event | Limited | Limited | Yes |

**Tier 1.** The CoE Starter Kit inventory writes apps, flows, environments, and makers to Dataverse. See [Set up inventory components](../coe/setup-core-components.md).

**Tier 2.** Use the administrative cmdlets documented in [PowerShell support for Power Apps](../../admin/powerapps-powershell.md):

- `Get-AdminPowerAppEnvironment` lists environments.
- `Get-AdminPowerApp` and `Get-AdminFlow` list resources.
- `Set-AdminPowerAppOwner` reassigns app ownership, and `Set-AdminFlowOwnerRole` adds flow owners.
- `Remove-AdminPowerApp` and `Remove-AdminFlow` remove orphaned resources after review.

**Tier 3.** Combine an HR leaver feed with an Azure Function that runs the same operations and writes results to your SIEM.

**Verify.** The tool's app and flow counts for an environment match the Power Platform admin center.

## Audit log forwarding to SIEM

| Capability | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Collect Power Platform audit events | Limited | Yes | Yes |
| Forward to Microsoft Sentinel | Via Sentinel data connector | Yes | Yes |
| Forward to another SIEM | Limited | Yes | Yes |
| Latency | Batch | Scheduled | Near real-time |
| Cross-tenant aggregation | No | Limited | Yes |

**Sources.** See [Activity logging overview](../../admin/activity-logging-auditing/activity-logs-overview.md), [Power Apps activity logging](../../admin/activity-logging-auditing/activity-logs-power-apps.md), and [Dataverse auditing](../../admin/enable-use-comprehensive-auditing.md). Events reach Microsoft Purview and the Office 365 Management Activity API.

**Tier 1.** The CoE Starter Kit audit log flow collects app launch events. See [Collect audit logs using an HTTP action](../coe/setup-auditlog-http-graphapi.md). If you use Microsoft Sentinel, its Power Platform data connector ingests events without a custom tool.

**Tier 2.** A scheduled job pulls events from the Office 365 Management Activity API, keeps a high-watermark timestamp so reruns don't duplicate events, and forwards JSON to the SIEM ingestion endpoint.

**Tier 3.** A timer-triggered Azure Function runs the same pattern per tenant.

**Verify.** Change a tenant setting, wait one forwarding interval, and find the event in the SIEM with the correct actor and environment.

## DLP policy bulk management

| Capability | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| List DLP policies | Yes | Yes | Yes |
| Create or update policies | Limited | Yes | Yes |
| Roll out one policy across many environments | Limited | Yes | Yes |
| Detect drift from source control | Limited | Yes | Yes |
| Cross-tenant synchronization | No | Limited | Yes |

**Sources.** [Data loss prevention SDK](../../admin/data-loss-prevention-sdk.md), [DLP whitepaper](../../admin/wp-data-loss-prevention.md), [Connector classification](../../admin/dlp-connector-classification.md), and [Impact of DLP policies on apps and flows](../../admin/dlp-impact-policies-apps-flows.md).

**Tier 2.** Store each policy as JSON in source control. A job applies the policy with the DLP cmdlets and reports drift between the live policy and the JSON. Review impact before applying a change.

**Tier 3.** An Azure Function triggered on merge to the main branch applies the change, giving you a pull-request-based approval process.

**Verify.** Change the JSON and confirm the live policy updates. Change the live policy manually and confirm the tool reports drift.

## Environment lifecycle and Managed Environments

| Capability | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Request and approval | Yes | Yes | Yes |
| Apply Managed Environments settings | Yes | Yes | Yes |
| Decommission inactive environments | Yes | Yes | Yes |
| Environment groups and rules | Yes | Yes | Yes |
| Cross-tenant lifecycle | No | Limited | Yes |

**Sources.** [Environments overview](../../admin/environment-management-overview.md), [Enable Managed Environments](../../admin/managed-environment-enable.md), and [Environment groups](../../admin/environment-groups.md).

**Tier 1.** The CoE Starter Kit governance components include an environment request app and approval flows. See [Set up governance components](../coe/setup-governance-components.md).

**Tier 2.** Wrap `New-AdminPowerAppEnvironment` and `Remove-AdminPowerAppEnvironment` in a job that takes input from your existing service management system.

**Tier 3.** Trigger the same job from a service management event and write the result back to the ticket.

**Verify.** Submit a request, confirm the environment appears with the required Managed Environments settings, then request decommissioning and confirm removal.

## Capability matrix by tier

| Pillar | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Inventory and ownership | Single tenant | Single tenant, scripted | Cross-tenant, event-driven |
| Audit to SIEM | Limited | Single tenant, scheduled | Cross-tenant, near real-time |
| DLP bulk management | Limited | Scripted, source-controlled | Cross-tenant, pull-request driven |
| Environment lifecycle | In-tenant approvals | Scripted | Cross-tenant, ITSM-integrated |

Continue to [Phase adoption from in-tenant to cross-tenant](phased-adoption.md).

[!INCLUDE[footer-include](../../includes/footer-banner.md)]
