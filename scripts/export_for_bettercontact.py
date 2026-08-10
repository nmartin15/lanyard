#!/usr/bin/env python3
"""Export leads (or LinkedIn URLs from the sheet) to a BetterContact-ready CSV."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from li_harvester import config  # noqa: E402
from li_harvester.config import load_settings  # noqa: E402
from li_harvester.sheets import build_client  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export CSV for BetterContact UI bake-off / bulk upload"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="exports/bettercontact_upload.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Max rows (default 100 for bake-off)",
    )
    parser.add_argument(
        "--missing-email-only",
        action="store_true",
        help="Only rows with empty Email column",
    )
    args = parser.parse_args()

    settings = load_settings(require_apify=False, require_sheet=True)
    client = build_client(settings)
    result = client._execute(  # noqa: SLF001 — simple read helper
        client.sheets.spreadsheets()
        .values()
        .get(
            spreadsheetId=client.spreadsheet_id,
            range=f"'{config.LEADS_TAB}'!A2:N",
        )
    )
    rows = result.get("values", [])

    out_path = Path(args.output)
    if not out_path.is_absolute():
        out_path = ROOT / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # BetterContact-friendly headers
    fieldnames = [
        "first_name",
        "last_name",
        "linkedin_url",
        "lead_id",
        "influencer",
        "trigger_comment",
    ]
    written = 0
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            padded = row + [""] * (14 - len(row))
            (
                lead_id,
                _date,
                influencer,
                _post,
                comment,
                first,
                last,
                linkedin,
                email,
                *_rest,
            ) = padded[:14]
            if not linkedin:
                continue
            if args.missing_email_only and str(email).strip():
                continue
            writer.writerow(
                {
                    "first_name": first,
                    "last_name": last,
                    "linkedin_url": linkedin,
                    "lead_id": lead_id,
                    "influencer": influencer,
                    "trigger_comment": comment,
                }
            )
            written += 1
            if written >= args.limit:
                break

    print(f"Wrote {written} rows -> {out_path}")
    print("Upload this CSV in BetterContact UI (email only). Paste results back into Email / Email Status.")


if __name__ == "__main__":
    main()
