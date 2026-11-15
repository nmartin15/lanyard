# Lanyard

**Mobile only.** You sit. Your team works.

Private advocacy team cast from intake. Sub-agents hunt (career / business / capital / as cast), go out carefully, come back to iterate with you. No spam. No feed.

## Run

```bash
npm install
npm start
# then i / a / w
```

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

- Real overnight workers / agent-to-agent (swap in behind the same `runOvernight` seam)
- Walk voice transcription (STT) — deferred; captions + local audio are enough for now
- Expertise rent/license marketplace (pricing deferred)

## Product spine

Intake casts different benches for different lives (e.g. entrepreneur/investor vs corporate climber). Alex journey: huddle → walk → packets → engage when high value.
