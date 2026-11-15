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
- **Local overnight simulation** (Huddle → Run overnight hunt; auto-runs if huddle is >8h stale)
- Seat-aware overnight packets; persisted Dialogue thread seeded from huddle questions

## Not yet

- Real overnight workers / agent-to-agent (swap in behind the same `runOvernight` seam)
- Walk voice transcription (STT) — deferred; captions + local audio are enough for now
- Expertise rent/license marketplace (pricing deferred)

## Product spine

Intake casts different benches for different lives (e.g. entrepreneur/investor vs corporate climber). Alex journey: huddle → walk → packets → engage when high value.
