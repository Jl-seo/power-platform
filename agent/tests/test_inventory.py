"""
Tests for the inventory module.

Uses mocked HTTP responses to test KQL query building and response parsing
without requiring actual Power Platform API access.
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# Mock the config before importing modules
import os
os.environ["TENANT_ID"] = "test-tenant-id-12345678"
os.environ["CLIENT_ID"] = "test-client-id-12345678"
os.environ["CLIENT_SECRET"] = "test-secret"

from core.config import reset_config, get_config
from core.kql_client import (
    KQLResponse,
    build_count_query,
    build_summary_by_type,
    build_resources_with_environment_join,
    build_resources_by_owner,
    build_recent_resources,
)


class TestKQLQueryBuilders:
    """Test that query builders produce correct KQL clause structures."""

    def test_count_query(self):
        clauses = build_count_query()
        assert len(clauses) == 1
        assert clauses[0]["$type"] == "count"

    def test_summary_by_type(self):
        clauses = build_summary_by_type()
        assert len(clauses) == 2
        assert clauses[0]["$type"] == "summarize"
        assert clauses[0]["SummarizeClauseExpression"]["OperatorName"] == "count"
        assert "type" in clauses[0]["SummarizeClauseExpression"]["FieldList"]
        assert clauses[1]["$type"] == "orderby"

    def test_resources_with_join_defaults(self):
        clauses = build_resources_with_environment_join()
        assert len(clauses) == 3
        assert clauses[0]["$type"] == "extend"
        assert clauses[1]["$type"] == "join"
        assert clauses[1]["JoinKind"] == "leftouter"
        assert clauses[2]["$type"] == "where"
        # Default should include canvas apps, model-driven, cloud flows, agents
        assert len(clauses[2]["Values"]) == 4

    def test_resources_with_join_custom_types(self):
        clauses = build_resources_with_environment_join(
            resource_types=["'microsoft.powerapps/canvasapps'"]
        )
        assert len(clauses[2]["Values"]) == 1

    def test_resources_by_owner(self):
        clauses = build_resources_by_owner("user-object-id-123")
        assert len(clauses) == 3
        assert clauses[0]["$type"] == "extend"
        assert clauses[1]["$type"] == "where"
        assert clauses[1]["Values"] == ["user-object-id-123"]
        assert clauses[2]["$type"] == "project"

    def test_recent_resources_default_7_days(self):
        clauses = build_recent_resources()
        assert clauses[1]["Values"] == ["ago(7d)"]

    def test_recent_resources_custom_days(self):
        clauses = build_recent_resources(days=30)
        assert clauses[1]["Values"] == ["ago(30d)"]


class TestKQLResponse:
    """Test KQLResponse dataclass."""

    def test_parse_basic_response(self):
        resp = KQLResponse(
            total_records=100,
            count=50,
            data=[{"name": "app1", "type": "canvasapps"}],
        )
        assert resp.total_records == 100
        assert resp.count == 50
        assert len(resp.data) == 1
        assert resp.result_truncated is False

    def test_parse_truncated_response(self):
        resp = KQLResponse(
            total_records=5000,
            count=1000,
            data=[],
            skip_token="abc123",
            result_truncated=True,
        )
        assert resp.result_truncated is True
        assert resp.skip_token == "abc123"


class TestConfig:
    """Test configuration loading."""

    def setup_method(self):
        reset_config()

    def test_config_loads_from_env(self):
        config = get_config()
        assert config.tenant_id == "test-tenant-id-12345678"
        assert config.client_id == "test-client-id-12345678"
        assert config.agent_version == "1.0.0"

    def test_config_singleton(self):
        config1 = get_config()
        config2 = get_config()
        assert config1 is config2

    def test_config_reset(self):
        config1 = get_config()
        reset_config()
        config2 = get_config()
        assert config1 is not config2
