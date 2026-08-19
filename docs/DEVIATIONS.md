# Deviations

Every place this build departs from the PRD or the Bhorosha Design System, why, and what it would
take to close the gap. Ordered by how much it matters.

Where the two source documents conflicted, the resolution followed the stated hierarchy:
**PRD for product behaviour, Design System for anything the citizen sees.**

---

## 1. PostgreSQL + Redis → libSQL, no second service

**PRD §37** specifies PostgreSQL with pgvector, Redis, BullMQ, and a NestJS backend in a Turborepo
monorepo (§82).

**Built:** one Next.js app; Route Handlers as the API layer; libSQL (SQLite dialect) via Drizzle;
rate limiting and job bookkeeping in the primary database.

**Why:** the PRD stack cannot start without Docker, a database, and credentials, which means no
flow could have been verified before delivery. This was raised and confirmed with you before any
code was written.

**Containment.** Business logic is framework-free: services import no `Request`, no `Response`, and
nothing from `next/*`. Route handlers only parse, guard, and serialise.

```
src/app/api/v1/**/route.ts   ← adapter, replaceable
src/modules/**/*.service.ts  ← moves to a NestJS provider unchanged
src/lib/db/client.ts         ← the ONLY file that knows the SQL engine
```

**To close it:** swap `drizzle-orm/libsql` for `drizzle-orm/node-postgres` in `client.ts`, change
the column helpers in `schema.ts` (`integer timestamp_ms` → `timestamptz`, `text json` → `jsonb`),
point `drizzle.config.ts` at Postgres, and move `rateLimitBuckets` to Redis. The services and
routes do not change.

---

## 2. PRD Part 7 does not exist — the knowledge pipeline was authored

**The gap.** The source PRD numbers sections 1→100, then jumps to "118. Production Deployment
Strategy". Sections 101–117 — **Part 7, Knowledge Base & Data Pipeline** — are absent. The document
announces the omission itself. So there is no specification for: which programmes are in v1, the
source for each, who authors `rule_json`, who reviews it, the staleness policy, or the licensing
position on redistributing government circulars.

That is not a small gap. It is the part that determines whether anything the platform says is true.

**What was authored instead** — [docs/KNOWLEDGE-PIPELINE.md](KNOWLEDGE-PIPELINE.md), implemented as:

| Concern | Implementation |
|---|---|
| Trust states | `verification_status`: `unverified_sample` → `pending_review` → `verified`, plus `outdated` and `disputed` |
| Provenance | `source_url`, `source_note`, `last_verified_at`, `verified_by`, `review_interval_days` per record |
| Licensing | `documents.license_note` per source document |
| Review workflow | `knowledge_reviews`; nothing becomes `verified` without an administrator decision |
| Separation of duties | A moderator may triage; only an administrator may verify (enforced, tested) |
| Anti-self-certification | Verifying and editing in the same request is refused with 422 |
| Staleness | `detect_staleness` job flags verified records past their review interval as `outdated` and closes expired programmes |
| Versioning | Any content change bumps `version` and drops `verified` back to `pending_review` |
| Consequence | The confidence scorer caps `unverified_sample` at 65%; the UI badges it everywhere |

**The corpus is 42 authored programmes**, structured after real Bangladeshi programmes
administered by real bodies (DSS, DWA, DAE, BMET, NLASO, SME Foundation, BRAC, BLAST…), across all
11 PRD categories. **The thresholds and amounts are representative, not verified.** Replacing them
requires no code change — the admin portal owns the corpus.

---

## 3. pgvector → BM25, with vectors optional

**PRD §37** specifies pgvector; **§26** requires hybrid retrieval (semantic + keyword + metadata +
structured).

**Built:** metadata pre-filtering in SQL, then BM25 over pre-computed per-chunk term frequencies,
fused with cosine similarity over stored embeddings **when an embedding provider is configured**.
Scores are combined with Reciprocal Rank Fusion rather than a weighted sum, because BM25 and cosine
are on incomparable scales and any fixed weighting between them is arbitrary.

