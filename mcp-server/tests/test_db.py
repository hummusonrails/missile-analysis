"""Tests for Turso database client."""
import json
import pytest
from unittest.mock import AsyncMock, patch

from db import parse_alert_row, parse_turso_response


def test_parse_alert_row_valid():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": '["מודיעין-מכבים-רעות", "תל אביב"]',
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is not None
    assert result["cities"] == ["מודיעין-מכבים-רעות", "תל אביב"]
    assert result["timestamp"] == 1700000000000
    assert result["threat"] == 0


def test_parse_alert_row_malformed_json():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": "not valid json",
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is None


def test_parse_alert_row_none_cities():
    row = {
        "id": "123_1700000000000",
        "timestamp": 1700000000000,
        "cities": None,
        "threat": 0,
        "created_at": 1700000000000,
    }
    result = parse_alert_row(row)
    assert result is None


def test_parse_turso_response_extracts_rows():
    response_json = {
        "results": [
            {
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [
                            {"name": "id"},
                            {"name": "timestamp"},
                            {"name": "cities"},
                            {"name": "threat"},
                            {"name": "created_at"},
                        ],
                        "rows": [
                            [
                                {"type": "text", "value": "1_1700000000000"},
                                {"type": "integer", "value": "1700000000000"},
                                {"type": "text", "value": '["מודיעין-מכבים-רעות"]'},
                                {"type": "integer", "value": "0"},
                                {"type": "integer", "value": "1700000000000"},
                            ]
                        ],
                    },
                }
            }
        ]
    }
    rows = parse_turso_response(response_json)
    assert len(rows) == 1
    assert rows[0]["id"] == "1_1700000000000"
    assert rows[0]["timestamp"] == 1700000000000
    assert rows[0]["cities"] == '["מודיעין-מכבים-רעות"]'


def test_parse_turso_response_empty():
    response_json = {
        "results": [
            {
                "response": {
                    "type": "execute",
                    "result": {
                        "cols": [
                            {"name": "id"},
                            {"name": "timestamp"},
                            {"name": "cities"},
                            {"name": "threat"},
                            {"name": "created_at"},
                        ],
                        "rows": [],
                    },
                }
            }
        ]
    }
    rows = parse_turso_response(response_json)
    assert len(rows) == 0
