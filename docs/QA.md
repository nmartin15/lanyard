# Lanyard QA & UAT

Playbook for the testing lead and anyone signing off a build. Goal: catch defects **before** dogfood and App Store / TestFlight, not after.

## Test pyramid (what we run)

| Layer | How | When |
|-------|-----|------|
| Typecheck + lint | `npm run typecheck` · `npm run lint` | Every PR / before handoff |
| Unit + store integration | `npm test` | Every PR |
| Coverage report | `npm run test:coverage` | Weekly or before release |
| Maestro UAT (device/sim) | `npm run uat` | Before release + after intake/copy/nav changes |
| Manual UAT (this doc) | Checklist below | Every release candidate |

CI runs typecheck, lint, and Jest on pull requests (see `.github/workflows/ci.yml`).

---

## Release gate (pass / fail)

A build is **not** ready for stakeholders until:

1. `npm run typecheck && npm run lint && npm test` — all green  
2. Maestro `uat-full-flow` completes on iOS Simulator (Expo Go + Metro)  
3. Manual UAT checklist below — every **Must** item checked  
4. No open P0/P1 defects without a documented waiver  

---

## User acceptance journeys

### UAT-01 · First-time intake → Huddle (Must)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Cold open → welcome | Brand + “Let’s go” visible; no blank/error screen |
| 2 | Archetype + network | Cannot continue without picks; “Founder + investor” + altitude work |
| 3 | Goals + hard no’s | Both required; continue enabled only when filled |
| 4 | Winning voice | Draft prefilled or editable; file attach optional (cancel OK) |
| 5 | Preferences | Quiet interrupt + “always ask” selectable; email optional |
| 6 | Reveal | Correct bench for archetype (e.g. Deal lead for founder); CTA “See what’s waiting” |
| 7 | Land on Huddle | Title “What showed up overnight”; belief reflects goals |

**Fail if:** crash, stuck disabled CTA, empty team, lands on wrong tab, intake not persisted after kill/relaunch mid-flow.

### UAT-02 · Packet decisions (Must)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | From Huddle open Packets | Badge count matches pending; “Approve or pass” |
| 2 | Yes on one | Status “Approved”; Talk thread notes it; corpus gets `[packet approve]` |
| 3 | No on one | Status “Passed”; corpus `[packet kill]` |
| 4 | Tweak on one | Status “Needs a tweak”; corpus `[packet reshape]` |
| 5 | Badges | Packets badge decreases; Talk may show resolution acks |

**Fail if:** double-tap flips status again, wrong label (Approve vs Pass), badge stale after navigate away/back.

### UAT-03 · Talk loop (Must)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Open Talk | Team questions visible if overnight asked any |
| 2 | Send a reply | Appears as you; send disabled when empty |
| 3 | Clear prompts | Talk badge → 0 after answering open questions |

**Fail if:** keyboard covers Send, duplicate sends, crash on empty send.

### UAT-04 · Walk (Must text / Should voice)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Open Walk | Prompt from overnight questions (or anti-goals fallback) |
| 2 | Send text | “Saved”; message appears in Talk |
| 3 | Record voice (device) | Mic permission; Stop & send; plays on Team corpus |

**Fail if:** text never lands in Talk, empty voice URI saved, permission deny crashes app.

### UAT-05 · Overnight refresh (Must local / Should remote)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Huddle → “Run overnight again” | Spinner; new belief/packets; old kills can appear in filtered |
| 2 | Kill app, wait or skew clock >8h, reopen | Auto-refresh if stale; no duplicate stuck spinners |
| 3 | With `EXPO_PUBLIC_OVERNIGHT_URL` down | Silent fallback to local sim — app still usable |

**Fail if:** blank huddle, stuck “Running…”, crash when server 500/timeout.

### UAT-06 · Team recast + reset (Must)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Recast a seat | New title shows; survives relaunch |
| 2 | Restore original | Back to cast seat |
| 3 | Reset intake → confirm | Welcome “Let’s go”; AsyncStorage cleared; no leftover packets |

**Fail if:** reset without confirm, residual profile after reset, ProductMap alone is OK to stay dismissed.

### UAT-07 · Long brief / email (Should)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 1 | Huddle → long version | Content matches board |
| 2 | Optional email | Honest delivery note (sent / queued / error) — no fake success |

---

## Automation map

| Journey | Automated? |
|---------|------------|
| Intake business rules / cast | Jest `assembleTeam`, `intakeFlow`, `store` |
| Packet approve/pass/tweak | Jest `store` + `packets` screen test |
| Overnight + remote fallback | Jest `overnight*`, `refresh`, `overnightRemote` |
| Persistence / reset | Jest `session`, `store` |
| Product map dismiss | Jest `ProductMap` |
| Full UI spine | Maestro `.maestro/uat-full-flow.yaml` |
| Reset path | Maestro `.maestro/uat-reset.yaml` |

### Maestro how-to

```bash
# Terminal A
npm start

# Terminal B — iOS Simulator with Expo Go installed
npm run uat
# or: npx maestro test .maestro/uat-full-flow.yaml
```

If copy or a11y labels change, **update Maestro in the same PR** — stale selectors give false confidence.

---

## Defect severity (use in triage)

| Sev | Definition | Example |
|-----|------------|---------|
| P0 | Blocks core journey or data loss | Intake cannot complete; reset wipes wrong; crash on open |
| P1 | Wrong outcome / silent failure | Packet Yes doesn’t persist; overnight always empty; badge wrong |
| P2 | Confusing but recoverable | Copy mismatch; ProductMap reappears after reset |
| P3 | Polish | Spacing, non-blocking keyboard jank |

Log: **steps, expected, actual, build/commit, device, screenshot**. Prefer attaching Maestro artifact PNGs from `.maestro/artifacts/`.

---

## Known gaps (do not assume covered)

- Native mic / document picker error paths — manual only  
- Overnight server (`server/*.mjs`) — no Jest; smoke with `npm run overnight:server`  
- Physical iPhone + LAN overnight URL — must be hand-tested  
- No Auth/cloud yet — N/A  

When you find a production bug, add a **regression Jest or Maestro assert** in the same fix PR.
