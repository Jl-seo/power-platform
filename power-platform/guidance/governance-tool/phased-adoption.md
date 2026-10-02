---
title: Phase adoption from in-tenant to cross-tenant
description: Roll out a Power Platform governance tool from in-tenant to Azure-hosted only when cross-tenant capability justifies the security review.
#customer intent: As a Power Platform admin, I want a phased rollout that starts with in-tenant controls so that I deliver value early and avoid stalled security reviews.
author: manuelap-msft
ms.component: pa-admin
ms.topic: concept-article
ms.subservice: guidance
ms.date: 10/02/2026
ms.author: mapichle
ms.reviewer: jhaskett-msft
---

# Phase adoption from in-tenant to cross-tenant

>[!IMPORTANT]
>Read [Architecture tiers for a restricted-network governance tool](architecture-tiers.md) first.

Governance projects often stall because the team targets cross-tenant Azure-hosted automation on day one and then waits months for review of the Azure footprint. This article shows how to phase the rollout so you deliver value early and invite a heavier review only when cross-tenant capability is required.

## What cross-tenant capability buys you

- One inventory across the organization, including subsidiaries with their own tenants.
- One DLP source of truth applied to every tenant in scope.
- One audit stream into the SIEM.
- Consistent environment standards across divisions.
- Faster integration of acquired tenants.

If none of these apply, cross-tenant capability is overhead.

## What an Azure-tier security review costs

Tier 3 adds review surfaces that Tier 1 and Tier 2 don't have:

- New Azure resources: function or container app, Key Vault, and networking.
- New identities: a managed identity and a multitenant service principal.
- A new egress path from Azure.
- New secret access policies.
- A new operational owner for patching, monitoring, and rotation.

In organizations that treat any new Azure scope as a major change, this review can take six to twelve weeks.

## Phasing pattern

### Phase 1: Tier 1 baseline

Deploy the CoE Starter Kit or an equivalent. Deliver inventory, approval-driven environment lifecycle, and alerts to email or Microsoft Teams.

**Exit criteria:** All four pillars run at Tier 1 level in production, and stakeholders use the dashboards.

### Phase 2: Tier 2 jump host

Add the jump host for bulk DLP rollout, detailed inventory exports, and scheduled audit forwarding. Keep Tier 1 as the user-facing front door.

**Exit criteria:** The host completes a full operations cycle, including one certificate rotation, without an unplanned outage, and SIEM events match the admin center.

### Phase 3: Tier 3 Azure-hosted, only if needed

Start Tier 3 only when at least one condition holds:

- Cross-tenant aggregation is a documented requirement.
- An event-driven scenario is required by policy.
- Governance workload has outgrown the jump host's schedule window.

**Exit criteria:** Cross-tenant counts match per-tenant counts, and a mid-job restart doesn't duplicate or lose data.

### Phase 4: Operate and review annually

Review the tier choice each year. Tiers can move backward if the Azure footprint no longer earns its cost.

## Escalation triggers

- **Tier 1 to Tier 2:** A pillar needs a cmdlet or PAC CLI command that connectors don't expose, or jobs exceed cloud flow limits.
- **Tier 2 to Tier 3:** Cross-tenant aggregation is required, response time must be seconds, or more than three tenants are in scope.
- **Tier 3 back to Tier 2:** Cross-tenant requirements disappear, for example after a divestiture, or utilization stays very low for two quarters.

## Rollback

Document the rollback before you ask for approval:

- **Tier 1:** Turn off the cloud flows. Data stays in Dataverse.
- **Tier 2:** Disable the scheduled jobs and remove the certificate from the app registration.
- **Tier 3:** Stop the app, remove the managed identity role assignments, revoke the service principal certificate, and delete the resource group when retention allows.

## Stakeholder review checklist

- Power Platform admins agree on the cmdlets, APIs, and connectors.
- The identity team approves the service principal or managed identity scope.
- The network team allowlists the endpoints in [Network, proxy, and authentication configuration](network-and-auth.md).
- Security operations can see audit events in the SIEM.
- The privacy team reviews personal data the tool processes, such as user principal names.
- The change advisory board approves the rollback plan.

Related guidance: [Manage adoption at scale](../adoption/govern-at-scale.md), [Develop a tenant environment strategy](../adoption/environment-strategy.md), [Assess your security posture](../adoption/assess-security-posture.md), and [Cross-tenant restrictions](../../admin/cross-tenant-restrictions.md).

## Verify

- Phase 1 is in production before Phase 2 starts.
- Each phase has an approved rollback plan.
- A documented trigger justifies every escalation.
- The annual review is scheduled.

Continue to [Verify and operate the governance tool](verify-and-operate.md).

[!INCLUDE[footer-include](../../includes/footer-banner.md)]
