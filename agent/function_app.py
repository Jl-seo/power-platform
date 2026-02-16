"""
Power Platform CoE Governance Agent — Azure Functions Entry Point

All HTTP endpoints and timer triggers are defined here.
Business logic is delegated to modules/ for separation of concerns.
"""
import json
import logging
import datetime

import azure.functions as func

from core.config import get_config
from modules import inventory, security, governance

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

logger = logging.getLogger(__name__)


# ============================================================
# Health & System
# ============================================================

@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
async def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint — no auth required."""
    config = get_config()
    return func.HttpResponse(
        json.dumps({
            "status": "healthy",
            "service": "CoE Governance Agent",
            "version": config.agent_version,
            "tenant_configured": bool(config.tenant_id),
            "keyvault_configured": bool(config.key_vault_url),
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        }),
        mimetype="application/json",
    )


# ============================================================
# Inventory Module
# ============================================================

@app.route(route="inventory/summary", methods=["GET"])
async def inventory_summary(req: func.HttpRequest) -> func.HttpResponse:
    """Get high-level resource summary (total count + by type)."""
    try:
        tenant_id = req.params.get("tenant_id")
        result = await inventory.get_resource_summary(tenant_id)
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("inventory/summary failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="inventory/resources", methods=["GET"])
async def inventory_resources(req: func.HttpRequest) -> func.HttpResponse:
    """Get detailed resource list with environment info."""
    try:
        top = int(req.params.get("top", "100"))
        skip = int(req.params.get("skip", "0"))
        tenant_id = req.params.get("tenant_id")

        result = await inventory.get_resource_list(
            top=min(top, 1000),  # Cap at 1000
            skip=skip,
            tenant_id=tenant_id,
        )
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("inventory/resources failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="inventory/environments", methods=["GET"])
async def inventory_environments(req: func.HttpRequest) -> func.HttpResponse:
    """Get resource distribution across environments."""
    try:
        tenant_id = req.params.get("tenant_id")
        result = await inventory.get_environment_summary(tenant_id)
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("inventory/environments failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="inventory/recent", methods=["GET"])
async def inventory_recent(req: func.HttpRequest) -> func.HttpResponse:
    """Get recently created resources."""
    try:
        days = int(req.params.get("days", "7"))
        tenant_id = req.params.get("tenant_id")
        result = await inventory.get_recent_resources(days=days, tenant_id=tenant_id)
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("inventory/recent failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


# ============================================================
# Security Module
# ============================================================

@app.route(route="security/scan", methods=["POST"])
async def security_scan(req: func.HttpRequest) -> func.HttpResponse:
    """Execute a security scan and return risks + score."""
    try:
        tenant_id = req.params.get("tenant_id")
        result = await security.run_security_scan(tenant_id)
        return func.HttpResponse(
            json.dumps(result.to_dict(), ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("security/scan failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="security/score", methods=["GET"])
async def security_score(req: func.HttpRequest) -> func.HttpResponse:
    """Get the latest security score (runs a scan if needed)."""
    try:
        tenant_id = req.params.get("tenant_id")
        result = await security.run_security_scan(tenant_id)
        return func.HttpResponse(
            json.dumps({
                "score": result.score,
                "grade": result.grade,
                "total_resources_scanned": result.total_resources_scanned,
                "risk_summary": result.to_dict()["risk_summary"],
            }, ensure_ascii=False),
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("security/score failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


# ============================================================
# Governance Module
# ============================================================

@app.route(route="governance/quarantine", methods=["POST"])
async def governance_quarantine(req: func.HttpRequest) -> func.HttpResponse:
    """Quarantine or release a canvas app."""
    try:
        body = req.get_json()
        result = await governance.quarantine_app(
            environment_id=body["environment_id"],
            app_id=body["app_id"],
            quarantine=body.get("quarantine", True),
            reason=body.get("reason", ""),
            tenant_id=body.get("tenant_id"),
        )
        status = 200 if result["success"] else 400
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            status_code=status,
            mimetype="application/json",
        )
    except (ValueError, KeyError) as e:
        return func.HttpResponse(
            json.dumps({"error": f"Invalid request body: {e}"}),
            status_code=400,
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("governance/quarantine failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="governance/transfer", methods=["POST"])
async def governance_transfer(req: func.HttpRequest) -> func.HttpResponse:
    """Transfer ownership of a single app or bulk transfer by owner."""
    try:
        body = req.get_json()

        # Bulk transfer: old_owner_id + new_owner_id
        if "old_owner_id" in body:
            result = await governance.bulk_transfer_by_owner(
                old_owner_id=body["old_owner_id"],
                new_owner_id=body["new_owner_id"],
                tenant_id=body.get("tenant_id"),
            )
        # Single transfer: environment_id + app_id + new_owner_id
        else:
            result = await governance.transfer_app_ownership(
                environment_id=body["environment_id"],
                app_id=body["app_id"],
                new_owner_id=body["new_owner_id"],
                tenant_id=body.get("tenant_id"),
            )

        status = 200 if result.get("success", result.get("transferred", 0) > 0) else 400
        return func.HttpResponse(
            json.dumps(result, ensure_ascii=False),
            status_code=status,
            mimetype="application/json",
        )
    except (ValueError, KeyError) as e:
        return func.HttpResponse(
            json.dumps({"error": f"Invalid request body: {e}"}),
            status_code=400,
            mimetype="application/json",
        )
    except Exception as e:
        logger.exception("governance/transfer failed")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


# ============================================================
# Scheduled Tasks (Timer Triggers)
# ============================================================

@app.timer_trigger(
    schedule="0 0 9 * * *",  # Daily at 09:00 UTC
    arg_name="timer",
    run_on_startup=False,
)
async def daily_scan(timer: func.TimerRequest) -> None:
    """Daily scheduled security scan."""
    logger.info("Daily security scan started")

    try:
        result = await security.run_security_scan()
        logger.info(
            "Daily scan complete: score=%d, grade=%s, risks=%d",
            result.score, result.grade, len(result.risks),
        )

        # TODO Phase 4: Report results to Control Plane
        # config = get_config()
        # if config.control_plane_url:
        #     await report_to_control_plane(result)

    except Exception as e:
        logger.exception("Daily security scan failed: %s", e)
