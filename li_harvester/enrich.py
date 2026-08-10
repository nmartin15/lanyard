"""BetterContact waterfall enrichment (email only in v1)."""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests

from li_harvester.models import Lead

log = logging.getLogger(__name__)

BASE_URL = "https://app.bettercontact.rocks/api/v2"
BATCH_SIZE = 100
DEFAULT_POLL_SECONDS = 10
DEFAULT_TIMEOUT_SECONDS = 900

STATUS_MAP = {
    "deliverable": "Valid",
    "catch_all_safe": "Catch-All",
    "catch_all_not_safe": "Catch-All",
    "catch_all": "Catch-All",
    "undeliverable": "Invalid",
    "invalid": "Invalid",
}


class BetterContactError(RuntimeError):
    pass


def map_email_status(provider_status: str | None, email: str | None) -> str:
    if not email:
        return "Not Found"
    if not provider_status:
        return "Valid"  # email returned without status — treat as usable
    key = provider_status.strip().lower().replace(" ", "_")
    return STATUS_MAP.get(key, "Catch-All")


class BetterContactClient:
    def __init__(
        self,
        api_key: str,
        *,
        poll_seconds: float = DEFAULT_POLL_SECONDS,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self.api_key = api_key
        self.poll_seconds = poll_seconds
        self.timeout_seconds = timeout_seconds
        self.session = requests.Session()
        self.session.headers.update(
            {
                "X-API-Key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        retries: int = 5,
    ) -> Any:
        url = f"{BASE_URL}{path}"
        delay = 2.0
        last_err: Exception | None = None
        for attempt in range(retries):
            try:
                resp = self.session.request(method, url, json=json_body, timeout=60)
                if resp.status_code == 429:
                    log.warning("BetterContact rate limited; backoff %.1fs", delay)
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                if resp.status_code >= 500:
                    log.warning("BetterContact %s; backoff %.1fs", resp.status_code, delay)
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                if not resp.ok:
                    raise BetterContactError(
                        f"BetterContact {resp.status_code}: {resp.text[:500]}"
                    )
                if not resp.content:
                    return None
                return resp.json()
            except requests.RequestException as exc:
                last_err = exc
                if attempt < retries - 1:
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                raise BetterContactError(str(exc)) from exc
        raise BetterContactError(str(last_err))

    def submit_email_batch(self, leads: list[Lead]) -> str:
        data = []
        for lead in leads:
            last = lead.last_name.strip() or lead.first_name or "Unknown"
            first = lead.first_name.strip() or "Unknown"
            data.append(
                {
                    "first_name": first,
                    "last_name": last,
                    "linkedin_url": lead.linkedin_url,
                    "custom_fields": {"uuid": lead.lead_id},
                }
            )
        payload = {
            "data": data,
            "enrich_email_address": True,
            "enrich_phone_number": False,
        }
        result = self._request("POST", "/async", json_body=payload)
        request_id = (result or {}).get("id") or (result or {}).get("request_id")
        if not request_id:
            raise BetterContactError(f"No request id in response: {result}")
        return str(request_id)

    def get_result(self, request_id: str) -> dict:
        return self._request("GET", f"/async/{request_id}") or {}

    def wait_for_result(self, request_id: str) -> dict:
        deadline = time.time() + self.timeout_seconds
        while time.time() < deadline:
            result = self.get_result(request_id)
            status = str(result.get("status", "")).lower()
            if status in {"terminated", "completed", "done", "finished", "success"}:
                return result
            if status in {"failed", "error"}:
                raise BetterContactError(f"Enrichment failed: {result}")
            time.sleep(self.poll_seconds)
        raise BetterContactError(
            f"Enrichment timed out after {self.timeout_seconds}s (id={request_id})"
        )


def apply_enrichment_results(leads: list[Lead], result: dict) -> int:
    """Merge BetterContact result into leads. Returns credits_consumed if present."""
    by_id = {lead.lead_id: lead for lead in leads}
    rows = result.get("data") or []
    for row in rows:
        if not isinstance(row, dict):
            continue
        custom = row.get("custom_fields") or {}
        lead_id = custom.get("uuid") or custom.get("lead_id")
        lead: Optional[Lead] = by_id.get(str(lead_id)) if lead_id else None
        if lead is None:
            # Fallback match on LinkedIn URL
            url = (row.get("linkedin_url") or row.get("contact_linkedin_url") or "").rstrip(
                "/"
            ).lower()
            for candidate in leads:
                if candidate.linkedin_url.rstrip("/").lower() == url:
                    lead = candidate
                    break
        if lead is None:
            continue

        email = row.get("contact_email_address") or row.get("email")
        status_raw = row.get("contact_email_address_status") or row.get("email_status")
        enriched = row.get("enriched")
        if enriched is False and not email:
            lead.email = None
            lead.email_status = "Not Found"
            continue
        lead.email = str(email).strip() if email else None
        lead.email_status = map_email_status(str(status_raw) if status_raw else None, lead.email)

    # Any lead still unset → Not Found (timeout partials handled by caller)
    for lead in leads:
        if not lead.email_status:
            lead.email_status = "Not Found"

    try:
        return int(result.get("credits_consumed") or 0)
    except (TypeError, ValueError):
        return 0


def enrich_leads_email_only(
    client: BetterContactClient,
    leads: list[Lead],
) -> tuple[list[Lead], int]:
    """
    Enrich leads via BetterContact in chunks of 100.
    On timeout/error for a chunk, leave those leads as Not Found and continue.
    Returns (leads, total_credits_consumed).
    """
    if not leads:
        return leads, 0

    total_credits = 0
    for i in range(0, len(leads), BATCH_SIZE):
        chunk = leads[i : i + BATCH_SIZE]
        try:
            request_id = client.submit_email_batch(chunk)
            log.info(
                "BetterContact submitted batch %d-%d request_id=%s",
                i + 1,
                i + len(chunk),
                request_id,
            )
            result = client.wait_for_result(request_id)
            total_credits += apply_enrichment_results(chunk, result)
        except BetterContactError as exc:
            log.error("BetterContact batch failed: %s — marking Not Found", exc)
            for lead in chunk:
                if not lead.email_status:
                    lead.email = None
                    lead.email_status = "Not Found"
    return leads, total_credits
