"""Tier1Firms → people-at-company → Tier1People (separate from Influencers harvest).

Guardrails (env-tunable): one firm per run by default, employee cap, inter-firm delay,
~6-month cooldown after a scrape (PEOPLE_FIRM_COOLDOWN_DAYS), auto-deactivate Active after success.
"""

from __future__ import annotations

import logging
import sys
import time
from datetime import date, datetime, timedelta, timezone

from li_harvester import config
from li_harvester.apify import ApifyClient, ApifyError, fetch_employees_for_company
from li_harvester.config import Settings, load_settings
from li_harvester.filters import drop_people_headline, drop_people_icp_title
from li_harvester.models import CompanyPerson, Influencer
from li_harvester.normalize import normalize_linkedin_url
from li_harvester.sheets import build_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_run_at(value: str) -> datetime | None:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(text.replace("+0000", "+00:00"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _in_cooldown(firm: Influencer, *, now: datetime) -> bool:
    hours = config.PEOPLE_FIRM_COOLDOWN_HOURS
    if hours <= 0:
        return False
    last = _parse_run_at(firm.last_run_at)
    if not last:
        return False
    return now - last < timedelta(hours=hours)


def _select_firms(firms: list[Influencer], *, now: datetime) -> list[Influencer]:
    """Apply cooldown + max-firms-per-run guardrails."""
    ready: list[Influencer] = []
    for firm in firms:
        if _in_cooldown(firm, now=now):
            days = max(1, round(config.PEOPLE_FIRM_COOLDOWN_HOURS / 24))
            log.warning(
                "Skip %s — cooldown ~%dd (last_run_at=%s). Tier1People is intentionally rare.",
                firm.name,
                days,
                firm.last_run_at,
            )
            continue
        ready.append(firm)

    limit = max(1, config.MAX_FIRMS_PER_PEOPLE_RUN)
    if len(ready) > limit:
        skipped = ready[limit:]
        ready = ready[:limit]
        log.warning(
            "Guardrail: only scraping %d firm(s) this run (MAX_FIRMS_PER_PEOPLE_RUN=%d). "
            "Left for later: %s",
            limit,
            limit,
            ", ".join(f.name for f in skipped),
        )
    return ready


def run_people_pipeline(settings: Settings) -> int:
    started = datetime.now(timezone.utc)
    today = date.today().isoformat()
    log.info(
        "Starting Tier1 people run dry_run=%s spreadsheet=%s "
        "max_per_firm=%d (hard_cap=%d) max_firms=%d delay=%ds cooldown_days=%d auto_off=%s",
        settings.dry_run,
        settings.spreadsheet_id or "(none)",
        config.MAX_EMPLOYEES_PER_FIRM,
        config.MAX_EMPLOYEES_PER_FIRM_HARD_CAP,
        config.MAX_FIRMS_PER_PEOPLE_RUN,
        config.PEOPLE_FIRM_DELAY_SECONDS,
        max(1, round(config.PEOPLE_FIRM_COOLDOWN_HOURS / 24)),
        config.PEOPLE_AUTO_DEACTIVATE,
    )

    sheets = build_client(settings)
    if not settings.dry_run:
        sheets.ensure_workbook()

    active = [f for f in sheets.read_tier1_firms() if f.active]
    if not active:
        log.error("No active firms on Tier1Firms. Add company URLs and set Active=TRUE.")
        return 1

    firms = _select_firms(active, now=started)
    if not firms:
        log.error(
            "All active firms are in cooldown (~%dd). "
            "Wait, or set PEOPLE_FIRM_COOLDOWN_DAYS=0 to override.",
            max(1, round(config.PEOPLE_FIRM_COOLDOWN_HOURS / 24)),
        )
        return 1

    try:
        seen = sheets.load_tier1_people_urls()
    except Exception:  # noqa: BLE001
        seen = set()
    apify = ApifyClient(settings.apify_token)
    all_new: list[CompanyPerson] = []
    errors: list[str] = []
    per_firm: dict[int, tuple[str, int, str]] = {}
    scraped: list[Influencer] = []

    for idx, firm in enumerate(firms):
        if idx > 0 and config.PEOPLE_FIRM_DELAY_SECONDS > 0:
            log.info(
                "Guardrail delay %ds before next firm…",
                config.PEOPLE_FIRM_DELAY_SECONDS,
            )
            time.sleep(config.PEOPLE_FIRM_DELAY_SECONDS)
        try:
            # ICP title filtering is local — Apify job_title often returns 0 for hedge funds.
            people = fetch_employees_for_company(
                apify,
                company_url=firm.profile_url,
                firm_name=firm.name,
                max_employees=config.MAX_EMPLOYEES_PER_FIRM,
                date_added=today,
                job_title="",
            )
            kept: list[CompanyPerson] = []
            dropped = 0
            for person in people:
                url = normalize_linkedin_url(person.linkedin_url)
                if not url or url in seen:
                    continue
                ban = drop_people_headline(person.headline)
                if not ban and firm.title_mode == "ICP":
                    ban = drop_people_icp_title(person.headline)
                if ban:
                    dropped += 1
                    log.info(
                        "Drop %s %s (%s) — %s",
                        person.first_name,
                        person.last_name,
                        person.headline,
                        ban,
                    )
                    continue
                seen.add(url)
                kept.append(person)
            all_new.extend(kept)
            per_firm[firm.row_index] = ("ok", len(kept), "")
            scraped.append(firm)
            log.info(
                "Firm %s: title_mode=%s fetched=%d new=%d dropped_title=%d",
                firm.name,
                firm.title_mode or "all",
                len(people),
                len(kept),
                dropped,
            )
        except ApifyError as exc:
            msg = f"{firm.name}: {exc}"
            log.error(msg)
            errors.append(msg)
            per_firm[firm.row_index] = ("error", 0, str(exc))
            scraped.append(firm)

    finished = _iso(datetime.now(timezone.utc))
    started_iso = _iso(started)

    if settings.dry_run:
        print("\n=== DRY RUN — Tier1People (no writes) ===")
        print(f"firms_selected: {len(firms)}")
        print(f"new_people: {len(all_new)}")
        print(f"errors: {errors}")
        print(
            "guardrails: "
            f"max_per_firm={config.MAX_EMPLOYEES_PER_FIRM} "
            f"max_firms={config.MAX_FIRMS_PER_PEOPLE_RUN} "
            f"delay={config.PEOPLE_FIRM_DELAY_SECONDS}s "
            f"cooldown_days={max(1, round(config.PEOPLE_FIRM_COOLDOWN_HOURS / 24))}"
        )
        print("\nWould write people (first 20):")
        for person in all_new[:20]:
            line = (
                f"  {person.first_name} {person.last_name} | {person.headline[:80]} | "
                f"{person.linkedin_url} | {person.firm_name}"
            )
            print(line.encode("ascii", "replace").decode("ascii"))
        if len(all_new) > 20:
            print(f"  ... and {len(all_new) - 20} more")
        return 0 if not (errors and not all_new) else 1

    try:
        sheets.append_tier1_people(all_new)
        for firm in scraped:
            status, delta, err = per_firm.get(firm.row_index, ("ok", 0, ""))
            sheets.update_tier1_firm_run(
                firm,
                last_run_at=finished,
                status=status if not err else f"{status}: {err}"[:200],
                people_delta=delta,
            )
            if config.PEOPLE_AUTO_DEACTIVATE and status == "ok":
                sheets.set_tier1_firm_active(firm, active=False)
                log.info("Auto-deactivated %s (set Active=TRUE for next intentional run)", firm.name)
    except Exception as exc:  # noqa: BLE001
        log.exception("Failed writing Tier1People")
        sheets.dump_failed_run(
            f"tier1-people-{started_iso.replace(':', '')}",
            {
                "people": [p.to_sheet_row() for p in all_new],
                "errors": errors + [str(exc)],
            },
            settings.failed_runs_dir,
        )
        return 1

    log.info(
        "Tier1 people done new=%d errors=%d",
        len(all_new),
        len(errors),
    )
    return 0 if not (errors and not all_new) else 1


def main(argv: list[str] | None = None) -> None:
    _ = argv
    settings = load_settings(require_apify=True, require_sheet=True)
    raise SystemExit(run_people_pipeline(settings))


if __name__ == "__main__":
    main(sys.argv[1:])
