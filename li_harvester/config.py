from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

INFLUENCERS_TAB = "Influencers"
TIER1_FIRMS_TAB = "Tier1Firms"
TIER1_PEOPLE_TAB = "Tier1People"
LEADS_TAB = "HFI Leads - LinkedIn Posts"
OPS_TAB = "_Ops"

INFLUENCER_HEADERS = [
    "Influencer Name",
    "Profile URL",
    "Active",
    "Posts Per Run",
    "Last Run At",
    "Last Run Status",
    "Leads Found",
    "Include Reactions",  # leave FALSE on retail Influencers
]

# Same shape as Influencers; firm-friendly labels. Include Reactions defaults TRUE on seed.
TIER1_FIRM_HEADERS = [
    "Firm Name",
    "Company URL",
    "Active",
    "Posts Per Run",
    "Last Run At",
    "Last Run Status",
    "Leads Found",
    "Include Reactions",
    "Title Mode",  # blank = all (minus bans); ICP = analyst/PM/quant/risk/trader
]

# Passed to Apify job_title when Title Mode = ICP
PEOPLE_ICP_APIFY_JOB_TITLE = (
    'analyst OR "portfolio manager" OR quant OR quantitative OR trader '
    'OR "risk manager" OR "risk analyst" OR "risk management" '
    "-admin -assistant -recruiter -hr -facilities"
)

TIER1_SEED_FIRMS = [
    {
        "name": "Hudson River Trading",
        "url": "https://www.linkedin.com/company/hudson-river-trading/",
        "active": "TRUE",
        "posts_per_run": 10,
        "include_reactions": "TRUE",
    },
]

TIER1_PEOPLE_HEADERS = [
    "Firm Name",
    "Company URL",
    "First Name",
    "Last Name",
    "Headline / Title",
    "LinkedIn URL",
    "Location",
    "Date Added",
    "Notes",
]

REACTIONS_ACTOR = "apimaestro/linkedin-post-reactions"
REACTIONS_LIMIT_PER_POST = int(os.getenv("REACTIONS_LIMIT_PER_POST", "50") or "50")
EMPLOYEES_ACTOR = "apimaestro/linkedin-company-employees-scraper-no-cookies"
# Guardrails — keep LinkedIn/Apify pulls small and paced
_MAX_EMP_RAW = int(os.getenv("MAX_EMPLOYEES_PER_FIRM", "25") or "25")
MAX_EMPLOYEES_PER_FIRM_HARD_CAP = int(
    os.getenv("MAX_EMPLOYEES_PER_FIRM_HARD_CAP", "50") or "50"
)
MAX_EMPLOYEES_PER_FIRM = min(max(1, _MAX_EMP_RAW), MAX_EMPLOYEES_PER_FIRM_HARD_CAP)
MAX_FIRMS_PER_PEOPLE_RUN = int(os.getenv("MAX_FIRMS_PER_PEOPLE_RUN", "1") or "1")
PEOPLE_FIRM_DELAY_SECONDS = int(os.getenv("PEOPLE_FIRM_DELAY_SECONDS", "90") or "90")
# Tier1People is a slow map — default 6 months between re-scrapes of the same firm
PEOPLE_FIRM_COOLDOWN_DAYS = int(os.getenv("PEOPLE_FIRM_COOLDOWN_DAYS", "180") or "180")
# Back-compat: hours env still wins if explicitly set
_PEOPLE_COOLDOWN_HOURS_ENV = os.getenv("PEOPLE_FIRM_COOLDOWN_HOURS")
PEOPLE_FIRM_COOLDOWN_HOURS = (
    int(_PEOPLE_COOLDOWN_HOURS_ENV)
    if _PEOPLE_COOLDOWN_HOURS_ENV not in (None, "")
    else PEOPLE_FIRM_COOLDOWN_DAYS * 24
)

LEAD_HEADERS = [
    "Lead ID",
    "Date Added",
    "Influencer",
    "Post URL",
    "Trigger Comment",
    "First Name",
    "Last Name",
    "LinkedIn URL",
    "Email",
    "Email Status",
    "Phone",
    "X",
    "Instagram",
    "Location",
    "Owner",
    "Status",
    "Last Contacted",
    "Next Follow-Up",
    "Due",
    "Notes",
]

