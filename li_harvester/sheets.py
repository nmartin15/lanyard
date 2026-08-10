from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from li_harvester import config
from li_harvester.config import Settings
from li_harvester.models import CompanyPerson, Influencer, Lead, RunStats, SeenPost
from li_harvester.normalize import normalize_linkedin_url

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

HEADER_BLUE = {"red": 0.10, "green": 0.22, "blue": 0.40}
HEADER_RED = {"red": 0.55, "green": 0.15, "blue": 0.15}
HEADER_GREEN = {"red": 0.18, "green": 0.45, "blue": 0.28}
WHITE = {"red": 1.0, "green": 1.0, "blue": 1.0}


class SheetsClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        creds = service_account.Credentials.from_service_account_file(
            str(settings.google_sa_json_resolved),
            scopes=SCOPES,
        )
        self.sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
        self.drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        self.spreadsheet_id = settings.spreadsheet_id

    # --- retries ---

    def _execute(self, request: Any, *, retries: int = 3) -> Any:
        delay = 1.0
        last_err: Exception | None = None
        for attempt in range(retries):
            try:
                return request.execute()
            except HttpError as exc:
                last_err = exc
                status = getattr(exc.resp, "status", None)
                if status in {429, 500, 503} and attempt < retries - 1:
                    log.warning("Sheets/Drive HTTP %s; retry in %.1fs", status, delay)
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                if attempt < retries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise
        raise last_err  # type: ignore[misc]

    # --- workbook bootstrap ---

    def create_workbook(self, title: str = config.WORKBOOK_TITLE) -> str:
        """Create spreadsheet. Prefer Drive create (works when Sheets.create 403s)."""
        try:
            created = self._execute(
                self.drive.files().create(
                    body={
                        "name": title,
                        "mimeType": "application/vnd.google-apps.spreadsheet",
                    },
                    fields="id",
                )
            )
            spreadsheet_id = created["id"]
            self.spreadsheet_id = spreadsheet_id
            self.bootstrap_workbook()
            return spreadsheet_id
        except HttpError as drive_exc:
            log.warning("Drive create failed (%s); trying Sheets.create", drive_exc)
            body = {
                "properties": {"title": title},
                "sheets": [
                    {"properties": {"title": config.INFLUENCERS_TAB, "index": 0}},
                    {"properties": {"title": config.LEADS_TAB, "index": 1}},
                    {
                        "properties": {
                            "title": config.OPS_TAB,
                            "index": 2,
                            "hidden": True,
                        }
                    },
                ],
            }
            created = self._execute(self.sheets.spreadsheets().create(body=body))
            spreadsheet_id = created["spreadsheetId"]
            self.spreadsheet_id = spreadsheet_id
            self._init_tabs(created)
            return spreadsheet_id

    def bootstrap_workbook(self) -> None:
        """Ensure the three tabs + headers/formatting exist on current spreadsheet_id."""
        meta = self._execute(
            self.sheets.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                fields="sheets.properties",
            )
        )
        titles = {s["properties"]["title"]: s for s in meta.get("sheets", [])}
        needed = [config.INFLUENCERS_TAB, config.LEADS_TAB, config.OPS_TAB]
        requests: list[dict] = []

        # Rename default "Sheet1" / "Sheet" if present and Influencers missing
        default_names = {"Sheet1", "Sheet", "Hoja 1", "Feuille 1"}
        if config.INFLUENCERS_TAB not in titles:
            for name, sheet in titles.items():
                if name in default_names:
                    requests.append(
                        {
                            "updateSheetProperties": {
                                "properties": {
                                    "sheetId": sheet["properties"]["sheetId"],
                                    "title": config.INFLUENCERS_TAB,
                                },
                                "fields": "title",
                            }
                        }
                    )
                    break

        if requests:
            self._execute(
                self.sheets.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={"requests": requests},
                )
            )
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )
            titles = {s["properties"]["title"]: s for s in meta.get("sheets", [])}
            requests = []

        for title in needed:
            if title not in titles:
                props: dict[str, Any] = {"title": title}
                if title == config.OPS_TAB:
                    props["hidden"] = True
                requests.append({"addSheet": {"properties": props}})

        if requests:
            self._execute(
                self.sheets.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={"requests": requests},
                )
            )
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )

        self._init_tabs(meta)

    def share_with_user(self, email: str, role: str = "writer") -> None:
        if not email:
            raise ValueError("GOOGLE_SHARE_WITH_EMAIL is empty")
        body = {
            "type": "user",
            "role": role,
            "emailAddress": email,
        }
        self._execute(
            self.drive.permissions().create(
                fileId=self.spreadsheet_id,
                body=body,
                sendNotificationEmail=True,
                fields="id",
            )
        )

    def spreadsheet_url(self) -> str:
        return f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}/edit"

    def ensure_workbook(self) -> None:
        meta = self._execute(
            self.sheets.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                fields="sheets.properties",
            )
        )
        titles = {s["properties"]["title"] for s in meta.get("sheets", [])}
        needed = {config.INFLUENCERS_TAB, config.LEADS_TAB, config.OPS_TAB}
        missing = needed - titles
        if missing:
            # Auto-repair instead of hard-failing
            self.bootstrap_workbook()
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )
            titles = {s["properties"]["title"] for s in meta.get("sheets", [])}
            missing = needed - titles
            if missing:
                raise RuntimeError(
                    f"Spreadsheet missing tabs {sorted(missing)}. "
                    "Re-run: python scripts/init_workbook.py --ensure-tabs"
                )
        self.ensure_influencer_headers()
        self.ensure_tier1_firms_tab()
        self.ensure_tier1_people_tab()

    def _sheet_id_map(self, meta: dict | None = None) -> dict[str, int]:
        if meta is None:
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )
        return {
            s["properties"]["title"]: s["properties"]["sheetId"]
            for s in meta.get("sheets", [])
        }

    def _init_tabs(self, created_meta: dict) -> None:
        ids = self._sheet_id_map(created_meta)
        # Headers
        self._execute(
            self.sheets.spreadsheets().values().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={
                    "valueInputOption": "RAW",
                    "data": [
                        {
                            "range": f"'{config.INFLUENCERS_TAB}'!A1:H1",
                            "values": [config.INFLUENCER_HEADERS],
                        },
                        {
                            "range": f"'{config.LEADS_TAB}'!A1:T1",
                            "values": [config.LEAD_HEADERS],
                        },
                        {
                            "range": f"'{config.OPS_TAB}'!A1",
                            "values": [["linkedin_url"]],
                        },
                        {
                            "range": f"'{config.OPS_TAB}'!D1:F1",
                            "values": [
                                [
                                    "post_url",
                                    "first_scraped_at",
                                    "comment_count_at_scrape",
                                ]
                            ],
                        },
                        {
                            "range": f"'{config.OPS_TAB}'!H1:P1",
                            "values": [
                                [
                                    "run_id",
                                    "started_at",
                                    "finished_at",
                                    "posts_scraped",
                                    "comments_pulled",
                                    "kept",
                                    "dropped",
                                    "errors",
                                    "cost_est",
                                ]
                            ],
                        },
                        {
                            "range": f"'{config.OPS_TAB}'!R1:S2",
                            "values": [
                                ["key", "value"],
                                ["last_lead_id_seq", 0],
                            ],
                        },
                    ],
                },
            )
        )

        # Due formulas for rows 2–5000
        due_values = [
            [config.DUE_FORMULA_TEMPLATE.format(row=r)] for r in range(2, 5001)
        ]
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.LEADS_TAB}'!S2:S5000",
                valueInputOption="USER_ENTERED",
                body={"values": due_values},
            )
        )

        leads_id = ids[config.LEADS_TAB]
        ops_id = ids[config.OPS_TAB]
        requests: list[dict] = [
            {
                "repeatCell": {
                    "range": {
                        "sheetId": leads_id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": 14,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": HEADER_BLUE,
                            "textFormat": {
                                "foregroundColor": WHITE,
                                "bold": True,
                            },
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            },
            {
                "repeatCell": {
                    "range": {
                        "sheetId": leads_id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 14,
                        "endColumnIndex": 18,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": HEADER_RED,
                            "textFormat": {
                                "foregroundColor": WHITE,
                                "bold": True,
                            },
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            },
            {
                "repeatCell": {
                    "range": {
                        "sheetId": leads_id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 18,
                        "endColumnIndex": 19,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": HEADER_GREEN,
                            "textFormat": {
                                "foregroundColor": WHITE,
                                "bold": True,
                            },
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            },
            {
                "repeatCell": {
                    "range": {
                        "sheetId": leads_id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 19,
                        "endColumnIndex": 20,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": HEADER_RED,
                            "textFormat": {
                                "foregroundColor": WHITE,
                                "bold": True,
                            },
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": leads_id,
                        "gridProperties": {"frozenRowCount": 1},
                    },
                    "fields": "gridProperties.frozenRowCount",
                }
            },
            {
                "setBasicFilter": {
                    "filter": {
                        "range": {
                            "sheetId": leads_id,
                            "startRowIndex": 0,
                            "endRowIndex": 5000,
                            "startColumnIndex": 0,
                            "endColumnIndex": 20,
                        }
                    }
                }
            },
            {
                "setDataValidation": {
                    "range": {
                        "sheetId": leads_id,
                        "startRowIndex": 1,
                        "endRowIndex": 5000,
                        "startColumnIndex": 15,
                        "endColumnIndex": 16,
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [
                                {"userEnteredValue": v} for v in config.STATUS_VALUES
                            ],
                        },
                        "showCustomUi": True,
                        "strict": False,
                    },
                }
            },
            {
                "addConditionalFormatRule": {
                    "rule": {
                        "ranges": [
                            {
                                "sheetId": leads_id,
                                "startRowIndex": 1,
                                "endRowIndex": 5000,
                                "startColumnIndex": 18,
                                "endColumnIndex": 19,
                            }
                        ],
                        "booleanRule": {
                            "condition": {
                                "type": "TEXT_EQ",
                                "values": [{"userEnteredValue": "DUE"}],
                            },
                            "format": {
                                "backgroundColor": {
                                    "red": 1.0,
                                    "green": 0.85,
                                    "blue": 0.4,
                                }
                            },
                        },
                    },
                    "index": 0,
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {"sheetId": ops_id, "hidden": True},
                    "fields": "hidden",
                }
            },
        ]
        self._execute(
            self.sheets.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={"requests": requests},
            )
        )

    # --- reads ---

    def read_influencers(self) -> list[Influencer]:
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.INFLUENCERS_TAB}'!A2:H",
            )
        )
        rows = result.get("values", [])
        out: list[Influencer] = []
        for i, row in enumerate(rows, start=2):
            padded = row + [""] * (8 - len(row))
            (
                name,
                url,
                active_raw,
                posts_raw,
                last_at,
                status,
                leads_raw,
                reactions_raw,
            ) = padded[:8]
            url = str(url).strip()
            name = str(name).strip()
            if not url:
                continue
            # Defaults: blank Active => TRUE; blank Posts Per Run => 10
            active_text = str(active_raw).strip().upper()
            if active_text == "":
                active = True
            else:
                active = active_text in {"TRUE", "1", "YES", "Y"}
            # Include Reactions: blank/FALSE => off (existing retail sources stay comments-only)
            reactions_text = str(reactions_raw).strip().upper()
            include_reactions = reactions_text in {"TRUE", "1", "YES", "Y"}
            try:
                posts = (
                    int(float(posts_raw))
                    if str(posts_raw).strip()
                    else config.DEFAULT_POSTS_PER_RUN
                )
            except ValueError:
                posts = config.DEFAULT_POSTS_PER_RUN
            try:
                leads = int(float(leads_raw)) if str(leads_raw).strip() else 0
            except ValueError:
                leads = 0
            out.append(
                Influencer(
                    row_index=i,
                    name=name or url,
                    profile_url=url,
                    active=active,
                    posts_per_run=posts,
                    last_run_at=str(last_at).strip(),
                    last_run_status=str(status).strip(),
                    leads_found=leads,
                    include_reactions=include_reactions,
                )
            )
        return out

    def ensure_influencer_headers(self) -> None:
        """Write/refresh Influencers A1:H1 so Include Reactions exists on older workbooks."""
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.INFLUENCERS_TAB}'!A1:H1",
                valueInputOption="RAW",
                body={"values": [config.INFLUENCER_HEADERS]},
            )
        )

    def ensure_tier1_firms_tab(self) -> None:
        """Create/format Tier1Firms (same column shape as Influencers) and seed sample firms."""
        meta = self._execute(
            self.sheets.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                fields="sheets.properties",
            )
        )
        titles = {
            s["properties"]["title"]: s["properties"]["sheetId"]
            for s in meta.get("sheets", [])
        }
        if config.TIER1_FIRMS_TAB not in titles:
            self._execute(
                self.sheets.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={
                        "requests": [
                            {
                                "addSheet": {
                                    "properties": {
                                        "title": config.TIER1_FIRMS_TAB,
                                        "index": 1,
                                    }
                                }
                            }
                        ]
                    },
                )
            )
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )
            titles = {
                s["properties"]["title"]: s["properties"]["sheetId"]
                for s in meta.get("sheets", [])
            }

        sheet_id = titles[config.TIER1_FIRMS_TAB]
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_FIRMS_TAB}'!A1:I1",
                valueInputOption="RAW",
                body={"values": [config.TIER1_FIRM_HEADERS]},
            )
        )
        self._execute(
            self.sheets.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={
                    "requests": [
                        {
                            "repeatCell": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "startRowIndex": 0,
                                    "endRowIndex": 1,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 9,
                                },
                                "cell": {
                                    "userEnteredFormat": {
                                        "backgroundColor": HEADER_BLUE,
                                        "textFormat": {
                                            "foregroundColor": WHITE,
                                            "bold": True,
                                        },
                                        "horizontalAlignment": "CENTER",
                                    }
                                },
                                "fields": (
                                    "userEnteredFormat(backgroundColor,textFormat,"
                                    "horizontalAlignment)"
                                ),
                            }
                        },
                        {
                            "updateSheetProperties": {
                                "properties": {
                                    "sheetId": sheet_id,
                                    "gridProperties": {"frozenRowCount": 1},
                                },
                                "fields": "gridProperties.frozenRowCount",
                            }
                        },
                    ]
                },
            )
        )

        existing = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_FIRMS_TAB}'!A2:B",
            )
        )
        existing_urls = {
            str(r[1]).strip().rstrip("/").lower()
            for r in existing.get("values", [])
            if len(r) > 1 and str(r[1]).strip()
        }
        rows_to_add: list[list] = []
        for firm in config.TIER1_SEED_FIRMS:
            url = firm["url"].rstrip("/")
            if url.lower() in existing_urls:
                continue
            rows_to_add.append(
                [
                    firm["name"],
                    firm["url"],
                    firm["active"],
                    firm["posts_per_run"],
                    "",
                    "",
                    0,
                    firm["include_reactions"],
                ]
            )
        if rows_to_add:
            self._execute(
                self.sheets.spreadsheets().values().append(
                    spreadsheetId=self.spreadsheet_id,
                    range=f"'{config.TIER1_FIRMS_TAB}'!A:H",
                    valueInputOption="RAW",
                    insertDataOption="INSERT_ROWS",
                    body={"values": rows_to_add},
                )
            )
            log.info(
                "Tier1Firms: seeded %d firm(s): %s",
                len(rows_to_add),
                ", ".join(r[0] for r in rows_to_add),
            )

    def ensure_tier1_people_tab(self) -> None:
        """Create/format Tier1People destination tab for people-at-company rows."""
        meta = self._execute(
            self.sheets.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                fields="sheets.properties",
            )
        )
        titles = {
            s["properties"]["title"]: s["properties"]["sheetId"]
            for s in meta.get("sheets", [])
        }
        if config.TIER1_PEOPLE_TAB not in titles:
            self._execute(
                self.sheets.spreadsheets().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={
                        "requests": [
                            {
                                "addSheet": {
                                    "properties": {
                                        "title": config.TIER1_PEOPLE_TAB,
                                        "index": 2,
                                    }
                                }
                            }
                        ]
                    },
                )
            )
            meta = self._execute(
                self.sheets.spreadsheets().get(
                    spreadsheetId=self.spreadsheet_id,
                    fields="sheets.properties",
                )
            )
            titles = {
                s["properties"]["title"]: s["properties"]["sheetId"]
                for s in meta.get("sheets", [])
            }

        sheet_id = titles[config.TIER1_PEOPLE_TAB]
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_PEOPLE_TAB}'!A1:I1",
                valueInputOption="RAW",
                body={"values": [config.TIER1_PEOPLE_HEADERS]},
            )
        )
        self._execute(
            self.sheets.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={
                    "requests": [
                        {
                            "repeatCell": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "startRowIndex": 0,
                                    "endRowIndex": 1,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": 9,
                                },
                                "cell": {
                                    "userEnteredFormat": {
                                        "backgroundColor": HEADER_BLUE,
                                        "textFormat": {
                                            "foregroundColor": WHITE,
                                            "bold": True,
                                        },
                                        "horizontalAlignment": "CENTER",
                                    }
                                },
                                "fields": (
                                    "userEnteredFormat(backgroundColor,textFormat,"
                                    "horizontalAlignment)"
                                ),
                            }
                        },
                        {
                            "updateSheetProperties": {
                                "properties": {
                                    "sheetId": sheet_id,
                                    "gridProperties": {"frozenRowCount": 1},
                                },
                                "fields": "gridProperties.frozenRowCount",
                            }
                        },
                    ]
                },
            )
        )

    def read_tier1_firms(self) -> list[Influencer]:
        """Read Tier1Firms rows (company sources for people path)."""
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_FIRMS_TAB}'!A2:I",
            )
        )
        rows = result.get("values", [])
        out: list[Influencer] = []
        for i, row in enumerate(rows, start=2):
            padded = row + [""] * (9 - len(row))
            (
                name,
                url,
                active_raw,
                posts_raw,
                last_at,
                status,
                leads_raw,
                reactions_raw,
                title_mode_raw,
            ) = padded[:9]
            url = str(url).strip()
            name = str(name).strip()
            if not url:
                continue
            active_text = str(active_raw).strip().upper()
            active = True if active_text == "" else active_text in {"TRUE", "1", "YES", "Y"}
            reactions_text = str(reactions_raw).strip().upper()
            include_reactions = reactions_text in {"TRUE", "1", "YES", "Y"}
            title_mode = str(title_mode_raw).strip().upper()
            if title_mode in {"ICP", "TRUE", "1", "YES", "Y"}:
                title_mode = "ICP"
            else:
                title_mode = ""
            try:
                posts = (
                    int(float(posts_raw))
                    if str(posts_raw).strip()
                    else config.DEFAULT_POSTS_PER_RUN
                )
            except ValueError:
                posts = config.DEFAULT_POSTS_PER_RUN
            try:
                leads = int(float(leads_raw)) if str(leads_raw).strip() else 0
            except ValueError:
                leads = 0
            out.append(
                Influencer(
                    row_index=i,
                    name=name or url,
                    profile_url=url,
                    active=active,
                    posts_per_run=posts,
                    last_run_at=str(last_at).strip(),
                    last_run_status=str(status).strip(),
                    leads_found=leads,
                    include_reactions=include_reactions,
                    title_mode=title_mode,
                )
            )
        return out

    def load_tier1_people_urls(self) -> set[str]:
        """Existing LinkedIn URLs on Tier1People (column F) for dedupe."""
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_PEOPLE_TAB}'!F2:F",
            )
        )
        urls: set[str] = set()
        for row in result.get("values", []):
            if not row:
                continue
            normalized = normalize_linkedin_url(str(row[0]).strip())
            if normalized:
                urls.add(normalized)
        return urls

    def append_tier1_people(self, people: list[CompanyPerson]) -> None:
        if not people:
            return
        self._execute(
            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_PEOPLE_TAB}'!A:I",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={"values": [p.to_sheet_row() for p in people]},
            )
        )

    def delete_tier1_people_rows(self, row_indexes_1based: list[int]) -> None:
        """Delete Tier1People data rows (1-based sheet rows). Highest first."""
        if not row_indexes_1based:
            return
        ids = self._sheet_id_map()
        sheet_id = ids[config.TIER1_PEOPLE_TAB]
        requests = [
            {
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": row - 1,
                        "endIndex": row,
                    }
                }
            }
            for row in sorted(row_indexes_1based, reverse=True)
        ]
        self._execute(
            self.sheets.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={"requests": requests},
            )
        )

    def update_tier1_firm_run(
        self,
        firm: Influencer,
        *,
        last_run_at: str,
        status: str,
        people_delta: int,
    ) -> None:
        new_total = firm.leads_found + people_delta
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_FIRMS_TAB}'!E{firm.row_index}:G{firm.row_index}",
                valueInputOption="RAW",
                body={"values": [[last_run_at, status, new_total]]},
            )
        )

    def set_tier1_firm_active(self, firm: Influencer, *, active: bool) -> None:
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.TIER1_FIRMS_TAB}'!C{firm.row_index}",
                valueInputOption="RAW",
                body={"values": [["TRUE" if active else "FALSE"]]},
            )
        )

    def load_seen_profiles(self) -> set[str]:
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!A2:A",
            )
        )
        return {str(r[0]).strip() for r in result.get("values", []) if r and r[0]}

    def load_seen_posts(self) -> dict[str, SeenPost]:
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!D2:F",
            )
        )
        out: dict[str, SeenPost] = {}
        for row in result.get("values", []):
            padded = row + [""] * (3 - len(row))
            url, scraped_at, count_raw = padded[:3]
            if not url:
                continue
            try:
                count = int(float(count_raw)) if str(count_raw).strip() else 0
            except ValueError:
                count = 0
            out[str(url).strip()] = SeenPost(
                post_url=str(url).strip(),
                first_scraped_at=str(scraped_at).strip(),
                comment_count_at_scrape=count,
            )
        return out

    def get_lead_id_seq(self) -> int:
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!R2:S2",
            )
        )
        rows = result.get("values", [])
        if not rows:
            return 0
        row = rows[0] + [""] * 2
        try:
            return int(float(row[1])) if str(row[1]).strip() else 0
        except ValueError:
            return 0

    # --- writes ---

    def append_leads(self, leads: list[Lead]) -> None:
        if not leads:
            return
        values = []
        for lead in leads:
            row = lead.to_sheet_row()
            # Column S (index 18) must keep formula — leave empty so existing
            # prefilled formulas remain; append adds rows below formula range
            # so we set USER_ENTERED Due formula per new row.
            values.append(row)

        # Append A:T then patch Due formulas for the new block
        start_hint = self._next_leads_row()
        self._execute(
            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.LEADS_TAB}'!A:T",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": values},
            )
        )
        due_rows = [
            [config.DUE_FORMULA_TEMPLATE.format(row=start_hint + i)]
            for i in range(len(leads))
        ]
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.LEADS_TAB}'!S{start_hint}:S{start_hint + len(leads) - 1}",
                valueInputOption="USER_ENTERED",
                body={"values": due_rows},
            )
        )

    def _next_leads_row(self) -> int:
        result = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.LEADS_TAB}'!A:A",
            )
        )
        return len(result.get("values", [])) + 1

    def append_seen_profiles(self, urls: list[str]) -> None:
        if not urls:
            return
        self._execute(
            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!A:A",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={"values": [[u] for u in urls]},
            )
        )

    def append_seen_posts(self, posts: list[SeenPost]) -> None:
        if not posts:
            return
        self._execute(
            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!D:F",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={
                    "values": [
                        [p.post_url, p.first_scraped_at, p.comment_count_at_scrape]
                        for p in posts
                    ]
                },
            )
        )

    def update_seen_post_counts(self, updates: list[SeenPost]) -> None:
        """Update comment_count for posts already in seen_posts (re-scrape case)."""
        if not updates:
            return
        existing = self._execute(
            self.sheets.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!D2:F",
            )
        )
        rows = existing.get("values", [])
        url_to_row = {}
        for i, row in enumerate(rows, start=2):
            if row and row[0]:
                url_to_row[str(row[0]).strip()] = i
        data = []
        for post in updates:
            row_idx = url_to_row.get(post.post_url)
            if not row_idx:
                continue
            data.append(
                {
                    "range": f"'{config.OPS_TAB}'!F{row_idx}",
                    "values": [[post.comment_count_at_scrape]],
                }
            )
        if data:
            self._execute(
                self.sheets.spreadsheets().values().batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={"valueInputOption": "RAW", "data": data},
                )
            )

    def append_run_log(self, stats: RunStats) -> None:
        self._execute(
            self.sheets.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!H:P",
                valueInputOption="RAW",
                insertDataOption="INSERT_ROWS",
                body={
                    "values": [
                        [
                            stats.run_id,
                            stats.started_at,
                            stats.finished_at,
                            stats.posts_scraped,
                            stats.comments_pulled,
                            stats.kept,
                            stats.dropped,
                            stats.error_count(),
                            stats.cost_est,
                        ]
                    ]
                },
            )
        )

    def set_lead_id_seq(self, seq: int) -> None:
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.OPS_TAB}'!R2:S2",
                valueInputOption="RAW",
                body={"values": [["last_lead_id_seq", seq]]},
            )
        )

    def update_influencer_run(
        self,
        influencer: Influencer,
        *,
        last_run_at: str,
        status: str,
        leads_delta: int,
    ) -> None:
        new_total = influencer.leads_found + leads_delta
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.INFLUENCERS_TAB}'!E{influencer.row_index}:G{influencer.row_index}",
                valueInputOption="RAW",
                body={"values": [[last_run_at, status, new_total]]},
            )
        )

    def set_influencer_active(self, influencer: Influencer, *, active: bool) -> None:
        self._execute(
            self.sheets.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{config.INFLUENCERS_TAB}'!C{influencer.row_index}",
                valueInputOption="RAW",
                body={"values": [["TRUE" if active else "FALSE"]]},
            )
        )

    def dump_failed_run(self, run_id: str, payload: dict, directory: Path) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{run_id}.json"
        path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
        return path


def build_client(settings: Settings) -> SheetsClient:
    if not settings.google_sa_json_resolved.exists():
        raise SystemExit(
            f"Service account JSON not found: {settings.google_sa_json_resolved}\n"
            "Run: .\\scripts\\setup_google.ps1"
        )
    return SheetsClient(settings)
