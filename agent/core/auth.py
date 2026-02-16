"""
Multi-tenant Entra ID authentication for the CoE Governance Agent.

Handles Client Credentials flow to obtain access tokens for:
- Power Platform Inventory API
- Power Platform Admin API
- Microsoft Graph API
"""
import time
import logging
from typing import Optional

import httpx

from .config import get_config

logger = logging.getLogger(__name__)

# Simple in-memory token cache: {scope: (token, expiry_timestamp)}
_token_cache: dict[str, tuple[str, float]] = {}

# Token scopes for different APIs
SCOPE_POWER_PLATFORM = "https://api.powerplatform.com/.default"
SCOPE_GRAPH = "https://graph.microsoft.com/.default"
SCOPE_DYNAMICS = "https://service.powerapps.com/.default"


async def get_access_token(
    scope: str = SCOPE_POWER_PLATFORM,
    tenant_id: Optional[str] = None,
) -> str:
    """
    Obtain an access token via Client Credentials flow.

    Args:
        scope: The OAuth2 scope to request.
        tenant_id: Override tenant ID (for multi-tenant scenarios).
                   If None, uses the configured tenant ID.

    Returns:
        Access token string.

    Raises:
        RuntimeError: If token acquisition fails.
    """
    config = get_config()
    effective_tenant = tenant_id or config.tenant_id

    if not effective_tenant:
        raise RuntimeError("TENANT_ID is not configured")
    if not config.client_id:
        raise RuntimeError("CLIENT_ID is not configured")

    # Check cache
    cache_key = f"{effective_tenant}:{scope}"
    if cache_key in _token_cache:
        token, expiry = _token_cache[cache_key]
        if time.time() < expiry - 60:  # 60 second buffer
            return token

    # Request new token
    token_url = (
        f"https://login.microsoftonline.com/{effective_tenant}/oauth2/v2.0/token"
    )
    data = {
        "grant_type": "client_credentials",
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "scope": scope,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(token_url, data=data)

        if resp.status_code != 200:
            error_detail = resp.text[:500]
            logger.error(
                "Token acquisition failed for tenant=%s scope=%s: %s",
                effective_tenant[:8], scope, error_detail
            )
            raise RuntimeError(
                f"Auth failed (HTTP {resp.status_code}): {error_detail}"
            )

        result = resp.json()
        token = result["access_token"]
        expires_in = result.get("expires_in", 3600)

        # Cache the token
        _token_cache[cache_key] = (token, time.time() + expires_in)
        logger.info(
            "Token acquired: tenant=%s..., scope=%s, expires_in=%ds",
            effective_tenant[:8], scope.split("/")[2][:20], expires_in
        )
        return token


def clear_token_cache():
    """Clear the token cache (for testing or forced refresh)."""
    _token_cache.clear()
