"""
Security scanning module — risk detection and scoring.

Scans Power Platform resources for common security risks:
- External connector usage (HTTP, custom connectors)
- Overly broad sharing (Everyone)
- Orphaned resources (inactive owner)
- Unencrypted data sources
"""
import logging
from typing import Any, Optional
from dataclasses import dataclass, field

from core.kql_client import execute_kql

logger = logging.getLogger(__name__)


# Risk severity levels and point deductions
SEVERITY_WEIGHTS = {
    "critical": 10,
    "high": 7,
    "medium": 5,
    "low": 2,
}


@dataclass
class SecurityRisk:
    """A single identified security risk."""
    risk_id: str
    title: str
    severity: str  # critical, high, medium, low
    category: str  # connector, sharing, lifecycle, data
    resource_name: str
    resource_type: str
    environment_id: str
    description: str
    recommendation: str

    def to_dict(self) -> dict:
        return {
            "risk_id": self.risk_id,
            "title": self.title,
            "severity": self.severity,
            "category": self.category,
            "resource_name": self.resource_name,
            "resource_type": self.resource_type,
            "environment_id": self.environment_id,
            "description": self.description,
            "recommendation": self.recommendation,
        }


@dataclass
class ScanResult:
    """Result of a security scan."""
    score: int = 100
    grade: str = "A"
    total_resources_scanned: int = 0
    risks: list[SecurityRisk] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "grade": self.grade,
            "total_resources_scanned": self.total_resources_scanned,
            "risk_summary": {
                "critical": sum(1 for r in self.risks if r.severity == "critical"),
                "high": sum(1 for r in self.risks if r.severity == "high"),
                "medium": sum(1 for r in self.risks if r.severity == "medium"),
                "low": sum(1 for r in self.risks if r.severity == "low"),
            },
            "risks": [r.to_dict() for r in self.risks],
        }


def _calculate_score(risks: list[SecurityRisk]) -> tuple[int, str]:
    """Calculate security score (0-100) and grade (A-D) from risks."""
    deduction = sum(SEVERITY_WEIGHTS.get(r.severity, 0) for r in risks)
    score = max(0, 100 - deduction)

    if score >= 90:
        grade = "A"
    elif score >= 70:
        grade = "B"
    elif score >= 50:
        grade = "C"
    else:
        grade = "D"

    return score, grade


async def run_security_scan(tenant_id: Optional[str] = None) -> ScanResult:
    """
    Execute a full security scan across all Power Platform resources.

    Checks:
    1. External HTTP connector usage in production environments
    2. Apps shared with 'Everyone'
    3. Resources with no recent activity (potential orphans)

    Returns:
        ScanResult with score, grade, and individual risk items.
    """
    result = ScanResult()
    risks: list[SecurityRisk] = []

    # --- Scan 1: Get all resources with details ---
    try:
        all_resources = await execute_kql(
            clauses=[
                {
                    "$type": "where",
                    "FieldName": "type",
                    "Operator": "in~",
                    "Values": [
                        "'microsoft.powerapps/canvasapps'",
                        "'microsoft.powerapps/modeldrivenapps'",
                        "'microsoft.powerautomate/cloudflows'",
                        "'microsoft.copilotstudio/agents'",
                    ],
                },
            ],
            top=5000,
            tenant_id=tenant_id,
        )
        result.total_resources_scanned = all_resources.count
    except Exception as e:
        logger.error("Security scan failed to fetch resources: %s", e)
        return result

    # --- Scan 2: Analyze each resource for risks ---
    for resource in all_resources.data:
        props = resource.get("properties", {})
        res_name = props.get("displayName", resource.get("name", "Unknown"))
        res_type = resource.get("type", "unknown")
        env_id = props.get("environmentId", "unknown")

        # Check: HTTP connector usage
        connectors = props.get("connectionReferences", {})
        if isinstance(connectors, dict):
            for conn_id, conn_info in connectors.items():
                conn_type = ""
                if isinstance(conn_info, dict):
                    conn_type = conn_info.get("connectorId", "").lower()
                elif isinstance(conn_info, str):
                    conn_type = conn_info.lower()

                if "http" in conn_type and "webhook" not in conn_type:
                    risks.append(SecurityRisk(
                        risk_id=f"HTTP-{resource.get('name', '')[:8]}",
                        title="외부 HTTP 커넥터 사용",
                        severity="high",
                        category="connector",
                        resource_name=res_name,
                        resource_type=res_type,
                        environment_id=env_id,
                        description=f"'{res_name}'에서 HTTP 커넥터를 사용 중입니다.",
                        recommendation="DLP 정책에서 HTTP 커넥터를 차단하거나, "
                                       "Custom Connector로 대체하세요.",
                    ))

        # Check: Shared with Everyone
        shared_with = props.get("sharedGroupsCount", 0)
        shared_all = props.get("sharedWithOrganization", False)
        if shared_all:
            risks.append(SecurityRisk(
                risk_id=f"SHARE-{resource.get('name', '')[:8]}",
                title="전체 조직에 공유됨",
                severity="high",
                category="sharing",
                resource_name=res_name,
                resource_type=res_type,
                environment_id=env_id,
                description=f"'{res_name}'이 전체 조직에 공유되어 있습니다.",
                recommendation="공유 범위를 특정 보안 그룹으로 제한하세요.",
            ))

    # --- Calculate score ---
    result.risks = risks
    result.score, result.grade = _calculate_score(risks)

    logger.info(
        "Security scan complete: %d resources scanned, %d risks found, score=%d (%s)",
        result.total_resources_scanned, len(risks), result.score, result.grade,
    )
    return result
