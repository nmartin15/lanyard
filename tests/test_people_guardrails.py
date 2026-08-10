from datetime import datetime, timedelta, timezone

from li_harvester.models import Influencer
from li_harvester.people_runner import _in_cooldown, _select_firms


def _firm(name: str, *, last_run_at: str = "", active: bool = True) -> Influencer:
    return Influencer(
        row_index=2,
        name=name,
        profile_url=f"https://www.linkedin.com/company/{name.lower()}/",
        active=active,
        last_run_at=last_run_at,
    )


def test_cooldown_skips_recent_firm(monkeypatch):
    # 180 days ≈ 6 months
    monkeypatch.setattr(
        "li_harvester.people_runner.config.PEOPLE_FIRM_COOLDOWN_HOURS", 180 * 24
    )
    now = datetime(2026, 8, 10, 12, 0, tzinfo=timezone.utc)
    recent = _firm("A", last_run_at="2026-07-10T10:00:00Z")  # ~1 month ago
    old = _firm("B", last_run_at="2025-12-01T10:00:00Z")  # ~8 months ago
    assert _in_cooldown(recent, now=now) is True
    assert _in_cooldown(old, now=now) is False


def test_max_firms_per_run(monkeypatch):
    monkeypatch.setattr("li_harvester.people_runner.config.PEOPLE_FIRM_COOLDOWN_HOURS", 0)
    monkeypatch.setattr("li_harvester.people_runner.config.MAX_FIRMS_PER_PEOPLE_RUN", 1)
    now = datetime.now(timezone.utc)
    firms = [_firm("One"), _firm("Two")]
    # unique row indexes
    firms[1] = Influencer(
        row_index=3,
        name="Two",
        profile_url="https://www.linkedin.com/company/two/",
        active=True,
    )
    selected = _select_firms(firms, now=now)
    assert len(selected) == 1
    assert selected[0].name == "One"
