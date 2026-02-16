"""
Power Platform Inventory API client using KQL queries.

Provides typed wrappers around the Inventory API for common query patterns.
Query structures are based on patterns from docs/02-kql-queries.md.
"""
import logging
from typing import Any, Optional
from dataclasses import dataclass

import httpx

from .auth import get_access_token, SCOPE_POWER_PLATFORM
from .config import get_config

logger = logging.getLogger(__name__)


@dataclass
class KQLResponse:
    """Parsed response from the Inventory API."""
    total_records: int
    count: int
    data: list[dict[str, Any]]
    skip_token: Optional[str] = None
    result_truncated: bool = False


async def execute_kql(
    clauses: list[dict[str, Any]],
    table_name: str = "PowerPlatformResources",
    top: int = 1000,
    skip: int = 0,
    tenant_id: Optional[str] = None,
) -> KQLResponse:
    """
    Execute a KQL query against the Power Platform Inventory API.

    Args:
        clauses: List of KQL clause objects (where, summarize, extend, etc.)
        table_name: Table to query (default: PowerPlatformResources)
        top: Maximum results to return
        skip: Number of results to skip (pagination)
        tenant_id: Override tenant for multi-tenant

    Returns:
        KQLResponse with parsed results
    """
    config = get_config()
    token = await get_access_token(SCOPE_POWER_PLATFORM, tenant_id)

    body: dict[str, Any] = {
        "TableName": table_name,
        "Clauses": clauses,
    }
    if top or skip:
        body["Options"] = {"Top": top, "Skip": skip}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            config.inventory_api_endpoint,
            json=body,
            headers={"Authorization": f"Bearer {token}"},
        )

        if resp.status_code != 200:
            logger.error(
                "KQL query failed (HTTP %d): %s", resp.status_code, resp.text[:500]
            )
            raise RuntimeError(
                f"Inventory API error (HTTP {resp.status_code}): {resp.text[:500]}"
            )

        result = resp.json()
        return KQLResponse(
            total_records=result.get("totalRecords", 0),
            count=result.get("count", 0),
            data=result.get("data", []),
            skip_token=result.get("skipToken"),
            result_truncated=result.get("resultTruncated", 0) == 1,
        )


# === Pre-built KQL Query Builders ===


def build_count_query() -> list[dict]:
    """Total resource count."""
    return [{"$type": "count"}]


def build_summary_by_type() -> list[dict]:
    """Resource count grouped by type."""
    return [
        {
            "$type": "summarize",
            "SummarizeClauseExpression": {
                "OperatorName": "count",
                "OperatorFieldName": "resourceCount",
                "FieldList": ["type"],
            },
        },
        {
            "$type": "orderby",
            "FieldNamesAscDesc": {"resourceCount": "desc"},
        },
    ]


def build_summary_by_type_and_environment() -> list[dict]:
    """Resource count grouped by type and environment."""
    return [
        {
            "$type": "summarize",
            "SummarizeClauseExpression": {
                "OperatorName": "count",
                "OperatorFieldName": "resourceCount",
                "FieldList": ["type", "location"],
            },
        },
        {
            "$type": "orderby",
            "FieldNamesAscDesc": {"resourceCount": "desc"},
        },
    ]


def build_resources_with_environment_join(
    resource_types: Optional[list[str]] = None,
) -> list[dict]:
    """
    Full resource list with environment name JOIN.
    Based on KQL query pattern #6 from docs/02-kql-queries.md.
    """
    types = resource_types or [
        "'microsoft.powerapps/canvasapps'",
        "'microsoft.powerapps/modeldrivenapps'",
        "'microsoft.powerautomate/cloudflows'",
        "'microsoft.copilotstudio/agents'",
    ]

    return [
        {
            "$type": "extend",
            "FieldName": "joinKey",
            "Expression": "tolower(tostring(properties.environmentId))",
        },
        {
            "$type": "join",
            "JoinKind": "leftouter",
            "RightTable": {
                "TableName": "PowerPlatformResources",
                "Clauses": [
                    {
                        "$type": "where",
                        "FieldName": "type",
                        "Operator": "==",
                        "Values": ["'microsoft.powerplatform/environments'"],
                    },
                    {
                        "$type": "project",
                        "FieldList": [
                            "joinKey = tolower(name)",
                            "environmentName = properties.displayName",
                            "environmentType = properties.environmentType",
                        ],
                    },
                ],
            },
            "LeftColumnName": "joinKey",
            "RightColumnName": "joinKey",
        },
        {
            "$type": "where",
            "FieldName": "type",
            "Operator": "in~",
            "Values": types,
        },
    ]


def build_resources_by_owner(owner_id: str) -> list[dict]:
    """Resources owned by a specific user. Based on KQL query #5."""
    return [
        {
            "$type": "extend",
            "FieldName": "ownerId",
            "Expression": "tostring(properties.ownerId)",
        },
        {
            "$type": "where",
            "FieldName": "ownerId",
            "Operator": "==",
            "Values": [owner_id],
        },
        {
            "$type": "project",
            "FieldList": [
                "name",
                "type",
                "properties.displayName",
                "properties.environmentId",
                "properties.createdAt",
            ],
        },
    ]


def build_recent_resources(days: int = 7) -> list[dict]:
    """Resources created in the last N days. Based on KQL query #4."""
    return [
        {
            "$type": "extend",
            "FieldName": "createdAt",
            "Expression": "todatetime(properties.createdAt)",
        },
        {
            "$type": "where",
            "FieldName": "createdAt",
            "Operator": ">=",
            "Values": [f"ago({days}d)"],
        },
        {
            "$type": "project",
            "FieldList": [
                "name",
                "type",
                "properties.displayName",
                "properties.environmentId",
                "properties.ownerId",
                "properties.createdAt",
            ],
        },
        {
            "$type": "orderby",
            "FieldNamesAscDesc": {"createdAt": "desc"},
        },
    ]
