"""Tests for payment access control."""
import time
import pytest
from payments import is_external, extract_bearer_token, _check_rate_limit, _rate_counters, sanitize_error


def test_is_external_with_matching_secret():
    assert is_external("correct-secret", "correct-secret") is True

def test_is_external_no_header():
    assert is_external(None, "correct-secret") is False

def test_is_external_wrong_secret():
    with pytest.raises(ValueError, match="Unauthorized"):
        is_external("wrong-secret", "correct-secret")

def test_is_external_no_env_secret():
    assert is_external(None, None) is False

def test_extract_bearer_token():
    assert extract_bearer_token("Bearer sw_abc123") == "sw_abc123"

def test_extract_bearer_token_no_bearer():
    assert extract_bearer_token("Basic abc") is None

def test_extract_bearer_token_empty():
    assert extract_bearer_token("") is None

def test_extract_bearer_token_none():
    assert extract_bearer_token(None) is None

def test_rate_limit_under():
    _rate_counters.clear()
    _check_rate_limit("test_under", 5)

def test_rate_limit_exceeded():
    _rate_counters.clear()
    for _ in range(10):
        _rate_counters["test_exceed"].append(time.time())
    with pytest.raises(ValueError, match="Rate limit exceeded"):
        _check_rate_limit("test_exceed", 10)

def test_rate_limit_expired_entries():
    _rate_counters.clear()
    old = time.time() - 120
    _rate_counters["test_old"] = [old] * 20
    _check_rate_limit("test_old", 5)

def test_sanitize_error_external():
    assert sanitize_error("Invalid or exhausted API key", is_ext=True) == "Request failed"

def test_sanitize_error_localhost():
    msg = "Invalid or exhausted API key"
    assert sanitize_error(msg, is_ext=False) == msg

def test_sanitize_error_rate_limit():
    assert sanitize_error("Rate limit exceeded", is_ext=True) == "Rate limit exceeded"

def test_sanitize_error_auth():
    assert sanitize_error("Authentication failed", is_ext=True) == "Authentication failed"
