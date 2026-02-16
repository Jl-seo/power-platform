"""
Governance module — quarantine, ownership transfer, and policy actions.

Wraps Power Platform Admin API calls for governance operations.
Based on patterns from docs/03-admin-flows.md.
"""
import logging
from typing import Any, Optional

import httpx

from core.auth import get_access_token, SCOPE_DYNAMICS
from core.config import get_config

logger = logging.getLogger(__name__)

# Power Apps Admin API base
ADMIN_API_BASE = "https://api.powerapps.com"


async def quarantine_app(
    environment_id: str,
    app_id: str,
    quarantine: bool = True,
    reason: str = "",
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Set quarantine state for a canvas app.

    When quarantined, users see a "not available" message when opening the app.

    Args:
        environment_id: The environment containing the app.
        app_id: The app resource ID.
        quarantine: True to quarantine, False to release.
        reason: Reason for quarantine action.

    Returns:
        Action result with status.
    """
    token = await get_access_token(SCOPE_DYNAMICS, tenant_id)
    action = "quarantine" if quarantine else "unquarantine"

    url = (
        f"{ADMIN_API_BASE}/providers/Microsoft.PowerApps"
        f"/scopes/admin/environments/{environment_id}"
        f"/apps/{app_id}/{action}?api-version=2023-06-01"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json={"quarantineReason": reason} if quarantine else {},
        )

        if resp.status_code not in (200, 204):
            logger.error(
                "Quarantine %s failed for app %s: HTTP %d - %s",
                action, app_id[:8], resp.status_code, resp.text[:500],
            )
            return {
                "success": False,
                "action": action,
                "app_id": app_id,
                "error": resp.text[:500],
            }

        logger.info(
            "App %s: %s (env=%s, reason=%s)",
            action, app_id[:8], environment_id[:8], reason[:50],
        )
        return {
            "success": True,
            "action": action,
            "app_id": app_id,
            "environment_id": environment_id,
            "reason": reason,
        }


async def transfer_app_ownership(
    environment_id: str,
    app_id: str,
    new_owner_id: str,
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Transfer ownership of a canvas app to a new user.

    Args:
        environment_id: Environment containing the app.
        app_id: The app resource ID.
        new_owner_id: Object ID of the new owner (Entra user).

    Returns:
        Action result with status.
    """
    token = await get_access_token(SCOPE_DYNAMICS, tenant_id)

    url = (
        f"{ADMIN_API_BASE}/providers/Microsoft.PowerApps"
        f"/scopes/admin/environments/{environment_id}"
        f"/apps/{app_id}/modifyAppOwner?api-version=2023-06-01"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json={
                "roleForOldAppOwner": "CanView",
                "newAppOwner": new_owner_id,
            },
        )

        if resp.status_code not in (200, 204):
            logger.error(
                "Ownership transfer failed for app %s: HTTP %d - %s",
                app_id[:8], resp.status_code, resp.text[:500],
            )
            return {
                "success": False,
                "app_id": app_id,
                "new_owner_id": new_owner_id,
                "error": resp.text[:500],
            }

        logger.info(
            "Ownership transferred: app=%s → user=%s (env=%s)",
            app_id[:8], new_owner_id[:8], environment_id[:8],
        )
        return {
            "success": True,
            "app_id": app_id,
            "environment_id": environment_id,
            "new_owner_id": new_owner_id,
            "previous_owner_role": "CanView",
        }


async def bulk_transfer_by_owner(
    old_owner_id: str,
    new_owner_id: str,
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Transfer ALL apps from one owner to another (for offboarding).

    Uses Inventory API to find all apps, then transfers each one.
    """
    from modules.inventory import get_owner_resources

    resources = await get_owner_resources(old_owner_id, tenant_id=tenant_id)
    apps = [
        r for r in resources.get("resources", [])
        if "powerapps" in r.get("type", "").lower()
    ]

    results = []
    for app in apps:
        env_id = app.get("properties", {}).get("environmentId", "")
        app_id = app.get("name", "")
        if env_id and app_id:
            result = await transfer_app_ownership(
                environment_id=env_id,
                app_id=app_id,
                new_owner_id=new_owner_id,
                tenant_id=tenant_id,
            )
            results.append(result)

    success_count = sum(1 for r in results if r.get("success"))
    return {
        "old_owner_id": old_owner_id,
        "new_owner_id": new_owner_id,
        "total_apps": len(apps),
        "transferred": success_count,
        "failed": len(apps) - success_count,
        "details": results,
    }
