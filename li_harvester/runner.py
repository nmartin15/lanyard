from __future__ import annotations

import logging
import sys
import uuid
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from li_harvester import config
from li_harvester.apify import (
    ApifyClient,
    ApifyError,
    fetch_comments_for_posts,
    fetch_posts_for_source,
)
from li_harvester.config import Settings, load_settings
from li_harvester.enrich import BetterContactClient, enrich_leads_email_only
from li_harvester.filters import FilterContext, apply_filters
from li_harvester.models import Influencer, Lead, Post, RawComment, RunStats, SeenPost
from li_harvester.normalize import (
    collapse_comment,
    normalize_linkedin_url,
    normalize_post_url,
    normalize_source_url,
    split_name,
)
from li_harvester.sheets import SheetsClient, build_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("li_harvester")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def select_posts(
    posts: list[Post],
    seen_posts: dict[str, SeenPost],
    *,
    now: Optional[datetime] = None,
) -> tuple[list[Post], list[SeenPost]]:
    """Return (posts_to_scrape, seen_post_updates_for_rescrape)."""
    now = now or _utc_now()
    selected: list[Post] = []
    rescrape_updates: list[SeenPost] = []
    for post in posts:
        url = normalize_post_url(post.post_url) or post.post_url
        post.post_url = url
        # comment_count < 0 means unknown (e.g. company actor) — don't drop
        if (
            post.comment_count >= 0
            and post.comment_count < config.MIN_COMMENT_COUNT
        ):
            continue
        if post.posted_at:
            age = now - post.posted_at.astimezone(timezone.utc)
            if age > timedelta(days=config.MAX_POST_AGE_DAYS):
                continue
        else:
            age = timedelta(0)

        prior = seen_posts.get(url)
        if prior:
            under_window = age <= timedelta(days=config.RESCRAPE_MAX_AGE_DAYS)
            stored = prior.comment_count_at_scrape
            # Only rescrape on comment delta when we have real counts
            if (
                post.comment_count >= 0
                and stored >= 0
                and under_window
                and (post.comment_count - stored) >= config.RESCRAPE_COMMENT_DELTA
            ):
                selected.append(post)
                rescrape_updates.append(
                    SeenPost(
                        post_url=url,
                        first_scraped_at=prior.first_scraped_at,
                        comment_count_at_scrape=post.comment_count,
                    )
                )
            continue

        selected.append(post)
    return selected, rescrape_updates


def build_lead(
    comment: RawComment,
    *,
    lead_id: str,
    owner: str,
) -> Optional[Lead]:
    linkedin_url = normalize_linkedin_url(comment.author_profile_url)
    if not linkedin_url:
        return None
    first, last = split_name(comment.author_name)
    return Lead(
        lead_id=lead_id,
        date_added=date.today().isoformat(),
        influencer=comment.influencer_name,
        post_url=comment.post_url,
        trigger_comment=collapse_comment(comment.comment_text),
        first_name=first,
        last_name=last,
        linkedin_url=linkedin_url,
        email=None,
        email_status="Not Found",
        twitter=comment.twitter,
        instagram=comment.instagram,
        location=comment.location,
        owner=owner,
        status="New",
    )


