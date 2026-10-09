"""Minimal client for Groq's OpenAI-compatible chat API, using only the standard library.

Callers treat any `LLMError` as "the LLM is unavailable" and fall back to the built-in logic, so a
missing key, a network problem or a free-tier rate limit never breaks the app.
"""

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from app.core.config import get_settings

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """The LLM call failed or returned something unusable."""


def is_configured() -> bool:
    return bool(get_settings().groq_api_key.strip())


def chat_json(system: str, user: str, max_tokens: int = 2048) -> dict[str, Any]:
    """Sends one chat request in JSON mode and returns the parsed JSON object."""
    settings = get_settings()
    if not is_configured():
        raise LLMError("GROQ_API_KEY is not set")

    body = {
        "model": settings.groq_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    if settings.groq_model.startswith("openai/gpt-oss"):
        # Reasoning models: keep thinking short so the free-tier token budget goes to the answer.
        body["reasoning_effort"] = "low"
    request = urllib.request.Request(
        GROQ_CHAT_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.groq_api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "fireflies-clone/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.groq_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        result = json.loads(content)
    except urllib.error.HTTPError as exc:
        # 401 bad key, 413/429 rate or size limits, 5xx outages. Never log the key itself.
        logger.warning("Groq request failed with HTTP %s", exc.code)
        raise LLMError(f"Groq returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.warning("Groq request failed: %s", type(exc).__name__)
        raise LLMError("Groq is unreachable") from exc
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        logger.warning("Groq returned an unexpected response")
        raise LLMError("Unexpected response from Groq") from exc

    if not isinstance(result, dict):
        raise LLMError("Groq did not return a JSON object")
    return result
