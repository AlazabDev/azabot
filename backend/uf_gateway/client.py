"""
AzaBot <-> UberFix Unified Gateway client.

Server-side only. Use from FastAPI, Rasa SDK actions, or any trusted backend.
Never import this module into the React/Vite browser bundle because BOT_API_KEY
is a private server credential.
"""

from __future__ import annotations

import json
import os
import socket
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping


DEFAULT_GATEWAY_URL = "https://zrrffsjbfkphridqyais.supabase.co/functions/v1/bot-gateway"
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_SOURCE = "azabot"
DEFAULT_CHANNEL = "rasa"


class UFGatewayConfigurationError(RuntimeError):
    """Raised when required gateway settings are missing or invalid."""


class UFGatewayRequestError(RuntimeError):
    """Raised when the gateway cannot be reached or returns invalid data."""


@dataclass(frozen=True)
class UFGatewayConfig:
    endpoint: str
    api_key: str
    source: str = DEFAULT_SOURCE
    channel: str = DEFAULT_CHANNEL
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS

    @classmethod
    def from_env(cls) -> "UFGatewayConfig":
        endpoint = (
            os.getenv("UF_API_ENDPOINTS")
            or os.getenv("UF_API_ENDPOINT")
            or DEFAULT_GATEWAY_URL
        ).strip()
        api_key = (os.getenv("BOT_API_KEY") or os.getenv("UF_BOT_API_KEY") or "").strip()
        source = (os.getenv("UF_API_SOURCE") or DEFAULT_SOURCE).strip()
        channel = (os.getenv("UF_API_CHANNEL") or DEFAULT_CHANNEL).strip()
        timeout_raw = (os.getenv("UF_API_TIMEOUT_SECONDS") or str(DEFAULT_TIMEOUT_SECONDS)).strip()

        try:
            timeout_seconds = int(timeout_raw)
        except ValueError as exc:
            raise UFGatewayConfigurationError("UF_API_TIMEOUT_SECONDS must be an integer.") from exc

        if not endpoint.startswith("https://"):
            raise UFGatewayConfigurationError("UF_API_ENDPOINTS must be a valid HTTPS URL.")
        if not api_key:
            raise UFGatewayConfigurationError("BOT_API_KEY is missing on the backend environment.")

        return cls(
            endpoint=endpoint.rstrip("/"),
            api_key=api_key,
            source=source,
            channel=channel,
            timeout_seconds=timeout_seconds,
        )


class UFGatewayClient:
    def __init__(self, config: UFGatewayConfig | None = None) -> None:
        self.config = config or UFGatewayConfig.from_env()

    def call(
        self,
        action: str,
        payload: Mapping[str, Any] | None = None,
        *,
        session_id: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not action or not action.strip():
            raise ValueError("action is required")

        body = {
            "action": action.strip(),
            "payload": dict(payload or {}),
            "session_id": session_id,
            "metadata": {
                "source": self.config.source,
                "channel": self.config.channel,
                "client": "azabot",
                "host": _safe_hostname(),
                **dict(metadata or {}),
            },
        }

        request = urllib.request.Request(
            self.config.endpoint,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "x-api-key": self.config.api_key,
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "AzaBot-UFGateway/1.0",
            },
        )

        started = time.perf_counter()
        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                http_status = int(response.status)
        except urllib.error.HTTPError as exc:
            raw_error = exc.read().decode("utf-8", errors="replace")
            parsed_error = _parse_json(raw_error)
            message = _extract_error_message(parsed_error) or raw_error or str(exc.reason)
            raise UFGatewayRequestError(f"Gateway HTTP {exc.code}: {message}") from exc
        except urllib.error.URLError as exc:
            raise UFGatewayRequestError(f"Gateway network error: {exc.reason}") from exc
        except TimeoutError as exc:
            raise UFGatewayRequestError("Gateway request timed out.") from exc

        parsed = _parse_json(raw)
        if not isinstance(parsed, dict):
            raise UFGatewayRequestError("Gateway returned a non-object JSON response.")

        meta = parsed.get("_meta") if isinstance(parsed.get("_meta"), dict) else {}
        meta.update({
            "http_status": http_status,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            "action": action.strip(),
        })
        parsed["_meta"] = meta
        return parsed

    def list_services(self) -> dict[str, Any]:
        return self.call("list_services", {})

    def create_request(self, payload: Mapping[str, Any], *, session_id: str | None = None) -> dict[str, Any]:
        return self.call("create_request", payload, session_id=session_id)

    def check_status(self, search_term: str, search_type: str = "request_number") -> dict[str, Any]:
        return self.call("check_status", {"search_term": search_term, "search_type": search_type})

    def get_request_details(self, request_number: str, client_phone: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"request_number": request_number}
        if client_phone:
            payload["client_phone"] = client_phone
        return self.call("get_request_details", payload)

    def update_request(self, request_id: str, client_phone: str, updates: Mapping[str, Any]) -> dict[str, Any]:
        return self.call("update_request", {
            "request_id": request_id,
            "client_phone": client_phone,
            "updates": dict(updates),
        })

    def cancel_request(self, request_id: str, client_phone: str, reason: str) -> dict[str, Any]:
        return self.call("cancel_request", {
            "request_id": request_id,
            "client_phone": client_phone,
            "reason": reason,
        })

    def add_note(self, request_id: str, note: str, client_phone: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"request_id": request_id, "note": note}
        if client_phone:
            payload["client_phone"] = client_phone
        return self.call("add_note", payload)


def _parse_json(raw: str) -> Any:
    try:
        return json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as exc:
        raise UFGatewayRequestError("Gateway returned invalid JSON.") from exc


def _extract_error_message(parsed: Any) -> str | None:
    if not isinstance(parsed, dict):
        return None
    for key in ("error", "message", "detail"):
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _safe_hostname() -> str:
    try:
        return socket.gethostname()
    except Exception:
        return "unknown"
