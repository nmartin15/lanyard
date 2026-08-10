from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class Post:
    post_url: str
    influencer_name: str
    posted_at: Optional[datetime]
    comment_count: int
    post_text: str = ""
    include_reactions: bool = False


@dataclass
class RawComment:
    comment_id: str
    post_url: str
    influencer_name: str
    author_name: str
    author_headline: str
    author_profile_url: str
    comment_text: str
    commented_at: Optional[datetime] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    location: Optional[str] = None
    engagement: str = "comment"  # comment | reaction


@dataclass
class Lead:
    lead_id: str
    date_added: str
    influencer: str
    post_url: str
    trigger_comment: str
    first_name: str
    last_name: str
    linkedin_url: str
    email: Optional[str] = None
    email_status: str = "Not Found"
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    location: Optional[str] = None
    owner: str = "Nate"
    status: str = "New"

    def to_sheet_row(self) -> list:
        """Map to columns A–T. Phone/CRM dates/Notes empty; Due is formula."""
        return [
            self.lead_id,
            self.date_added,
            self.influencer,
            self.post_url,
            self.trigger_comment,
            self.first_name,
            self.last_name,
            self.linkedin_url,
            self.email or "",
            self.email_status or "",
            "",  # Phone — v1 never fills
            self.twitter or "",
            self.instagram or "",
            self.location or "",
            self.owner,
            self.status,
            "",  # Last Contacted
            "",  # Next Follow-Up
            "",  # Due — overwritten with formula by sheets layer if needed
            "",  # Notes
        ]


@dataclass
class Influencer:
    row_index: int  # 1-based sheet row
    name: str
    profile_url: str
    active: bool
    posts_per_run: int = 10
    last_run_at: str = ""
    last_run_status: str = ""
    leads_found: int = 0
    include_reactions: bool = False
    title_mode: str = ""  # "" | "ICP"


@dataclass
class CompanyPerson:
    firm_name: str
    company_url: str
    first_name: str
    last_name: str
    headline: str
    linkedin_url: str
    location: str = ""
    date_added: str = ""
    notes: str = ""

    def to_sheet_row(self) -> list:
        return [
            self.firm_name,
            self.company_url,
            self.first_name,
            self.last_name,
            self.headline,
            self.linkedin_url,
            self.location,
            self.date_added,
            self.notes,
        ]


@dataclass
class RunStats:
    run_id: str
    started_at: str
    finished_at: str = ""
    posts_scraped: int = 0
    comments_pulled: int = 0
    reactions_pulled: int = 0
    kept: int = 0
    dropped: int = 0
    errors: list[str] = field(default_factory=list)
    cost_est: float = 0.0

    def error_count(self) -> int:
        return len(self.errors)


@dataclass
class SeenPost:
    post_url: str
    first_scraped_at: str
    comment_count_at_scrape: int
