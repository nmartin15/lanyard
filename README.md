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
3. Packets → approve one, kill one  
4. Walk → one text reply (and optional voice)  
5. Dialogue → confirm replies landed  
6. Note anything that feels fake or confusing  

### Optional: real overnight (LLM)

```bash
cp .env.example .env
# set OPENAI_API_KEY
# for a physical iPhone, set EXPO_PUBLIC_OVERNIGHT_URL to http://YOUR_LAN_IP:8787
npm run overnight:server
# restart Expo after editing .env
```

If the URL/key is missing or the server fails, the app **falls back to local simulation**.

## What’s in Phase 0–1

- Intake → archetype, goals, corpus, constraints → **team reveal**
- Tabs: Team (recast seats), Huddle, Walk, Packets, Dialogue
- Huddle + packets generated from intake (local stand-ins until real workers)
- Local persistence (AsyncStorage): profile, intake draft, huddle, packets, corpus
- Walk voice notes + corpus file attach (local URIs; no transcription yet)
- **Local overnight simulation** (manual on Huddle/Packets; auto-refreshes on app open if >8h stale)
- Walk prompt comes from overnight huddle questions
- Packet resolve logs to Dialogue + corpus; app opens to Packets if work is pending, else Huddle
- Packets + Talk tab badges; interrupt policy shapes overnight pack size; Team shows recent corpus
- Huddle today strip links to packets / walk / dialogue; network altitude shapes overnight copy
- Walk text/voice sync into Dialogue; Team can play local voice notes
- iPhone-leaning keyboard avoidance on Walk/Talk; huddle freshness (fresh/aging/stale)
- Seat-aware overnight packets from intake confirm; packet archive + clear-board empty state
- Persisted Dialogue thread seeded from huddle questions

## Not yet

- Multi-agent overnight / true background workers (thin single-LLM `/overnight` exists)
- Walk voice transcription (STT) — deferred; captions + local audio are enough for now
- Auth + cloud sync
- Expertise rent/license marketplace (pricing deferred)

## Product spine

Intake casts different benches for different lives (e.g. entrepreneur/investor vs corporate climber). Alex journey: huddle → walk → packets → engage when high value.
