# Lanyard

**Mobile only.** You sit. Your team works.

Private advocacy team cast from intake. Sub-agents hunt (career / business / capital / as cast), go out carefully, come back to iterate with you. No spam. No feed.

## Run

```bash
npm install
npm start
# then press i for iOS Simulator, or scan the QR in Expo Go on your iPhone
```

### Dogfood checklist (iPhone)

1. Finish intake → confirm team  
2. Huddle → skim belief / chasing / questions  
3. Packets → approve one, pass one (optional tweak)  
4. Walk → one text reply (and optional voice)  
5. Talk → confirm replies landed  
6. Note anything that feels fake or confusing  

Full QA / UAT playbook (release gates, Maestro, severity): [`docs/QA.md`](docs/QA.md)

```bash
npm run test:ci   # typecheck + lint + Jest
npm run uat       # Maestro full flow (Expo Go + Metro on :8081)
```

### Optional: real overnight (LLM)

```bash
cp .env.example .env
# set OPENAI_API_KEY
# for a physical iPhone, set EXPO_PUBLIC_OVERNIGHT_URL to http://YOUR_LAN_IP:8787
npm run overnight:server
# restart Expo after editing .env
```

If the URL/key is missing or the server fails, the app **falls back to local simulation**.

### Gmail send (real)

One-time Google Cloud setup — every click, no skipped steps:

**[`docs/CONNECT_GMAIL.md`](docs/CONNECT_GMAIL.md)**

After that: Team → **Connect Gmail** → Allow → Decisions → type **To** → **Send**.

## What’s in Phase 0–1

- Intake → archetype, goals, corpus, constraints → **team reveal**
- Tabs: Team (recast seats), Huddle, Walk, Packets, Dialogue
- Huddle + packets generated from intake (local stand-ins until real workers)
- Local persistence (AsyncStorage): profile, intake draft, huddle, packets, corpus
- Walk voice notes + corpus file attach (local URIs; no transcription yet)
- **Local overnight simulation** (manual on Huddle/Packets; auto-refreshes on app open if >8h stale)
- Walk prompt comes from overnight huddle questions
- Packet resolve logs to Dialogue + corpus; after intake the app always opens on Huddle first
- Packets + Talk tab badges; interrupt policy shapes overnight pack size; Team shows recent corpus
- Huddle today strip links to packets / walk / dialogue; network altitude shapes overnight copy
- Walk text/voice sync into Dialogue; Team can play local voice notes
- iPhone-leaning keyboard avoidance on Walk/Talk; huddle freshness (fresh/aging/stale)
- Seat-aware overnight packets from intake confirm; packet archive + clear-board empty state
- Persisted Dialogue thread seeded from huddle questions

## Not yet

- Multi-agent overnight / true background workers (thin single-LLM `/overnight` exists)
- Walk voice transcription (STT) — deferred; captions + local audio are enough for now
- Microsoft 365 send (Gmail works — see CONNECT_GMAIL.md)
- Cloud sync of profile across devices
- Expertise rent/license marketplace (pricing deferred)

## Product spine

Intake casts different benches for different lives (e.g. entrepreneur/investor vs corporate climber). Alex journey: huddle → walk → packets → engage when high value.
