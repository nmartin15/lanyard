# Setup guide — LinkedIn Lead Harvester

Follow in order.

## Part 1 — Accounts

### Apify

1. Use a **paid** Apify plan (free tier is too capped).
2. Copy your API token from Apify Console → Settings → Integrations.
3. Confirm you can run:
   - `apimaestro/linkedin-batch-profile-posts-scraper`
   - `apimaestro/linkedin-post-comments-replies-engagements-scraper-no-cookies`

### Google Cloud

1. Create or pick a GCP project; note the **project ID**.
2. Install [gcloud](https://cloud.google.com/sdk/docs/install).
3. In PowerShell:

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

4. Note the Google email that should see the sheet.

### BetterContact (email enrichment)

1. Sign up at [bettercontact.rocks](https://bettercontact.rocks) — **50 free credits**, no card.
2. Prefer **Pro ($49 / 1,000 credits)** once you’re past the bake-off (catch-all verification included).
3. Copy your API key when you’re ready to automate (Part 6). Leave `ENABLE_ENRICHMENT=false` until then.

## Part 2 — Google credentials

```powershell
cd C:\Users\nated\Projects\LI-Agent-Engaged
$env:GOOGLE_CLOUD_PROJECT = "YOUR_PROJECT_ID"
$env:GOOGLE_SHARE_WITH_EMAIL = "you@example.com"
.\scripts\setup_google.ps1
```

This enables Sheets + Drive APIs, creates SA `li-harvester@...`, writes `secrets/google-sa.json`, and updates `.env`.

**Manual fallback:** enable both APIs → create SA `li-harvester` → download JSON key to `secrets/google-sa.json` → set path + share email in `.env`.

## Part 3 — Python + workbook

```powershell
copy .env.example .env   # if setup_google did not already create .env
# Edit .env: set APIFY_TOKEN=...

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python scripts\init_workbook.py
```

You should get **HFI LinkedIn Leads** shared to your email, three tabs (`_Ops` hidden), and `SPREADSHEET_ID` in `.env`.

## Part 4 — Seed + first harvest (no enrichment spend)

1. On the `Influencers` tab, add rows: name, profile URL, `TRUE`, posts per run (e.g. `10`).
2. Dry run:

```powershell
$env:DRY_RUN = "true"
python -m li_harvester.runner
```

3. Live run (writes LinkedIn leads; Email columns stay empty while enrichment is off):

```powershell
$env:DRY_RUN = "false"
python -m li_harvester.runner
```

## Part 5 — BetterContact bake-off (UI, ~$0–15)

Do this before turning the API on. Goal: measure hit rate on **your** retail-trader audience.

```powershell
python scripts\export_for_bettercontact.py --limit 100 --missing-email-only
```

1. Upload `exports/bettercontact_upload.csv` in the BetterContact UI.
2. Request **email only** (not phone — 10× credits).
3. Score: % found, % Valid, cost per usable email.
4. Decision:
   - **Under ~30% usable** → keep LinkedIn as primary; leave enrichment off.
   - **30–60%** → enable API; expect LinkedIn to still carry volume.
   - **Over ~60%** → email is primary; keep enrichment on for live runs.

## Part 6 — Turn on BetterContact in the pipeline

In `.env`:

```env
ENABLE_ENRICHMENT=true
BETTERCONTACT_API_KEY=your_key_here
DRY_RUN=false
```

Then run as usual. The pipeline:

- Submits batches of up to 100 (async + poll)
- Requests **email only** (never phone)
- Maps statuses → `Valid` / `Catch-All` / `Invalid` / `Not Found`
- On timeout/error for a batch, still writes the lead with `Not Found` (LinkedIn URL kept)

`DRY_RUN=true` never calls BetterContact (no credit burn).

## Checklist

- [ ] Apify paid + token in `.env`
- [ ] gcloud project + login
- [ ] `secrets/google-sa.json` exists
- [ ] Sheet in your Drive + `SPREADSHEET_ID` set
- [ ] ≥1 active influencer
- [ ] Dry run OK → live harvest OK
- [ ] BetterContact bake-off on ~100 leads
- [ ] Only then `ENABLE_ENRICHMENT=true`

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sheet exists but not in Drive | `python scripts\init_workbook.py --reshare` |
| 403 from Google | Enable APIs / fix key path |
| 0 posts | Bad URL, inactive row, or Apify limits |
| Write failed | See `failed_runs\{run_id}.json` |
| Enrichment errors | Leads still written as `Not Found`; check API key / credits |

## `.env` keys

```env
APIFY_TOKEN=
GOOGLE_SERVICE_ACCOUNT_JSON=secrets/google-sa.json
GOOGLE_SHARE_WITH_EMAIL=
SPREADSHEET_ID=
DRY_RUN=true
DEFAULT_OWNER=Nate
ENABLE_ENRICHMENT=false
BETTERCONTACT_API_KEY=
```
