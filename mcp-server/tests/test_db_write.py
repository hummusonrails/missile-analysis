# mcp-server/tests/test_db_write.py
"""Tests for Turso write operations."""
import hashlib
from db_write import hash_api_key, make_key_prefix


def test_hash_api_key():
    key = "sw_abc123def456"
    h = hash_api_key(key)
    assert h == hashlib.sha256(key.encode()).hexdigest()
    assert len(h) == 64


def test_hash_api_key_deterministic():
    key = "sw_test"
    assert hash_api_key(key) == hash_api_key(key)


def test_make_key_prefix():
    key = "sw_abcdefghijklmnop"
    assert make_key_prefix(key) == "sw_abcdef"


def test_make_key_prefix_short_key():
    key = "sw_ab"
    assert make_key_prefix(key) == "sw_ab"
