---
title: Architecture tiers for a restricted-network governance tool
description: Compare in-tenant, jump-host, and Azure-hosted tiers for a Power Platform governance tool under enterprise security review.
#customer intent: As a Power Platform admin, I want to compare three architecture tiers for a governance tool so that I can pick the lightest design that still delivers the controls my organization needs.
author: manuelap-msft
ms.component: pa-admin
ms.topic: concept-article
ms.subservice: guidance
ms.date: 10/02/2026
ms.author: mapichle
ms.reviewer: jhaskett-msft
---

# Architecture tiers for a restricted-network governance tool

>[!IMPORTANT]
>Read [Build a Power Platform governance tool for restricted enterprise networks](overview.md) first. This article assumes you understand the four governance pillars and the tier decision flow.

This article describes the three architecture tiers in detail, compares them, and lists the criteria you can use to choose a starting tier or escalate from one tier to the next.

## Tier 1 — In-tenant

Tier 1 keeps everything inside the Power Platform tenant. It uses the CoE Starter Kit pattern: a managed solution that contains Dataverse tables, model-driven apps, and scheduled cloud flows that run inventory and policy checks.

**Components:**

- The [CoE Starter Kit governance components](../coe/setup-governance-components.md), or a custom solution that follows the same pattern.
- Cloud flows that call administrative connectors such as **Power Platform for Admins**, **Power Platform for Makers**, and **Microsoft Dataverse**.
- A Dataverse environment that stores inventory and audit data.
- A Power BI report that reads Dataverse. See [the CoE Power BI dashboard](../coe/power-bi.md).

**Identity:** A service account or service principal that owns the cloud flows. No identity outside Power Platform.

**Network:** All traffic stays inside Power Platform service endpoints. No new corporate network egress is required.

**Strengths:**

- Lowest security-review weight. Reviewers see only Power Platform components, which the organization already approved.
- No new infrastructure to patch or monitor.
- Aligns with existing CoE Starter Kit operations.

**Limits:**

- Cross-tenant aggregation isn't possible. Each tenant runs its own Tier 1 instance.
- Bulk operations, such as DLP authoring across many environments, are clunky in cloud flows compared to PowerShell or PAC CLI.
- Long-running operations are constrained by cloud flow run-duration limits.

## Tier 2 — Jump host

Tier 2 introduces a single hardened host, on-premises or in a cloud subscription that the security team already reviewed. The host runs scheduled scripts that call Power Platform administrative endpoints.

**Components:**

- A virtual machine or container with [Microsoft.PowerApps.Administration.PowerShell](../../admin/powerapps-powershell.md) and the [Power Platform CLI](../../developer/cli/introduction.md) installed.
- A scheduler that already exists in your organization, for example Windows Task Scheduler, cron, or an approved on-premises orchestrator.
- An approved output location, for example a network share, an existing Log Analytics workspace, or an existing storage account.

**Identity:** A pre-approved service principal with a client certificate. See [Create a service principal for the Power Platform API](../../admin/powerplatform-api-create-service-principal.md) and [Create a service principal with PowerShell](../../admin/powershell-create-service-principal.md). The certificate lives in a certificate store that the security team already monitors.

**Network:** Outbound to documented Power Platform endpoints only, through the corporate proxy. The corporate root CA must be trusted. See [Network, proxy, and authentication configuration](network-and-auth.md).

**Strengths:**

- Full PowerShell and PAC CLI surface, including bulk DLP authoring and scripted environment lifecycle.
- No new Azure footprint, so the review focuses on a single host that already exists.

**Limits:**

- Cross-tenant work requires one service principal per tenant and a script that switches identities. Workable for two or three tenants, awkward beyond that.
- The host is a single point of failure. Treat it like any other production job runner.
- Event-driven automation that must react within seconds isn't a fit.

## Tier 3 — Azure-hosted

Tier 3 hosts the governance tool in Azure. Use it only when Tier 1 and Tier 2 can't deliver a required capability, most commonly multitenant aggregation or event-driven automation.

**Components:**

- An Azure Functions app, Container Apps job, or Logic Apps workflow.
- Azure Key Vault for certificates that a managed identity can't replace, such as multitenant service principal certificates.
- Application Insights or a Log Analytics workspace for telemetry.
- Optionally, a Storage queue or Service Bus topic to buffer events.

**Identity:** A managed identity for Azure resource access, plus a separate multitenant service principal with a client certificate for cross-tenant Power Platform calls.

**Network:** Restrict outbound traffic with Azure Firewall or a virtual network so the runtime can reach only documented Power Platform endpoints and your SIEM. For high-sensitivity tenants, use Private Link for Key Vault and Storage.

**Strengths:**

- Straightforward cross-tenant aggregation from a single deployment.
- First-class event-driven scenarios, such as ownership transfer triggered by an HR leaver event.
- Standard Azure observability, scaling, and identity tooling.

**Limits:**

- Heaviest security review: subscription scope, managed identity, Key Vault, network egress, and the multitenant service principal are all new.
- Higher run cost.
- Requires Azure operations skills.

## Comparison matrix

| Dimension | Tier 1 — In-tenant | Tier 2 — Jump host | Tier 3 — Azure-hosted |
|---|---|---|---|
| New Azure resources | None | None | Function or Container app, Key Vault, networking |
| New identity surface | Power Platform identity only | Pre-approved service principal with certificate | Managed identity plus multitenant service principal |
| Cross-tenant | Not supported | Limited | Supported |
| Event-driven | Via cloud flow triggers | Not a fit | First-class |
| Bulk DLP authoring | Limited | Full | Full |
| Operational owner | Power Platform admin | Power Platform admin plus host operator | Power Platform admin plus Azure operator |
| Security-review weight | Low | Medium | High |
| Time to first value | Days | Days to weeks | Weeks to months |

## Cross-tenant capability per tier

- **Tier 1** gives per-tenant insight only. Acceptable when each tenant is operated independently and aggregation is done manually.
- **Tier 2** can serve a small number of tenants if you accept one service principal per tenant.
- **Tier 3** is the right tier when aggregation must be automated, near real-time, or span more than a handful of tenants. Review [cross-tenant restrictions](../../admin/cross-tenant-restrictions.md) before you design cross-tenant calls.

## Decision criteria

- **More than three tenants in scope?** Plan for Tier 3.
- **Any pillar needs event-driven response within seconds?** Plan for Tier 3.
- **New Azure footprint means a multi-week review?** Start at Tier 1 or Tier 2 and escalate only with a signed-off business case.
- **Already operate an approved jump host?** Tier 2 is a low-friction next step.
- **All pillars satisfied by cloud flows and Dataverse?** Stay at Tier 1 and revisit annually.

The phasing pattern is in [Phase adoption from in-tenant to cross-tenant](phased-adoption.md).

## Verify

You've chosen a tier when you can answer each of these in writing:

- Which tier delivers each of the four governance pillars?
- Which identities does the tier require, and where are their credentials stored?
- Which network paths must be open?
- Which security approvals are still outstanding?

Then continue to [Network, proxy, and authentication configuration](network-and-auth.md).

[!INCLUDE[footer-include](../../includes/footer-banner.md)]
