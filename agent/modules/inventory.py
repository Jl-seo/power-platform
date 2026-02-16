"""
Inventory module — resource discovery and enumeration.

Provides high-level functions for querying Power Platform resources
across environments, with summary aggregation.
"""
import logging
from typing import Any, Optional

from core.kql_client import (
    execute_kql,
    build_count_query,
    build_summary_by_type,
    build_summary_by_type_and_environment,
    build_resources_with_environment_join,
    build_resources_by_owner,
    build_recent_resources,
)

logger = logging.getLogger(__name__)


async def get_resource_summary(tenant_id: Optional[str] = None) -> dict[str, Any]:
    """
    Get a high-level summary of all Power Platform resources.

    Returns:
        {
            "total_count": 1250,
            "by_type": [
                {"type": "microsoft.powerapps/canvasapps", "resourceCount": 450},
                ...
            ]
        }
    """
    count_result = await execute_kql(build_count_query(), tenant_id=tenant_id)
    type_result = await execute_kql(build_summary_by_type(), tenant_id=tenant_id)

    total = 0
    if count_result.data:
        total = count_result.data[0].get("Count", count_result.total_records)

    return {
        "total_count": total,
        "by_type": type_result.data,
    }


async def get_resource_list(
    resource_types: Optional[list[str]] = None,
    top: int = 100,
    skip: int = 0,
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Get a detailed list of resources with environment JOIN.

    Args:
        resource_types: Filter by types (default: apps, flows, bots)
        top: Page size
        skip: Offset for pagination

    Returns:
        {
            "total_records": 1250,
            "count": 100,
            "has_more": true,
            "resources": [...]
        }
    """
    clauses = build_resources_with_environment_join(resource_types)
    result = await execute_kql(clauses, top=top, skip=skip, tenant_id=tenant_id)

    return {
        "total_records": result.total_records,
        "count": result.count,
        "has_more": result.result_truncated,
        "resources": result.data,
    }


async def get_environment_summary(tenant_id: Optional[str] = None) -> dict[str, Any]:
    """
    Get resource distribution across environments.

    Returns:
        {
            "environments": [
                {"environmentId": "env-guid", "resourceCount": 89},
                ...
            ]
        }
    """
    clauses = build_summary_by_type_and_environment()
    result = await execute_kql(clauses, tenant_id=tenant_id)

    return {
        "environments": result.data,
    }


async def get_owner_resources(
    owner_id: str,
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """Get all resources owned by a specific user."""
    clauses = build_resources_by_owner(owner_id)
    result = await execute_kql(clauses, tenant_id=tenant_id)

    return {
        "owner_id": owner_id,
        "count": result.count,
        "resources": result.data,
    }


async def get_recent_resources(
    days: int = 7,
    tenant_id: Optional[str] = None,
) -> dict[str, Any]:
    """Get resources created in the last N days."""
    clauses = build_recent_resources(days)
    result = await execute_kql(clauses, tenant_id=tenant_id)

    return {
        "period_days": days,
        "count": result.count,
        "resources": result.data,
    }