Without a key the semantic channel contributes **nothing** rather than being simulated, and
`retrieval.mode` reports `lexical only (BM25)` in the admin panel. The retriever returns an empty
result when neither channel scores anything, so the caller reports "no verified information"
instead of surfacing arbitrary rows.

Vectors live in a JSON column and cosine is computed in process — correct for hundreds of chunks,
and interface-identical to a pgvector swap.

---

## 4. The eligibility rule grammar was designed, not specified

**PRD §24** mandates that the engine must not use an LLM and says only *"Store rules as JSON"*, then
requires outputs including `Unknown` (§17) and reasoning for every decision (§18).

Those requirements need three things the PRD does not define, so they were designed:

1. **Three-valued logic.** A missing profile field yields `unknown`, never `false`. Treating absent
   data as failure would silently deny benefits — the exact harm §22 exists to prevent. `unknown`
   propagates: an `all` group with an unknown and no failure is `unknown`, not eligible.
2. **A hard bar still decides.** A man applying to a women-only programme is `not_eligible` even
   with income unrecorded, so the system does not ask him pointless questions.
3. **Explanation as data.** Every condition carries its citizen-facing reason for met, failed, and
   unknown, in both languages. The model never authors a reason; it re-voices what the engine
   emitted.

Also designed: soft conditions (fail → `partially_eligible`, never disqualifying), weights driving
both the ranking score and reason ordering, and rule **versioning** so a stored decision can be
replayed against the exact rule that produced it.

`tests/eligibility/engine.test.ts` — 28 assertions.

---

## 5. Prompt templates are `.ts`, not `.md`

**PRD §90** requires prompts to live outside services, be version-controlled, and be reviewable by
non-developers, illustrated with `.md` files.

**Built:** `src/prompts/index.ts` — plain template strings with a `version` field written to
`ai_logs.prompt_version` on every call. Chosen over `.md` because raw-text imports need bundler
configuration that would break the Edge runtime, and because a typed template cannot be rendered
with a missing variable. The substance (outside services, versioned, reviewable, traceable) holds.

---

## 6. Email + password + Google → phone + OTP + PIN