def run_pipeline(settings: Settings) -> int:
    started = _utc_now()
    stats = RunStats(
        run_id=f"run-{started.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6]}",
        started_at=_iso(started),
    )
    log.info(
        "Starting run_id=%s dry_run=%s spreadsheet=%s",
        stats.run_id,
        settings.dry_run,
        settings.spreadsheet_id or "(none)",
    )

    sheets = build_client(settings)
    if not settings.dry_run:
        sheets.ensure_workbook()

    influencers = [i for i in sheets.read_influencers() if i.active]
    if not influencers:
        log.error("No active influencers in sheet. Add rows on the Influencers tab.")
        return 1

    seen_profiles = sheets.load_seen_profiles()
    seen_posts = sheets.load_seen_posts()
    lead_seq = sheets.get_lead_id_seq()
    influencer_urls = {
        u
        for i in influencers
        if (u := normalize_source_url(i.profile_url))
    }

    apify = ApifyClient(settings.apify_token)
    all_selected_posts: list[Post] = []
    new_seen_posts: list[SeenPost] = []
    rescrape_updates: list[SeenPost] = []
    influencer_status: dict[int, tuple[str, int, str]] = {}
    # row_index -> (status, leads_delta, error_msg)

    for inf in influencers:
        try:
            raw_posts = fetch_posts_for_source(
                apify,
                profile_url=inf.profile_url,
                max_posts=inf.posts_per_run or config.DEFAULT_POSTS_PER_RUN,
                influencer_name=inf.name,
            )
            selected, updates = select_posts(raw_posts, seen_posts)
            all_selected_posts.extend(selected)
            rescrape_updates.extend(updates)
            for p in selected:
                if p.post_url not in seen_posts:
                    new_seen_posts.append(
                        SeenPost(
                            post_url=p.post_url,
                            first_scraped_at=_iso(_utc_now()),
                            comment_count_at_scrape=p.comment_count,
                        )
                    )
            influencer_status[inf.row_index] = ("ok", 0, "")
            log.info(
                "Influencer %s: fetched=%d selected=%d",
                inf.name,
                len(raw_posts),
                len(selected),
            )
        except ApifyError as exc:
            msg = f"{inf.name}: {exc}"
            log.error(msg)
            stats.errors.append(msg)
            influencer_status[inf.row_index] = ("partial", 0, str(exc))

    stats.posts_scraped = len(all_selected_posts)

    comments: list[RawComment] = []
    if all_selected_posts:
        try:
            comments = fetch_comments_for_posts(apify, all_selected_posts)
        except ApifyError as exc:
            msg = f"comments actor: {exc}"
            log.error(msg)
            stats.errors.append(msg)
    stats.comments_pulled = len(comments)

    ctx = FilterContext(seen_profiles=set(seen_profiles), influencer_urls=influencer_urls)
    drop_reasons: dict[str, int] = {}
    kept_comments: list[RawComment] = []
    for comment in comments:
        keep, reason = apply_filters(comment, ctx)
        if not keep:
            stats.dropped += 1
            drop_reasons[reason] = drop_reasons.get(reason, 0) + 1
            continue
        url = normalize_linkedin_url(comment.author_profile_url)
        if not url:
            stats.dropped += 1
            drop_reasons["no_in_url"] = drop_reasons.get("no_in_url", 0) + 1
            continue
        # In-process dedupe for this run
        if url in ctx.seen_profiles:
            stats.dropped += 1
            drop_reasons["seen_profile_in_run"] = drop_reasons.get("seen_profile_in_run", 0) + 1
            continue
        ctx.seen_profiles.add(url)
        kept_comments.append(comment)

    leads: list[Lead] = []
    new_profile_urls: list[str] = []
    leads_by_influencer: dict[str, int] = {}
    for comment in kept_comments:
        lead_seq += 1
        lead = build_lead(
            comment,
            lead_id=f"L-{lead_seq:05d}",
            owner=settings.default_owner,
        )
        if not lead:
            stats.dropped += 1
            continue
        leads.append(lead)
        new_profile_urls.append(lead.linkedin_url)
        leads_by_influencer[lead.influencer] = leads_by_influencer.get(lead.influencer, 0) + 1

    stats.kept = len(leads)
    ratio = (stats.kept / stats.comments_pulled * 100) if stats.comments_pulled else 0.0
    log.info(
        "Filter: pulled=%d kept=%d dropped=%d survive=%.1f%% reasons=%s",
        stats.comments_pulled,
        stats.kept,
        stats.dropped,
        ratio,
        drop_reasons,
    )

    # BetterContact email enrichment (skipped in DRY_RUN; phones never requested)
    if (
        settings.enable_enrichment
        and not settings.dry_run
        and leads
        and settings.bettercontact_api_key
    ):
        log.info("Enriching %d leads via BetterContact (email only)", len(leads))
        client = BetterContactClient(settings.bettercontact_api_key)
        leads, credits = enrich_leads_email_only(client, leads)
        # Rough cost: Pro ~$0.049/credit; Starter ~$0.075 — use $0.05 est
        stats.cost_est = round(credits * 0.05, 2)
        found = sum(1 for l in leads if l.email)
        valid = sum(1 for l in leads if l.email_status == "Valid")
        log.info(
            "Enrichment done credits=%d found=%d valid=%d cost_est=$%.2f",
            credits,
            found,
            valid,
            stats.cost_est,
        )
    elif settings.enable_enrichment and settings.dry_run:
        log.info("DRY_RUN: skipping BetterContact enrichment (no credits spent)")

    # Attribute leads_delta onto influencer status
    name_to_inf = {i.name: i for i in influencers}
    for name, count in leads_by_influencer.items():
        inf = name_to_inf.get(name)
        if not inf:
            continue
        status, _, err = influencer_status.get(inf.row_index, ("ok", 0, ""))
        influencer_status[inf.row_index] = (status, count, err)

    # If some influencers errored and some succeeded overall → partial on errored only
    if stats.errors and any(s[0] == "ok" for s in influencer_status.values()):
        pass
    elif stats.errors and not leads and not all_selected_posts:
        for row_idx, (st, delta, err) in list(influencer_status.items()):
            if st == "ok":
                influencer_status[row_idx] = ("error", delta, err or "run produced no posts")

    finished = _utc_now()
    stats.finished_at = _iso(finished)

    if settings.dry_run:
        print("\n=== DRY RUN — no writes ===")
        print(f"run_id: {stats.run_id}")
        print(f"posts_scraped: {stats.posts_scraped}")
        print(f"comments_pulled: {stats.comments_pulled}")
        print(f"kept: {stats.kept}  dropped: {stats.dropped}  survive: {ratio:.1f}%")
        print(f"enrichment: {'ON (skipped in dry run)' if settings.enable_enrichment else 'OFF'}")
        print(f"errors: {stats.errors}")
        print(f"drop_reasons: {drop_reasons}")
        print("\nWould write leads (first 20):")
        for lead in leads[:20]:
            line = (
                f"  {lead.lead_id} | {lead.first_name} {lead.last_name} | "
                f"{lead.linkedin_url} | {lead.influencer}\n"
                f"    comment: {lead.trigger_comment[:120]}"
            )
            print(line.encode("ascii", "replace").decode("ascii"))
        if len(leads) > 20:
            print(f"  ... and {len(leads) - 20} more")
        return 0 if not (stats.errors and stats.kept == 0 and stats.posts_scraped == 0) else 1

    payload = {
        "stats": asdict(stats),
        "leads": [asdict(l) for l in leads],
        "new_profile_urls": new_profile_urls,
        "new_seen_posts": [asdict(p) for p in new_seen_posts],
        "rescrape_updates": [asdict(p) for p in rescrape_updates],
    }
    try:
        # Order: leads → seen_profiles → seen_posts → run_log → counter → influencers
        sheets.append_leads(leads)
        sheets.append_seen_profiles(new_profile_urls)
        sheets.append_seen_posts(new_seen_posts)
        sheets.update_seen_post_counts(rescrape_updates)
        sheets.append_run_log(stats)
        sheets.set_lead_id_seq(lead_seq)
        for inf in influencers:
            st, delta, _err = influencer_status.get(inf.row_index, ("ok", 0, ""))
            if st == "ok" and stats.errors and delta == 0 and inf.row_index in influencer_status:
                # leave ok if this influencer's posts stage succeeded
                pass
            sheets.update_influencer_run(
                inf,
                last_run_at=stats.finished_at,
                status=st,
                leads_delta=delta,
            )
            # One intentional run per Active=TRUE — turn off so we don't re-hit LinkedIn
            if config.INFLUENCER_AUTO_DEACTIVATE and st == "ok":
                sheets.set_influencer_active(inf, active=False)
                log.info(
                    "Auto-deactivated influencer %s (set Active=TRUE to run again)",
                    inf.name,
                )
    except Exception as exc:  # noqa: BLE001
        path = sheets.dump_failed_run(stats.run_id, payload, settings.failed_runs_dir)
        log.exception("Sheets write failed; dumped %s", path)
        print(f"WRITE FAILED — batch dumped to {path}", file=sys.stderr)
        return 1

    log.info(
        "Run complete run_id=%s written=%d url=%s",
        stats.run_id,
        len(leads),
        sheets.spreadsheet_url(),
    )
    return 0


def main(argv: list[str] | None = None) -> None:
    # DRY_RUN may only need sheet for reads; still require sheet id
    settings = load_settings(require_apify=True, require_sheet=True)
    code = run_pipeline(settings)
    raise SystemExit(code)


if __name__ == "__main__":
    main()
