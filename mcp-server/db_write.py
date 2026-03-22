# mcp-server/db_write.py
"""Turso write operations for API keys and usage logging.

Uses TURSO_WRITE_TOKEN (separate from the read-only token in db.py).
"""
import hashlib
import logging
import os
import time

import httpx

logger = logging.getLogger(__name__)


def _get_turso_url() -> str:
    url = os.environ["TURSO_DB_URL"].strip()
    return url.replace("libsql://", "https://")


def _get_write_token() -> str:
    return os.environ["TURSO_WRITE_TOKEN"].strip()


def hash_api_key(key: str) -> str:
    """SHA-256 hash of an API key for storage."""
    return hashlib.sha256(key.encode()).hexdigest()


def make_key_prefix(key: str) -> str:
    """First 9 chars of key for identification in logs."""
    return key[:9]


async def _execute_write(statements: list[dict]) -> dict:
    """Execute write statements against Turso HTTP API."""
    url = f"{_get_turso_url()}/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {_get_write_token()}",
        "Content-Type": "application/json",
    }
    body = {"requests": [{"type": "execute", "stmt": s} for s in statements]}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def create_tables():
    """Create api_keys and usage_log tables if they don't exist."""
    stmts = [
        {"sql": """CREATE TABLE IF NOT EXISTS api_keys (
            key_hash TEXT PRIMARY KEY,
            key_prefix TEXT NOT NULL,
            owner_email TEXT NOT NULL,
            credits_remaining INTEGER NOT NULL DEFAULT 1000,
            created_at INTEGER NOT NULL,
            revoked_at INTEGER,
            stripe_session_id TEXT UNIQUE
        )"""},
        {"sql": """CREATE TABLE IF NOT EXISTS usage_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_or_wallet TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )"""},
    ]
    await _execute_write(stmts)


async def insert_api_key(key: str, email: str, credits: int = 1000):
    """Insert a new API key (stored as SHA-256 hash)."""
    stmt = {
        "sql": "INSERT INTO api_keys (key_hash, key_prefix, owner_email, credits_remaining, created_at) VALUES (?, ?, ?, ?, ?)",
        "args": [
            {"type": "text", "value": hash_api_key(key)},
            {"type": "text", "value": make_key_prefix(key)},
            {"type": "text", "value": email},
            {"type": "integer", "value": str(credits)},
            {"type": "integer", "value": str(int(time.time() * 1000))},
        ],
    }
    await _execute_write([stmt])


async def validate_and_decrement(key: str) -> bool:
    """Validate API key and atomically decrement credits. Returns True if valid."""
    from db import parse_turso_response

    key_hash = hash_api_key(key)
    stmt = {
        "sql": "UPDATE api_keys SET credits_remaining = credits_remaining - 1 WHERE key_hash = ? AND credits_remaining > 0 AND revoked_at IS NULL",
        "args": [{"type": "text", "value": key_hash}],
    }
    data = await _execute_write([stmt])
    # Check affected rows
    result = data.get("results", [{}])[0].get("response", {}).get("result", {})
    affected = result.get("affected_row_count", 0)
    return affected > 0


async def log_usage(key_or_wallet: str, tool_name: str, payment_method: str):
    """Log a tool call to usage_log."""
    stmt = {
        "sql": "INSERT INTO usage_log (key_or_wallet, tool_name, payment_method, timestamp) VALUES (?, ?, ?, ?)",
        "args": [
            {"type": "text", "value": key_or_wallet},
            {"type": "text", "value": tool_name},
            {"type": "text", "value": payment_method},
            {"type": "integer", "value": str(int(time.time() * 1000))},
        ],
    }
    await _execute_write([stmt])


async def revoke_key(key: str):
    """Revoke an API key by setting revoked_at timestamp."""
    stmt = {
        "sql": "UPDATE api_keys SET revoked_at = ? WHERE key_hash = ?",
        "args": [
            {"type": "integer", "value": str(int(time.time() * 1000))},
            {"type": "text", "value": hash_api_key(key)},
        ],
    }
    await _execute_write([stmt])