STATUS_VALUES = [
    "New",
    "Working",
    "Replied",
    "Meeting Booked",
    "Not Interested",
    "Bad Fit",
    "Wrong Person",
]

WORKBOOK_TITLE = "HFI LinkedIn Leads"
DUE_FORMULA_TEMPLATE = (
    '=IF(OR(R{row}="", P{row}=""), "",'
    'IF(AND(R{row}<=TODAY(), NOT(OR(P{row}="Not Interested", P{row}="Bad Fit",'
    'P{row}="Wrong Person", P{row}="Meeting Booked"))), "DUE", ""))'
)

POSTS_ACTOR = "apimaestro/linkedin-batch-profile-posts-scraper"
COMPANY_POSTS_ACTOR = "apimaestro/linkedin-company-posts"
COMMENTS_ACTOR = "apimaestro/linkedin-post-comments-replies-engagements-scraper-no-cookies"

MAX_POST_AGE_DAYS = 30
# Default 10 per original spec; company/meme sources often have fewer — override via .env
MIN_COMMENT_COUNT = int(os.getenv("MIN_COMMENT_COUNT", "10") or "10")
RESCRAPE_MAX_AGE_DAYS = 14
RESCRAPE_COMMENT_DELTA = 20
DEFAULT_POSTS_PER_RUN = 10
# Company actor omits deep history unless we pull a wider recent window, then filter
COMPANY_FETCH_LIMIT = int(os.getenv("COMPANY_FETCH_LIMIT", "50") or "50")


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


# After successful firm scrape, flip Active=FALSE so the next run needs an intentional enable
PEOPLE_AUTO_DEACTIVATE = _bool(os.getenv("PEOPLE_AUTO_DEACTIVATE"), default=True)
# Same for Influencers harvest — one intentional Active=TRUE run, then off
INFLUENCER_AUTO_DEACTIVATE = _bool(os.getenv("INFLUENCER_AUTO_DEACTIVATE"), default=True)


@dataclass(frozen=True)
class Settings:
    apify_token: str
    google_sa_json: Path
    google_share_with_email: str
    spreadsheet_id: str
    dry_run: bool
    default_owner: str
    failed_runs_dir: Path
    enable_enrichment: bool
    bettercontact_api_key: str

    @property
    def google_sa_json_resolved(self) -> Path:
        path = self.google_sa_json
        if not path.is_absolute():
            path = ROOT / path
        return path


def load_settings(*, require_apify: bool = True, require_sheet: bool = True) -> Settings:
    sa = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "secrets/google-sa.json")
    settings = Settings(
        apify_token=os.getenv("APIFY_TOKEN", "").strip(),
        google_sa_json=Path(sa),
        google_share_with_email=os.getenv("GOOGLE_SHARE_WITH_EMAIL", "").strip(),
        spreadsheet_id=os.getenv("SPREADSHEET_ID", "").strip(),
        dry_run=_bool(os.getenv("DRY_RUN"), default=True),
        default_owner=os.getenv("DEFAULT_OWNER", "Nate").strip() or "Nate",
        failed_runs_dir=ROOT / "failed_runs",
        enable_enrichment=_bool(os.getenv("ENABLE_ENRICHMENT"), default=False),
        bettercontact_api_key=os.getenv("BETTERCONTACT_API_KEY", "").strip(),
    )
    if require_apify and not settings.apify_token:
        raise SystemExit("APIFY_TOKEN is missing. Copy .env.example to .env and fill it in.")
    if require_sheet and not settings.spreadsheet_id:
        raise SystemExit(
            "SPREADSHEET_ID is missing. Run: python scripts/init_workbook.py"
        )
    if settings.enable_enrichment and not settings.dry_run and not settings.bettercontact_api_key:
        raise SystemExit(
            "ENABLE_ENRICHMENT=true requires BETTERCONTACT_API_KEY in .env"
        )
    return settings


def upsert_env_value(key: str, value: str, env_path: Path | None = None) -> None:
    """Create or update a KEY=value line in .env."""
    path = env_path or (ROOT / ".env")
    lines: list[str] = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()
    found = False
    out: list[str] = []
    for line in lines:
        if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        if out and out[-1].strip():
            out.append("")
        out.append(f"{key}={value}")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
