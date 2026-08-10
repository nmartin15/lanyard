from __future__ import annotations

import logging
import time
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import requests

from li_harvester import config
from li_harvester.models import CompanyPerson, Post, RawComment
from li_harvester.normalize import (
    company_identifier,
    is_company_url,
    normalize_company_url,
    normalize_linkedin_url,
    normalize_post_url,
    split_name,
    truncate,
)

log = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"


class ApifyError(RuntimeError):
    pass


class ApifyClient:
    def __init__(self, token: str, *, poll_seconds: float = 5.0, timeout: int = 900) -> None:
        self.token = token
        self.poll_seconds = poll_seconds
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        params: dict | None = None,
        retries: int = 5,
    ) -> Any:
        url = f"{APIFY_BASE}{path}"
        delay = 2.0
        last_err: Exception | None = None
        for attempt in range(retries):
            try:
                resp = self.session.request(
                    method, url, json=json_body, params=params, timeout=120
                )
                if resp.status_code == 429:
                    log.warning("Apify rate limited; backoff %.1fs", delay)
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                if resp.status_code >= 500:
                    log.warning("Apify %s; backoff %.1fs", resp.status_code, delay)
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                if not resp.ok:
                    raise ApifyError(f"Apify {resp.status_code}: {resp.text[:500]}")
                if resp.status_code == 204 or not resp.content:
                    return None
                return resp.json()
            except requests.RequestException as exc:
                last_err = exc
                if attempt < retries - 1:
                    time.sleep(delay)
                    delay = min(delay * 2, 60)
                    continue
                raise ApifyError(str(exc)) from exc
        raise ApifyError(str(last_err))

    def run_actor(self, actor_id: str, run_input: dict) -> list[dict]:
        """Start actor, poll until done, return dataset items."""
        actor_path = actor_id.replace("/", "~")
        started = self._request(
            "POST",
            f"/acts/{actor_path}/runs",
            json_body=run_input,
            params={"waitForFinish": 0},
        )
        run = started.get("data", started)
        run_id = run["id"]
        dataset_id = run.get("defaultDatasetId")
        log.info("Apify run started actor=%s run_id=%s", actor_id, run_id)

        deadline = time.time() + self.timeout
        while time.time() < deadline:
            status_payload = self._request("GET", f"/actor-runs/{run_id}")
            data = status_payload.get("data", status_payload)
            status = data.get("status")
            if status in {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}:
                if status != "SUCCEEDED":
                    raise ApifyError(f"Actor {actor_id} finished with status={status}")
                dataset_id = data.get("defaultDatasetId") or dataset_id
                break
            time.sleep(self.poll_seconds)
        else:
            raise ApifyError(f"Actor {actor_id} timed out after {self.timeout}s")

        return self._fetch_dataset(dataset_id)

    def _fetch_dataset(self, dataset_id: str | None) -> list[dict]:
        if not dataset_id:
            return []
        items: list[dict] = []
        offset = 0
        limit = 1000
        while True:
            payload = self._request(
                "GET",
                f"/datasets/{dataset_id}/items",
                params={"format": "json", "clean": 1, "offset": offset, "limit": limit},
            )
            batch = payload if isinstance(payload, list) else payload.get("items", [])
            if not batch:
                break
            items.extend(batch)
            if len(batch) < limit:
                break
            offset += limit
        return items


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        # ms or s epoch
        ts = float(value)
        if ts > 1e12:
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    text = str(value).strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(text.replace("+0000", "+00:00"), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _get(item: dict, *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
    return default


def _flatten_post_items(items: list[dict]) -> list[dict]:
    """Actor may return batch wrappers, per-profile posts[], or one row per post."""
    flat: list[dict] = []
    for item in items:
        # Batch actor: { summary, results: [ { username, success, posts: [...] } ] }
        if isinstance(item.get("results"), list):
            for result in item["results"]:
                if not isinstance(result, dict):
                    continue
                if result.get("success") is False:
                    log.warning(
                        "Profile scrape failed username=%s error=%s",
                        result.get("username"),
                        result.get("error"),
                    )
                    continue
                posts = result.get("posts")
                if isinstance(posts, list):
                    flat.extend(p for p in posts if isinstance(p, dict))
            continue
        if isinstance(item.get("posts"), list):
            flat.extend(p for p in item["posts"] if isinstance(p, dict))
            continue
        flat.append(item)
    return flat


def _parse_posted_at(value: Any) -> Optional[datetime]:
    if isinstance(value, dict):
        return _parse_dt(_get(value, "timestamp", "date", default=None))
    if isinstance(value, str):
        # Relative strings from LinkedIn UI, e.g. "2 months ago", "5d"
        text = value.strip().lower()
        now = datetime.now(timezone.utc)
        m = re.match(
            r"(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago",
            text,
        )
        if m:
            n = int(m.group(1))
            unit = m.group(2)
            if unit in {"second", "minute", "hour"}:
                return now
            days = {
                "day": n,
                "week": n * 7,
                "month": n * 30,
                "year": n * 365,
            }.get(unit, 0)
            return now - timedelta(days=days)
        m2 = re.match(r"(\d+)\s*([smhdw])\b", text)
        if m2:
            n = int(m2.group(1))
            unit = m2.group(2)
            if unit in {"s", "m", "h"}:
                return now
            days = {"d": n, "w": n * 7}.get(unit, 0)
            return now - timedelta(days=days)
    return _parse_dt(value)


def map_posts(items: list[dict], influencer_name: str) -> list[Post]:
    posts: list[Post] = []
    for item in _flatten_post_items(items):
        url = normalize_post_url(
            _get(item, "postUrl", "url", "post_url", "link", "postLink")
        )
        if not url:
            continue
        stats = item.get("stats") if isinstance(item.get("stats"), dict) else {}
        # Company actor often omits comments — use -1 so Stage 1 doesn't drop them.
        raw_comments = _get(
            item,
            "commentCount",
            "commentsCount",
            "numComments",
            "comments_count",
            default=stats.get("comments") if "comments" in stats else None,
        )
        if raw_comments is None:
            comment_count = -1
        else:
            try:
                comment_count = int(raw_comments or 0)
            except (TypeError, ValueError):
                comment_count = -1
        posted_at = _parse_posted_at(
            _get(item, "postedAt", "publishedAt", "posted_at", "timestamp", "date")
        )
        text = truncate(
            _get(item, "text", "postText", "content", "commentary", default=""),
            500,
        )
        posts.append(
            Post(
                post_url=url,
                influencer_name=influencer_name,
                posted_at=posted_at,
                comment_count=comment_count,
                post_text=text,
            )
        )
    return posts


def map_comments(
    items: list[dict],
    *,
    post_url_fallback: str = "",
    influencer_name: str = "",
) -> list[RawComment]:
    comments: list[RawComment] = []
    for item in items:
        # Batch actors often append a summary row with no comment body
        if "summary" in item and not (
            item.get("text") or item.get("comment") or item.get("commentText")
        ):
            continue
        # v1: top-level comments only (skip nested replies)
        comment_type = str(item.get("comment_type") or "").lower()
        if (
            item.get("isReply") is True
            or item.get("replyToId")
            or item.get("parent_comment_id")
            or comment_type == "reply"
        ):
            continue

        author = item.get("author") if isinstance(item.get("author"), dict) else {}
        author_name = str(
            _get(
                item,
                "authorName",
                "author_name",
                "name",
                default=_get(author, "name", "fullName", default=""),
            )
            or ""
        )
        author_headline = str(
            _get(
                item,
                "authorHeadline",
                "author_headline",
                "headline",
                default=_get(author, "headline", "title", default=""),
            )
            or ""
        )
        author_url = str(
            _get(
                item,
                "authorProfileUrl",
                "authorUrl",
                "author_profile_url",
                "profileUrl",
                default=_get(
                    author, "profile_url", "profileUrl", "url", "linkedinUrl", default=""
                ),
            )
            or ""
        )
        comment_text = str(
            _get(item, "comment", "text", "commentText", "message", default="") or ""
        )
        post_url = normalize_post_url(
            _get(
                item,
                "postUrl",
                "post_url",
                "postLink",
                "post_input",
                default=post_url_fallback,
            )
        ) or post_url_fallback
        comment_id = str(
            _get(item, "comment_id", "commentId", "id", "urn", default="")
            or f"{post_url}:{author_url}:{hash(comment_text) & 0xFFFFFFFF:x}"
        )
        posted_at = item.get("posted_at") if isinstance(item.get("posted_at"), dict) else {}
        commented_at = _parse_dt(
            _get(
                item,
                "commentedAt",
                "createdAt",
                "timestamp",
                "date",
                default=_get(posted_at, "timestamp", "date", default=None),
            )
        )
        twitter = _get(item, "twitter", "twitterUrl", "x", "xUrl") or _get(
            author, "twitter", "twitterUrl"
        )
        instagram = _get(item, "instagram", "instagramUrl") or _get(
            author, "instagram", "instagramUrl"
        )
        location = _get(item, "location", "geoLocation") or _get(author, "location")

        comments.append(
            RawComment(
                comment_id=comment_id,
                post_url=post_url,
                influencer_name=influencer_name
                or str(_get(item, "influencerName", "influencer", default="") or ""),
                author_name=author_name,
                author_headline=author_headline,
                author_profile_url=author_url,
                comment_text=comment_text,
                commented_at=commented_at,
                twitter=str(twitter) if twitter else None,
                instagram=str(instagram) if instagram else None,
                location=str(location) if location else None,
            )
        )
    return comments


def fetch_posts_for_source(
    client: ApifyClient,
    *,
    profile_url: str,
    max_posts: int,
    influencer_name: str,
) -> list[Post]:
    """Fetch posts from a personal profile (/in/) or company page (/company/)."""
    if is_company_url(profile_url):
        company = company_identifier(profile_url)
        if not company:
            raise ApifyError(f"Could not parse company URL: {profile_url}")
        log.info("Using company posts actor for %s", company)
        # Pull a wider recent window; Stage 1 still filters by age/comments
        fetch_limit = max(max_posts, config.COMPANY_FETCH_LIMIT)
        items = client.run_actor(
            config.COMPANY_POSTS_ACTOR,
            {
                "company_name": company,
                "page_number": 1,
                "limit": min(fetch_limit, 100),
                "sort": "recent",
            },
        )
        posts = map_posts(items, influencer_name)
        # Prefer posts that actually show comments when the actor provides the field
        known = [p for p in posts if p.comment_count > 0]
        unknown = [p for p in posts if p.comment_count < 0]
        zero = [p for p in posts if p.comment_count == 0]
        ordered = (
            sorted(known, key=lambda p: p.comment_count, reverse=True)
            + unknown
            + zero
        )
        return ordered

    items = client.run_actor(
        config.POSTS_ACTOR,
        {
            # Actor schema uses usernames (slug or full profile URL), limit per profile
            "usernames": [profile_url],
            "limit": max_posts,
        },
    )
    return map_posts(items, influencer_name)


# Back-compat alias
fetch_posts_for_profile = fetch_posts_for_source


def fetch_comments_for_posts(
    client: ApifyClient,
    posts: list[Post],
) -> list[RawComment]:
    if not posts:
        return []
    # Actor rejects duplicate postIds (can happen across company/school feeds)
    post_by_url: dict[str, Post] = {}
    for p in posts:
        url = normalize_post_url(p.post_url) or p.post_url
        p.post_url = url
        if url not in post_by_url:
            post_by_url[url] = p
    items = client.run_actor(
        config.COMMENTS_ACTOR,
        {
            "postIds": list(post_by_url.keys()),
            "sortOrder": "most recent",
            "limit": 100,
        },
    )
    comments = map_comments(items)
    # Backfill influencer_name from posts when actor omits it
    for c in comments:
        if not c.influencer_name and c.post_url in post_by_url:
            c.influencer_name = post_by_url[c.post_url].influencer_name
        if not c.post_url and len(posts) == 1:
            c.post_url = posts[0].post_url
            c.influencer_name = posts[0].influencer_name
    return comments


def map_reactions(
    items: list[dict],
    *,
    post_by_url: dict[str, Post],
) -> list[RawComment]:
    """Map reaction actor rows into RawComment-shaped engagers (engagement=reaction)."""
    out: list[RawComment] = []
    for item in items:
        reactor = item.get("reactor") if isinstance(item.get("reactor"), dict) else {}
        meta = item.get("_metadata") if isinstance(item.get("_metadata"), dict) else {}
        author_name = str(
            _get(item, "name", "reactorName", default=_get(reactor, "name", default=""))
            or ""
        )
        author_headline = str(
            _get(
                item,
                "headline",
                "reactorHeadline",
                default=_get(reactor, "headline", "title", default=""),
            )
            or ""
        )
        author_url = str(
            _get(
                item,
                "profile_url",
                "profileUrl",
                "authorProfileUrl",
                default=_get(
                    reactor, "profile_url", "profileUrl", "url", "linkedinUrl", default=""
                ),
            )
            or ""
        )
        post_url = normalize_post_url(
            _get(
                item,
                "post_url",
                "postUrl",
                default=_get(meta, "post_url", "postUrl", default=""),
            )
        )
        if not post_url and len(post_by_url) == 1:
            post_url = next(iter(post_by_url))
        reaction_type = str(
            _get(item, "reaction_type", "reactionType", "type", default="LIKE") or "LIKE"
        ).upper()
        post = post_by_url.get(post_url) if post_url else None
        influencer_name = post.influencer_name if post else ""
        comment_id = str(
            _get(item, "urn", "id", default="")
            or f"reaction:{post_url}:{author_url}:{reaction_type}"
        )
        out.append(
            RawComment(
                comment_id=comment_id,
                post_url=post_url or "",
                influencer_name=influencer_name,
                author_name=author_name,
                author_headline=author_headline,
                author_profile_url=author_url,
                comment_text=f"[Reaction: {reaction_type}]",
                engagement="reaction",
            )
        )
    return out


def fetch_reactions_for_posts(
    client: ApifyClient,
    posts: list[Post],
) -> list[RawComment]:
    """Only call for posts whose source has Include Reactions = TRUE."""
    if not posts:
        return []
    post_by_url = {p.post_url: p for p in posts}
    items = client.run_actor(
        config.REACTIONS_ACTOR,
        {
            "post_urls": [p.post_url for p in posts],
            "page_number": 1,
            "reaction_type": "ALL",
            "limit": config.REACTIONS_LIMIT_PER_POST,
        },
    )
    reactions = map_reactions(items, post_by_url=post_by_url)
    for r in reactions:
        if not r.influencer_name and r.post_url in post_by_url:
            r.influencer_name = post_by_url[r.post_url].influencer_name
    return reactions


def map_employees(
    items: list[dict],
    *,
    firm_name: str,
    company_url: str,
    date_added: str,
) -> list[CompanyPerson]:
    """Map company-employees actor rows into CompanyPerson records."""
    out: list[CompanyPerson] = []
    seen: set[str] = set()
    company_canon = normalize_company_url(company_url) or company_url
    for item in items:
        profile = item.get("profile") if isinstance(item.get("profile"), dict) else {}
        author = item.get("author") if isinstance(item.get("author"), dict) else {}
        nested = profile or author

        raw_url = str(
            _get(
                item,
                "profile_url",
                "profileUrl",
                "linkedin_url",
                "linkedinUrl",
                "url",
                default=_get(
                    nested,
                    "profile_url",
                    "profileUrl",
                    "url",
                    "linkedinUrl",
                    default="",
                ),
            )
            or ""
        )
        linkedin_url = normalize_linkedin_url(raw_url)
        if not linkedin_url or linkedin_url in seen:
            continue
        seen.add(linkedin_url)

        full_name = str(
            _get(
                item,
                "full_name",
                "fullName",
                "name",
                "authorName",
                default=_get(nested, "name", "fullName", "full_name", default=""),
            )
            or ""
        )
        first = str(_get(item, "first_name", "firstName", default="") or "")
        last = str(_get(item, "last_name", "lastName", default="") or "")
        if not first and not last:
            first, last = split_name(full_name)

        headline = str(
            _get(
                item,
                "headline",
                "title",
                "job_title",
                "jobTitle",
                "position",
                default=_get(nested, "headline", "title", "job_title", default=""),
            )
            or ""
        )
        location_raw = _get(
            item,
            "location",
            "geoLocation",
            "geo",
            default=_get(nested, "location", "geoLocation", default=""),
        )
        if isinstance(location_raw, dict):
            location = str(
                location_raw.get("full")
                or location_raw.get("city")
                or location_raw.get("country")
                or ""
            )
        else:
            location = str(location_raw or "")
        out.append(
            CompanyPerson(
                firm_name=firm_name,
                company_url=company_canon,
                first_name=first,
                last_name=last,
                headline=truncate(headline, 300),
                linkedin_url=linkedin_url,
                location=location,
                date_added=date_added,
            )
        )
    return out


def fetch_employees_for_company(
    client: ApifyClient,
    *,
    company_url: str,
    firm_name: str,
    max_employees: int | None = None,
    date_added: str,
    job_title: str = "",
) -> list[CompanyPerson]:
    # Actor often fails with full /company/ URLs; slug works (e.g. hudson-river-trading).
    slug = company_identifier(company_url)
    company_canon = normalize_company_url(company_url) or company_url
    if not slug:
        raise ApifyError(f"Invalid company URL: {company_url!r}")
    limit = max_employees if max_employees is not None else config.MAX_EMPLOYEES_PER_FIRM
    run_input: dict[str, Any] = {
        "identifier": slug,
        "max_employees": max(1, int(limit)),
    }
    if job_title.strip():
        run_input["job_title"] = job_title.strip()
    items = client.run_actor(config.EMPLOYEES_ACTOR, run_input)
    # Drop actor status rows that aren't people
    items = [
        i
        for i in items
        if isinstance(i, dict)
        and not i.get("message")
        and (
            i.get("profile_url")
            or i.get("profileUrl")
            or (isinstance(i.get("profile"), dict) and i["profile"].get("profile_url"))
        )
    ]
    return map_employees(
        items,
        firm_name=firm_name,
        company_url=company_canon,
        date_added=date_added,
    )
