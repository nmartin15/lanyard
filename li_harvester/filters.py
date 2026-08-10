"""Junk filter rules. Edit this file weekly — each rule returns (keep, reason)."""

from __future__ import annotations

import re
from typing import Callable, Iterable, Optional

from li_harvester.models import RawComment
from li_harvester.normalize import (
    normalize_linkedin_url,
    normalize_source_url,
    strip_accents_lower,
    word_count,
)

FilterFn = Callable[[RawComment, "FilterContext"], Optional[str]]


class FilterContext:
    def __init__(
        self,
        seen_profiles: set[str],
        influencer_urls: set[str],
    ) -> None:
        self.seen_profiles = seen_profiles
        self.influencer_urls = influencer_urls


GENERIC_PRAISE = {
    "great post",
    "love this",
    "well said",
    "so true",
    "facts",
    "agreed",
    "thanks for sharing",
    "thank you for sharing",
    "100%",
    "spot on",
    "this",
    "nice",
    "congrats",
    "congratulations",
    "awesome",
    "amazing",
    "powerful",
    "needed this",
    "this is fire",
    "lets go",
    "let's go",
    "truth",
    "exactly",
    "nailed it",
    "thissss",
}

SPAM_PHRASES = [
    "dm me",
    "check my",
    "link in bio",
    "join my",
    "my telegram",
    "whatsapp",
    "sign up",
    "click the link",
    "free signals",
]

HEADLINE_BANS = [
    "recruiter",
    "talent",
    "hiring",
    "headhunter",
    "coach",
    "mentor",
    "mentorship",
    "signals",
    "funded account",
    "account manager",
]

# Tier1People-only title drops (allocation map — skip finance ops titles)
PEOPLE_HEADLINE_BANS = [
    "cfo",
    "chief financial officer",
]

# When Title Mode = ICP: keep only investing/trading seat titles
PEOPLE_ICP_KEEP_PATTERNS = [
    r"\banalyst\b",
    r"\bportfolio\s+manager\b",
    r"\bpm\b",
    r"\bquant(?:itative)?\b",
    r"\btrader\b",
    r"\btrading\b",
    r"\brisk\b",
]

PEOPLE_ICP_HARD_ADMIN_PATTERNS = [
    r"\bexecutive\s+assistant\b",
    r"\badmin(?:istrative|istrator)?\b",
    r"\breception",
    r"\bhuman\s+resources\b",
    r"\brecruit",
    r"\bfacilities\b",
    r"\boffice\s+manager\b",
    r"\bcfo\b",
    r"\bchief\s+financial\b",
    r"\bcontroller\b",
    r"\baccountant\b",
    r"\bvice\s+president\s+of\s+finance\b",
    r"\bvp\s+of\s+finance\b",
]

TRADING_EDU_MARKERS = [
    "trading academy",
    "trade academy",
    "forex course",
    "trading course",
    "prop firm course",
    "signals service",
    "mentorship program",
    "trading education",
    "day trading course",
]


def drop_no_in_url(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    if not normalize_linkedin_url(comment.author_profile_url):
        return "no_in_url"
    return None


def drop_seen_profile(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    url = normalize_linkedin_url(comment.author_profile_url)
    if url and url in ctx.seen_profiles:
        return "seen_profile"
    return None


def drop_influencer_self(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    url = normalize_source_url(comment.author_profile_url) or normalize_linkedin_url(
        comment.author_profile_url
    )
    if url and url in ctx.influencer_urls:
        return "influencer_self"
    return None


def drop_short_comment(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    if word_count(comment.comment_text) < 4:
        return "short_comment"
    return None


def drop_generic_praise(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    text = strip_accents_lower(comment.comment_text or "").strip()
    text = re.sub(r"[^\w\s'%]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text in GENERIC_PRAISE:
        return "generic_praise"
    # Near variants: entire comment is praise + optional emoji leftovers already stripped
    for phrase in GENERIC_PRAISE:
        if text == phrase or (
            text.startswith(phrase + " ") and len(text.split()) <= 4
        ):
            return "generic_praise"
    return None


def drop_spam_phrases(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    text = strip_accents_lower(comment.comment_text or "")
    for phrase in SPAM_PHRASES:
        if phrase in text:
            return f"spam:{phrase}"
    return None


def drop_headline_bans(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    headline = strip_accents_lower(comment.author_headline or "")
    for ban in HEADLINE_BANS:
        if ban in headline:
            return f"headline:{ban}"
    return None


def drop_trading_edu_founder(comment: RawComment, ctx: FilterContext) -> Optional[str]:
    headline = strip_accents_lower(comment.author_headline or "")
    is_founder = "founder" in headline or "ceo" in headline
    if not is_founder:
        return None
    for marker in TRADING_EDU_MARKERS:
        if marker in headline:
            return "headline:trading_edu_founder"
    return None


RULES: list[tuple[str, FilterFn]] = [
    ("no_in_url", drop_no_in_url),
    ("seen_profile", drop_seen_profile),
    ("influencer_self", drop_influencer_self),
    ("short_comment", drop_short_comment),
    ("generic_praise", drop_generic_praise),
    ("spam_phrases", drop_spam_phrases),
    ("headline_bans", drop_headline_bans),
    ("trading_edu_founder", drop_trading_edu_founder),
]


def apply_filters(
    comment: RawComment,
    ctx: FilterContext,
    rules: Iterable[tuple[str, FilterFn]] | None = None,
) -> tuple[bool, str]:
    """First match wins. Returns (keep, reason)."""
    for _name, fn in rules or RULES:
        reason = fn(comment, ctx)
        if reason:
            return False, reason
    return True, "kept"


def drop_people_headline(headline: str | None) -> Optional[str]:
    """Return drop reason for Tier1People headlines, or None to keep."""
    text = strip_accents_lower(headline or "")
    # Word-boundary for short tokens like cfo so "scofo" doesn't match
    for ban in PEOPLE_HEADLINE_BANS:
        if ban == "cfo":
            if re.search(r"\bcfo\b", text):
                return "headline:cfo"
            continue
        if ban in text:
            return f"headline:{ban.replace(' ', '_')}"
    return None


def drop_people_icp_title(headline: str | None) -> Optional[str]:
    """ICP mode: keep analysts / PMs / quants / risk / traders; drop admin & finance ops."""
    text = strip_accents_lower(headline or "")
    if not text.strip():
        return "headline:empty"
    for pat in PEOPLE_ICP_HARD_ADMIN_PATTERNS:
        if re.search(pat, text):
            return "headline:admin"
    # Generic "finance" ops without an investing seat keyword
    if re.search(r"\bfinance\b", text) and not any(
        re.search(pat, text) for pat in PEOPLE_ICP_KEEP_PATTERNS
    ):
        return "headline:admin"
    if not any(re.search(pat, text) for pat in PEOPLE_ICP_KEEP_PATTERNS):
        return "headline:not_icp"
    return None
