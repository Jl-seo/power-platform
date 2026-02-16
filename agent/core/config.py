"""
Configuration loader for the CoE Governance Agent.

Loads settings from Key Vault (production) or environment variables (local dev).
"""
import os
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Agent configuration loaded from Key Vault or environment variables."""
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    key_vault_url: str = ""
    control_plane_url: str = ""
    agent_version: str = "1.0.0"
    isv_frontend_url: str = ""

    # Power Platform API
    inventory_api_endpoint: str = (
        "https://api.powerplatform.com/resourcequery/resources/query"
        "?api-version=2024-10-01"
    )
    admin_api_endpoint: str = "https://api.powerplatform.com"

    # Graph API (for license & user info)
    graph_api_endpoint: str = "https://graph.microsoft.com/v1.0"


_config: Optional[AgentConfig] = None


def _get_secret(secret_name: str, key_vault_url: str) -> str:
    """Retrieve a secret from Key Vault or fall back to environment variable."""
    if key_vault_url:
        try:
            from azure.identity import DefaultAzureCredential
            from azure.keyvault.secrets import SecretClient

            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=key_vault_url, credential=credential)
            secret = client.get_secret(secret_name)
            return secret.value or ""
        except Exception as e:
            logger.warning(
                "Key Vault lookup failed for '%s', falling back to env var: %s",
                secret_name, e
            )

    # Fallback: environment variable (convert KEY-VAULT-NAME to ENV_VAR_NAME)
    env_name = secret_name.replace("-", "_").upper()
    value = os.getenv(env_name, "")
    if not value:
        logger.warning("Secret '%s' not found in Key Vault or env var '%s'", secret_name, env_name)
    return value


def get_config() -> AgentConfig:
    """Get or create the agent configuration singleton."""
    global _config
    if _config is not None:
        return _config

    key_vault_url = os.getenv("KEY_VAULT_URL", "")

    _config = AgentConfig(
        tenant_id=_get_secret("TENANT-ID", key_vault_url),
        client_id=_get_secret("CLIENT-ID", key_vault_url),
        client_secret=_get_secret("CLIENT-SECRET", key_vault_url),
        key_vault_url=key_vault_url,
        control_plane_url=os.getenv("CONTROL_PLANE_URL", ""),
        agent_version=os.getenv("AGENT_VERSION", "1.0.0"),
        isv_frontend_url=os.getenv("ISV_FRONTEND_URL", ""),
    )

    logger.info(
        "Agent config loaded: tenant=%s, version=%s, kv=%s",
        _config.tenant_id[:8] + "..." if _config.tenant_id else "N/A",
        _config.agent_version,
        "KeyVault" if key_vault_url else "EnvVar",
    )
    return _config


def reset_config():
    """Reset config singleton (for testing)."""
    global _config
    _config = None
