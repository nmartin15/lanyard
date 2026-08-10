# LinkedIn Lead Harvester

Apify pulls commenters from retail trading influencers’ LinkedIn posts. Rules strip junk. Real people land in Google Sheets with their comment attached.

**v1 scope:** Apify in → filter → Sheets out. Sources can be personal `/in/` profiles **or** `/company/` pages. Optional **BetterContact** email enrichment (off by default until bake-off). No phones, sending, database, or LLM.

## Quick start

See **[SETUP.md](SETUP.md)** for the full walkthrough.

```powershell
.\scripts\setup_google.ps1
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# set APIFY_TOKEN in .env
python scripts\init_workbook.py
# seed Influencers tab
$env:DRY_RUN = "true"
python -m li_harvester.runner
```

## Layout

```
li_harvester/
  config.py      env + sheet constants
  models.py      Post, RawComment, Lead
  normalize.py   URL + name cleanup
  filters.py     junk rules (edit this weekly)
  apify.py       actor run / poll / map
  enrich.py      BetterContact email waterfall
  sheets.py      Sheets + Drive
  runner.py      orchestration
scripts/
  setup_google.ps1
  init_workbook.py
  export_for_bettercontact.py
tests/
```

## Workbook tabs

| Tab | Role |
|---|---|
| `Influencers` | Retail sources → posts/comments → leads |
| `HFI Leads - LinkedIn Posts` | Deliverable commenter leads (20 columns) |
| `Tier1Firms` | Quant firm company URLs (people path only) |
| `Tier1People` | People-at-company output |
| `_Ops` | Hidden dedupe + run log + counters |

```powershell
# Tier1 people-at-company (separate from Influencers harvest)
$env:DRY_RUN = "true"
python -m li_harvester.people_runner
```

## Tests

```powershell
pytest -q
```

## BetterContact

1. Harvest leads with `ENABLE_ENRICHMENT=false`.
2. `python scripts/export_for_bettercontact.py --limit 100`
3. Upload to BetterContact UI; measure hit rate.
4. Set `ENABLE_ENRICHMENT=true` + `BETTERCONTACT_API_KEY` when you’re happy.

Phone enrichment stays off (10 credits each + TCPA). Instantly / Botdog / CRM are later.