**PRD §59** specifies login, register, forgot password, email verification, and Google login.
**BDS §10.2.11** forbids requiring an email (*"a large share of target users do not have or
remember one — phone number is the identity"*), forbids strong-password rules, and specifies phone
+ OTP with a 4–6 digit PIN. **BDS §1.2 red line 11** bans CAPTCHA.

**Resolved as:** phone + OTP + PIN is the primary path (Design System wins on the interaction), and
`users.email` is retained as an **optional** column so the PRD's account model still works.
Google OAuth is not implemented — see [EXTERNAL.md](EXTERNAL.md).

Because a 4-digit PIN has only 10,000 combinations, brute force is contained by progressive delay
plus a **temporary, self-clearing 10-minute lock** — never a permanent lockout, which BDS §10.2.5
identifies as where low-confidence citizens abandon for good. The locked-out screen offers the OTP
route rather than a dead end.

---

## 7. Redis rate limiting → in-database token bucket

**PRD §48** specifies Redis. Implemented as a token bucket in `rate_limit_buckets` with the same
interface. A token bucket rather than a fixed window because a fixed window permits a full-quota
burst at each boundary — twice the intended rate. Separate quotas per scope: `auth` 10/min (the
brute-force surface), `ai` 20/min (the expensive one), `default` 120/min.

---

## 8. BullMQ workers → idempotent jobs, run on demand or by a scheduler

**PRD §45 / §119** specify BullMQ background workers.

Implemented as five idempotent functions, each recording a `job_runs` row, invocable from the admin
UI or over HTTP by any scheduler: `reindex_search`, `rebuild_embeddings`, `detect_staleness`,
`scheduled_notifications`, `aggregate_analytics`.

`rebuild_embeddings` **honestly no-ops** when no embedding provider is configured, recording
`{skipped: true, reason: "No embedding provider configured (set OPENAI_API_KEY)"}` rather than
reporting a fake success.

Two jobs also run inline where staleness would be visible to a citizen: opening the timeline
reconciles deadlines and creates due reminders, so the screen is never stale between job runs.

---

## 9. The rule editor is read-only in the UI

**PRD §Feature 20** lists "Update Rules"; **§77** lists "Rule Management".

`POST /api/v1/admin/rules` is fully implemented: it validates the grammar, refuses malformed
operators, publishes a new **version** rather than editing in place, deactivates the previous one,
and **smoke-tests** the rule against three synthetic profiles — empty, broadly-eligible, and
deliberately mismatched — returning warnings for the two failure modes that make a rule useless in
practice: one nobody can satisfy, and one everybody satisfies.

The **UI** for authoring is read-only: it shows each active rule, the fields it reads, and flags
fields that are tested but not declared required (so the system would never ask about them). A
free-text JSON editor was deliberately not shipped, because it would let an author save a rule that
parses but can never match anyone — which is what the smoke test exists to catch. A guided
condition builder is the right next step.

---

## 10. Design system erratum: `green.300` on `green.800` is 5.29:1, not 8.63:1

**BDS §3.3** states that `green.300` (`#74CCAD`) on `green.800` (`#084B39`) is **8.63:1** and calls
it *"the mandatory text/icon colour"* for the hero surface.

**The computed value is 5.29:1.** Verified independently:

| Foreground on `green.800` | Ratio | Verdict |
|---|---|---|
| `green.300` `#74CCAD` | **5.29:1** | AA only |
| `green.200` `#A8E1CB` | 6.89:1 | AA only |
| `green.100` `#D3F0E4` | **8.36:1** | AAA |
| `white` | 10.12:1 | AAA |

5.29:1 passes AA for normal text and clears the 3:1 threshold for icons, but **not** the
*"AAA contrast on all body text"* house rule the same document sets in its own header.

**Resolution — the pairing is split rather than the token changed:**
- `green.300` stays as `--bds-text-on-brand-deep` for small labels and icons on `surface.brand`.
- **Body copy on `surface.brand` uses `green.100`** (8.36:1), so the AAA rule holds.

Both bounds are asserted in `tests/tokens/contrast.test.ts`, including that `green.300` is
`< 7:1`, so a future author cannot promote it to body text believing the document's figure.

**This needs your decision** — see [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) Q1.

---

## 11. Argon2id → scrypt fallback

**PRD §48 / §121** specify Argon2. `@node-rs/argon2` is declared an **optional** dependency: when
present it is used; when absent (common on Windows without prebuilt binaries) the code falls back to
scrypt from Node core at N=2^15 (~32 MB per hash).

Both paths produce a self-describing string recording which algorithm made it, so verification
routes itself correctly and an installation can gain Argon2 later **without invalidating existing
credentials**. A credential made with Argon2 on a host that later loses the module **fails closed**
with an explanatory error rather than silently accepting.

---

## 12. Interactive map → OpenStreetMap, no key, list still primary

**PRD §70** describes an interactive Mapbox/Google map. This now exists, on **OpenStreetMap**
rather than a commercial provider, and needs no account or key — the map works on a fresh clone.
`NEXT_PUBLIC_MAP_PROVIDER` defaults to `osm`; `none` restores the previous key-less list.

**The list remains the primary surface.** Every place on the map is in the list below it with its
address, phone number and directions link, and nothing is reachable only by pin. A citizen who
cannot see, cannot drag, or has images blocked loses the picture and nothing else.

**No map library.** Leaflet plus its stylesheet is ~45 KB gzipped before a tile loads, on a screen
whose whole point is a cheap Android phone on 2G (BDS §4.7). `lib/geo/mercator.ts` +
`components/nearby/MapView.tsx` is about 400 lines, adds no dependency, and — the deciding factor —
was easier to make keyboard-operable than a third-party canvas is to retrofit. Arrow keys pan, `+`/`−`
zoom, `Home` re-frames, every pin is a real focusable `<button>` whose accessible name carries the
type and distance, and each marker has a letter glyph as well as a tint (BDS §2.2 rule 4).

**Tiles are proxied** through `/api/v1/map/tile/{z}/{x}/{y}` rather than fetched by the browser.
Four reasons, none interchangeable: OSM's Tile Usage Policy requires an identifying `User-Agent`
that an `<img>` cannot send; the CSP stays at `img-src 'self'`; the tile host never receives the IP
of someone looking up a legal-aid office or a hospital; and the provider becomes swappable via
`MAP_TILE_URL` without touching the client.

**Distances are now measured from the citizen's actual position** when they share it. The screen
previously took a GPS fix, snapped it to the nearest district town and discarded the coordinates —
so someone standing outside a hospital was told it was 11 km away, that being the distance from
their district's centroid. The fix is kept, travels in the URL so a reload does not silently revert,
and the note under the list names its reference point: "measured from where you are" versus "from
the centre of the district town". Straight-line, and it says so.

---

## 12a. Real places from OpenStreetMap, kept separate from the sample corpus

Nearby Services now shows **two kinds of record and never blurs them**:

| | Seeded corpus | OpenStreetMap |
|---|---|---|
| Coverage | All 64 districts, 5 per district | Thorough in cities, thin in rural upazilas |
| Addresses | Structurally honest, **invented** | Real |
| Phone numbers | None invented; real helplines only | Real where a contributor added one |
| Administrative tier | Union / upazila / district | Not recorded — see below |
| Badge | "Sample record" | "OpenStreetMap — real location" |
| `verificationStatus` | The enum | **`null`** |

`verificationStatus` is deliberately null for OSM rows rather than `unverified_sample`. That value
means "authored sample data we invented"; applying it to a genuine hospital would be a false
statement in the other direction. The two are labelled distinctly because merging them would let
invented addresses borrow the credibility of real ones.

Real types retrieved: **police stations, hospitals, clinics, courts, pharmacies, banks, post
offices, fire stations, colleges, NGO offices and government offices.**

Three tag mappings were refused, and the refusals matter more than the mappings:

- **`office=lawyer` is not `legal_aid`.** It is a private practice that charges fees. Mapping it
  would send someone who cannot afford a lawyer to a lawyer. Legal aid stays with the seeded records
  and the real `16430` helpline.
- **`office=government` does not get an administrative tier.** Union, upazila and district offices
  are different things and the tier decides which forms can be filed where. OSM does not record it,
  so those rows use an untiered `government_office` type instead of a guess that would put a citizen
  in the wrong queue.
- **`agriculture_office` and `digital_center` have no OSM equivalent** and are left unmapped. Those
  filters show seeded records only, which is honest.

Two display decisions came out of live data rather than theory. Central Dhaka returns **5,240 real
places within 25 km, 36 of them banks against 6 hospitals** — ordered by distance alone the banks
bury the hospitals, so each category is capped at 6 while no type filter is applied, and the cap
lifts when the citizen picks a type. And the count says what is *shown* against what *exists*
("the nearest 55 are shown"), because a silently trimmed list reads as a complete one.

Overpass results are cached in `osm_place_cache`, keyed by a ~5.5 km grid cell so two citizens in
one town share a lookup. A cold query takes ~20 s; a cached one ~0.5 s. `npm run osm:clear` empties
it, which is needed after changing normalisation because the cache stores post-normalisation shapes.

**Overpass and OSM tiles are volunteer-run and rate-limited.** Point `OVERPASS_URL` and
`MAP_TILE_URL` at your own instance or a paid provider before real traffic, and set
`MAP_USER_AGENT` to something contactable — see [EXTERNAL.md](EXTERNAL.md). A failure on either is
never fatal: the seeded list is the primary surface, and the screen says the real places are
missing rather than showing an error.

---

## 13. Voice OTP is offered but disabled

**BDS §10.2.5** requires a voice-OTP fallback as the accessible-authentication path. The button is
present, **disabled with a visible reason** ("this needs a telephony service"), rather than absent
or silently non-functional. Requires a voice provider — see [EXTERNAL.md](EXTERNAL.md).

---

## 13a. Transcription accepts one class of unauthenticated request

`POST /api/v1/voice/transcribe` normally requires a session. It also accepts a clip **with no
session** when the form carries a `phone` that has a **live, unconsumed OTP challenge**
(`hasLiveOtpChallenge` in `auth.service.ts`).

This exists because of a circularity. Speaking the six-digit code is the accessible-authentication
route **BDS §10.2.5** requires, and server transcription is the only speech path that works in
Firefox or under `VOICE_MODE=server` — so requiring a session made the microphone dead on the one
screen where nobody has one. A citizen who cannot read six boxes then could not sign in at all.

Why this boundary is defensible:

- Walking through the door costs a real Bangladeshi mobile number, a successful SMS send, and the
  per-number resend cooldown — all already rate-limited. An open endpoint costs nothing and bills
  per minute of audio.
- The clip is still capped at 2 MB, still IP-rate-limited on the `voice` bucket (anonymous callers
  key by IP, so rotating phone numbers buys no extra budget), and still never stored.
- It grants nothing. `verifyOtp` remains the only thing that can turn a code into a session. This
  path does not consume an attempt and does not reveal whether the code was right.
- Purpose and attempt count are deliberately *not* part of the predicate — the caller is a
  microphone button, and a citizen who has already mistyped the code three times is precisely the
  one who needs to speak it.

**If the OTP flow gains a client-held challenge token, switch to it** — that would remove the need to
send a phone number with the audio at all.

---

## 13b. Voice does not touch the PIN

Dictation is wired into the phone-number and OTP fields (`DictateDigits`) and deliberately **not**
into the PIN or PIN-confirmation fields. A PIN is a reusable secret; a code is single-use and expires
in minutes. This audience uses phones in shared rooms, markets, and government office queues, so
inviting someone to say their PIN aloud would hand it to whoever is standing there — and unlike a
misheard digit, that is a harm the app cannot undo.

Spoken digits also never auto-submit, unlike typing the sixth digit into `OtpInput`. A challenge
allows only a few attempts, and spending one on a mishearing the citizen never saw is how voice locks
someone out of their own account.

---

## 14. "Similar User Success" ranking factor returns neutral

**PRD §31** allocates 10% of the ranking score to "Similar User Success". That requires historical
outcome data this prototype has not accumulated. The component returns a **neutral 50** and reports
`similarUserDataAvailable: false` rather than inventing a success rate — fabricating one would be
exactly the unsupported claim §33 forbids. The other five factors carry their specified weights.

---

## 15. Smaller notes

- **Bangla month names and grouping are hand-written**, not from `Intl`. `Intl.DateTimeFormat('bn-BD')`
  and `NumberFormat('bn-BD')` emit Bengali digits in most runtimes, which would defeat the
  Latin-digit default (BDS §4.3) and make the numeral toggle unable to control its own output.
- **Service locations are generated** from the district table (5 per district × 64 + 7 named
  national institutions = 327). Bangladesh genuinely has one Social Services office, one Sadar
  hospital, one legal aid office, one agriculture office and one youth office per district, so this
  gives correct national coverage. Street addresses are structurally honest ("Sadar, <District>")
  and **no phone numbers are invented** — only real national helplines appear.
- **Bangla stemming is deliberately shallow.** A short suffix list, not a full stemmer. Aggressive
  stemming on conjuncts produces false matches, and a citizen acting on the wrong programme wastes
  a trip to a government office.
- **`next` has an open advisory with no patched release** in any channel (its suggested "fix" is
  v9.3.3). Pinned to the newest 15.x (15.5.22). `drizzle-orm`, `next-intl`, and their transitive
  `postcss` were upgraded to patched majors.
- **Uploads** (PRD §Feature 8 / §63) are not implemented. The word "upload" is banned by BDS §12.3
  in favour of a camera capture flow; the schema, `documents` table, and admin indexing path exist,
  but no capture UI or object-storage writer was built.
- **Streaming chat responses** (PRD §92 Sprint 2) are not implemented; responses arrive whole. The
  waiting state escalates at 8 s to the reassurance line BDS §10.1.5 requires.

## 16. Shebar Janala Phases 0–2: identity, residency, and issue reporting

Not a deviation from AccessAI's own PRD — none of this is in it. A separate, older civic-transparency
specification ("Shebar Janala," a Union Parishad issue-reporting and budget-transparency platform)
was audited against this codebase and found to share no code with it. This section is Phase 0 of
that audit's own roadmap ("stop any external claim that AccessAI already carries forward Shebar
Janala's capabilities") and the honest record of Phases 1–2, built the same way everything else in
this file is: real where it says real, simulated where it says simulated.

**Phase 0 — the record.** Nothing in this codebase, before this change, implemented NID/KYC
verification, a blockchain or hash-chain ledger, corruption-flagging, or citizen issue-reporting.
Anything describing AccessAI as having those capabilities was describing a different product. This
paragraph is that correction, kept in-repo rather than only in an external audit document.

**Phase 1 — verified identity & place.**
- **NID verification is simulated**, the same pattern as `SMS_PROVIDER`: `NID_PROVIDER` unset means a
  National ID number is format-checked (10, 13, or 17 digits) and hashed
  (`modules/identity/nid.service.ts`), and the result is labelled `simulated_verified` — never
  `verified`. Naming a provider without an implementation throws rather than pretending to check one.
- **Union/ward geofencing is a real point-in-polygon test** (`modules/identity/geofence.ts`) against
  an authored sample corpus of four union boundaries (`lib/db/seed/unions.ts`) — hand-drawn ~1 km
  squares around real district towns, not surveyed geometry. `unionBoundaries.verificationStatus`
  reuses the knowledge base's `unverified_sample` vocabulary for exactly the reason it exists there:
  an invented boundary must not look like a surveyed one. A citizen whose GPS fix lands outside every
  seeded union (i.e. almost everyone, at this corpus size) falls back to picking their union from a
  list, recorded as `manual_attestation` rather than `gps_geofence` — a real, disclosed difference in
  evidence strength, not two paths presented as equivalent.
- No PostGIS. The point-in-polygon test is a plain ray-cast over a handful of authored polygons —
  appropriate at this scale, not at national scale. A real corpus of thousands of union boundaries
  would need a spatial index, the same way `modules/places/overpass.ts` needed a grid cache once real
  OSM volume existed.

**Phase 2 — citizen voice ("Amar Union, Amar Sheba").**
- **Issue photos have no object-storage writer**, the same gap PRD Feature 8 already left open in
  AccessAI's own scope (§15 above). Rather than block reporting on it, `modules/issues/photo-storage.ts`
  writes to `public/uploads/issues/<uuid>.<ext>` and serves it statically — zero-config, matching the
  single-file-database ethos, but with two real costs a production deployment must not inherit
  unexamined: an uploaded photo is reachable by anyone with its (unguessable) URL, and nothing here
  virus-scans it. An S3/R2-backed writer behind the same interface is the natural next step.
- **Keyword moderation is a short, illustrative list** (`modules/issues/moderation.ts`), not a
  maintained lexicon — it flags a report for closer human review, and never auto-rejects one. Every
  report reaches a moderator regardless; the flag is a priority signal, not a verdict.
- **The issue state machine is enforced, not just documented**
  (`modules/issues/state-machine.ts`): `transitionIssueStatus` refuses any move the map does not
  list. Approving `under_review → verified/rejected` happens in `/admin/moderation`, alongside every
  other content decision; every other transition (`verified → in_progress → completed`, and
  `→ archived` from any resolved state) is a staff-only action on the issue's own page, matching the
  source spec's "officials update issue status with evidence."
- **Escalation to an Upazila/Zila officer is not built.** Those roles do not exist in `USER_ROLES` —
  extending the role hierarchy is Phase 3 of the same roadmap, and flag-ratio thresholds and a budget
  ledger are Phase 3 work this phase deliberately does not anticipate.
- **Viewing and voting are scoped to the citizen's own verified union**, never a union id supplied by
  the request — resolved from `userProfiles.residencyUnionId`, set only by Phase 1. A citizen with no
  verified residency sees a plain "verify your union first" state, not an empty feed that looks like
  a bug.
- **PWA / push notifications** are not implemented. Notifications are persisted and shown in-app.
