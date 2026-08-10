import json
from pathlib import Path

from li_harvester.filters import FilterContext, apply_filters
from li_harvester.models import RawComment
from li_harvester.normalize import normalize_linkedin_url

FIXTURE = Path(__file__).parent / "fixtures" / "comments_labeled.jsonl"


def _comment_from_row(row: dict) -> RawComment:
    return RawComment(
        comment_id="t",
        post_url="https://www.linkedin.com/posts/x",
        influencer_name="Test Influencer",
        author_name=row["author_name"],
        author_headline=row["author_headline"],
        author_profile_url=row["author_profile_url"],
        comment_text=row["comment_text"],
    )


def test_labeled_fixture_rules():
    ctx = FilterContext(seen_profiles=set(), influencer_urls=set())
    rows = [
        json.loads(line)
        for line in FIXTURE.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    for row in rows:
        comment = _comment_from_row(row)
        keep, reason = apply_filters(comment, ctx)
        assert keep is row["keep"], (
            f"{row['author_name']}: expected keep={row['keep']} got {keep} ({reason})"
        )
        assert reason == row["reason"], (
            f"{row['author_name']}: expected reason={row['reason']!r} got {reason!r}"
        )


def test_seen_profile_and_influencer_self():
    url = "https://www.linkedin.com/in/known"
    ctx = FilterContext(
        seen_profiles={url},
        influencer_urls={"https://www.linkedin.com/in/influencer"},
    )
    seen_comment = RawComment(
        comment_id="1",
        post_url="https://www.linkedin.com/posts/x",
        influencer_name="Inf",
        author_name="Known Person",
        author_headline="Trader",
        author_profile_url="https://www.linkedin.com/in/known/?trk=1",
        comment_text="I wait for VWAP reclaim before any long entry today.",
    )
    keep, reason = apply_filters(seen_comment, ctx)
    assert keep is False and reason == "seen_profile"

    self_comment = RawComment(
        comment_id="2",
        post_url="https://www.linkedin.com/posts/x",
        influencer_name="Inf",
        author_name="Influencer",
        author_headline="Trader",
        author_profile_url="https://www.linkedin.com/in/influencer/",
        comment_text="I wait for VWAP reclaim before any long entry today.",
    )
    keep, reason = apply_filters(self_comment, ctx)
    assert keep is False and reason == "influencer_self"


def test_normalize_used_for_dedupe_key():
    assert normalize_linkedin_url("HTTPS://WWW.LINKEDIN.COM/IN/Foo/") == (
        "https://www.linkedin.com/in/foo"
    )
