from __future__ import annotations

import re
import unicodedata
from typing import Optional
from urllib.parse import urlparse, urlunparse

CREDENTIAL_SUFFIXES = {
    "cfa",
    "cpa",
    "mba",
    "phd",
    "cmt",
    "jr",
    "sr",
    "ii",
    "iii",
    "iv",
    "esq",
}

# Common locale prefixes LinkedIn uses: /de/, /fr/, /pt/, etc.
_LOCALE_RE = re.compile(r"^/[a-z]{2}(?:-[a-z]{2})?(/in/)", re.IGNORECASE)
_IN_PATH_RE = re.compile(r"/in/([^/?#]+)", re.IGNORECASE)
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002600-\U000026FF"
    "]+",
    flags=re.UNICODE,
)
_BRACKET_RE = re.compile(r"[\(\[\{][^\)\]\}]*[\)\]\}]")
_PIPE_TAIL_RE = re.compile(r"\|.*$")
_MENTION_RE = re.compile(r"@\w+")
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_WHITESPACE_RE = re.compile(r"\s+")


# /company/ and /school/ pages (posts/?feedView=… suffixes are stripped)
_ORG_PATH_RE = re.compile(r"/(company|school)/([^/?#]+)", re.IGNORECASE)


def is_company_url(url: str | None) -> bool:
    """True for LinkedIn company or school org pages (not personal /in/)."""
    if not url:
        return False
    text = str(url).lower()
    return "/company/" in text or "/school/" in text


def normalize_company_url(url: str | None) -> Optional[str]:
    """Canonical company or school URL (strips /posts, query params)."""
    if not url or not str(url).strip():
        return None
    raw = str(url).strip().lower()
    if not raw.startswith("http"):
        raw = "https://" + raw.lstrip("/")
    parsed = urlparse(raw)
    host = parsed.netloc or ""
    if host.startswith("www."):
        host = host[4:]
    if "linkedin.com" not in host:
        return None
    path = parsed.path or ""
    path = _LOCALE_RE.sub(r"\1", path)
    match = _ORG_PATH_RE.search(path)
    if not match:
        return None
    kind = match.group(1).lower()
    slug = match.group(2).strip("/")
    if not slug or slug in {"posts", "about", "people", "jobs"}:
        return None
    return f"https://www.linkedin.com/{kind}/{slug}"


def company_identifier(url: str | None) -> Optional[str]:
    """Slug suitable for the company-posts actor (works for /company/ and /school/)."""
    normalized = normalize_company_url(url)
    if not normalized:
        # bare slug
        text = (url or "").strip().lower()
        if text and "/" not in text and " " not in text:
            return text
        return None
    return normalized.rsplit("/", 1)[-1]


def normalize_linkedin_url(url: str | None) -> Optional[str]:
    """Canonical personal /in/ profile URL or None."""
    if not url or not str(url).strip():
        return None
    raw = str(url).strip()
    # Lowercase early — urlparse can mishandle odd casing on scheme/host.
    raw = raw.lower()
    if not raw.startswith("http"):
        raw = "https://" + raw.lstrip("/")
    parsed = urlparse(raw)
    host = parsed.netloc or ""
    if host.startswith("www."):
        host = host[4:]
    if "linkedin.com" not in host and host != "lnkd.in":
        return None
    path = parsed.path or ""
    path = _LOCALE_RE.sub(r"\1", path)
    match = _IN_PATH_RE.search(path)
    if not match:
        return None
    slug = match.group(1).strip("/")
    if not slug:
        return None
    return f"https://www.linkedin.com/in/{slug}"


def normalize_source_url(url: str | None) -> Optional[str]:
    """Personal profile or company page canonical URL."""
    if is_company_url(url):
        return normalize_company_url(url)
    return normalize_linkedin_url(url)


def normalize_post_url(url: str | None) -> Optional[str]:
    if not url or not str(url).strip():
        return None
    raw = str(url).strip()
    if not raw.startswith("http"):
        raw = "https://" + raw.lstrip("/")
    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower()
    if "linkedin.com" not in host:
        return raw.split("?")[0].rstrip("/")
    path = (parsed.path or "").rstrip("/")
    return urlunparse(("https", "www.linkedin.com", path, "", "", ""))


def split_name(display_name: str | None) -> tuple[str, str]:
    if not display_name or not str(display_name).strip():
        return "", ""
    name = str(display_name).strip()
    if "," in name:
        name = name.split(",", 1)[0]
    name = _EMOJI_RE.sub(" ", name)
    name = _BRACKET_RE.sub(" ", name)
    name = _PIPE_TAIL_RE.sub(" ", name)
    name = _WHITESPACE_RE.sub(" ", name).strip()
    if not name:
        return "", ""
    tokens = [t for t in name.split(" ") if t]
    # Strip trailing credential-like tokens
    while tokens and tokens[-1].rstrip(".").lower() in CREDENTIAL_SUFFIXES:
        tokens.pop()
    if not tokens:
        return "", ""
    if len(tokens) == 1:
        return tokens[0], ""
    return tokens[0], tokens[-1]


def strip_for_word_count(text: str | None) -> str:
    if not text:
        return ""
    cleaned = _EMOJI_RE.sub(" ", str(text))
    cleaned = _MENTION_RE.sub(" ", cleaned)
    cleaned = _PUNCT_RE.sub(" ", cleaned)
    return _WHITESPACE_RE.sub(" ", cleaned).strip()


def word_count(text: str | None) -> int:
    cleaned = strip_for_word_count(text)
    if not cleaned:
        return 0
    return len(cleaned.split())


def collapse_comment(text: str | None, max_len: int = 1000) -> str:
    if not text:
        return ""
    collapsed = _WHITESPACE_RE.sub(" ", str(text).replace("\r", "\n"))
    collapsed = collapsed.replace("\n", " ").strip()
    if len(collapsed) > max_len:
        return collapsed[: max_len - 1].rstrip() + "…"
    return collapsed


def truncate(text: str | None, max_len: int = 500) -> str:
    if not text:
        return ""
    s = _WHITESPACE_RE.sub(" ", str(text)).strip()
    if len(s) > max_len:
        return s[: max_len - 1].rstrip() + "…"
    return s


def strip_accents_lower(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()
