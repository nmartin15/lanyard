#!/usr/bin/env python3
"""Create (or reshare/ensure) the HFI LinkedIn Leads workbook and write SPREADSHEET_ID to .env."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from li_harvester import config  # noqa: E402
from li_harvester.config import load_settings, upsert_env_value  # noqa: E402
from li_harvester.sheets import SheetsClient, build_client  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Create/share Google workbook for LI Harvester")
    parser.add_argument(
        "--reshare",
        action="store_true",
        help="Re-share existing SPREADSHEET_ID with GOOGLE_SHARE_WITH_EMAIL",
    )
    parser.add_argument(
        "--ensure-tabs",
        action="store_true",
        help="Verify tabs exist on existing spreadsheet (no create)",
    )
    parser.add_argument(
        "--title",
        default=config.WORKBOOK_TITLE,
        help="Spreadsheet title when creating",
    )
    parser.add_argument(
        "--spreadsheet-id",
        default="",
        help="Use an existing spreadsheet you created/shared (skip SA file create)",
    )
    args = parser.parse_args()

    # Don't require spreadsheet id or apify for init
    settings = load_settings(require_apify=False, require_sheet=False)
    client = build_client(settings)
    share_email = settings.google_share_with_email
    existing_id = (args.spreadsheet_id or settings.spreadsheet_id).strip()

    if args.spreadsheet_id:
        client.spreadsheet_id = args.spreadsheet_id.strip()
        client.bootstrap_workbook()
        upsert_env_value("SPREADSHEET_ID", client.spreadsheet_id)
        print("Bootstrapped existing spreadsheet.")
        print(f"  ID:  {client.spreadsheet_id}")
        print(f"  URL: {client.spreadsheet_url()}")
        print("  .env: SPREADSHEET_ID updated")
        print()
        print("Next: seed the Influencers tab, then:")
        print("  $env:DRY_RUN='true'; python -m li_harvester.runner")
        return

    if existing_id and (args.reshare or args.ensure_tabs):
        client.spreadsheet_id = existing_id
        if args.ensure_tabs:
            client.ensure_workbook()
            print(f"Tabs OK on {client.spreadsheet_url()}")
        if args.reshare:
            if not share_email:
                raise SystemExit("GOOGLE_SHARE_WITH_EMAIL is empty; save .env then retry --reshare")
            client.share_with_user(share_email)
            print(f"Shared writer access with {share_email}")
        return

    if existing_id and not args.reshare:
        client.spreadsheet_id = existing_id
        try:
            client.ensure_workbook()
            print("SPREADSHEET_ID already set and tabs look OK.")
            print(client.spreadsheet_url())
            print("Use --reshare to share again, or clear SPREADSHEET_ID to create a new workbook.")
            return
        except Exception:  # noqa: BLE001
            print("Existing SPREADSHEET_ID invalid; creating a new workbook...")

    try:
        spreadsheet_id = client.create_workbook(title=args.title)
    except Exception as exc:  # noqa: BLE001
        import json
        from pathlib import Path

        sa = json.loads(Path(settings.google_sa_json_resolved).read_text(encoding="utf-8"))
        sa_email = sa.get("client_email", "li-harvester@...iam.gserviceaccount.com")
        print("Could not create spreadsheet via API:")
        print(f"  {exc}")
        print()
        print("Manual workaround (recommended):")
        print("  1. In your browser, create a blank Google Sheet named HFI LinkedIn Leads")
        print(f"  2. Share it with Editor access to: {sa_email}")
        print("  3. Copy the spreadsheet ID from the URL:")
        print("       https://docs.google.com/spreadsheets/d/<THIS_PART>/edit")
        print("  4. Run:")
        print("       python scripts\\init_workbook.py --spreadsheet-id <THIS_PART>")
        raise SystemExit(1) from exc

    upsert_env_value("SPREADSHEET_ID", spreadsheet_id)

    print("Workbook created.")
    print(f"  ID:    {spreadsheet_id}")
    print(f"  URL:   {client.spreadsheet_url()}")
    print("  .env:  SPREADSHEET_ID updated")

    if share_email:
        try:
            client.share_with_user(share_email)
            print(f"  Share: {share_email} (writer)")
        except Exception as exc:  # noqa: BLE001
            print(f"  Share failed ({exc}); open the URL while signed into Google")
    else:
        print("  Share: SKIPPED (GOOGLE_SHARE_WITH_EMAIL empty on disk)")

    print()
    print("Next: seed the Influencers tab, then:")
    print("  $env:DRY_RUN='true'; python -m li_harvester.runner")


if __name__ == "__main__":
    main()
