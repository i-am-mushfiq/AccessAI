# External services and environment variables

Every external dependency: why it is needed, whether it is mandatory, what credentials it takes, and
what happens without it. **Nothing in this list is required to run the system end to end.**

The rule applied throughout: an unconfigured service **degrades to a stated fallback or fails
loudly**. Nothing pretends to have worked.

---

## Summary

| Service | Mandatory? | Without it |
|---|---|---|
| Database (libSQL / SQLite) | **Yes** — but defaults to a local file, no setup | — |
| AI provider (Anthropic **or** OpenAI) | No | Deterministic composer; UI badges **"Simulated AI"** |
| Embeddings (OpenAI) | No | BM25 only; `rebuild_embeddings` reports `skipped` |
| SMS gateway | No | OTP shown via `OTP_DEV_ECHO`; with echo off, requesting a code **fails loudly** |
| SMTP | No | Notifications persist and show in-app |
| Map tiles (Mapbox / Google) | No | Distance-ordered list + an explicit "no map" banner |
| Object storage (S3 / R2) | No | Unused — document capture is not built |
| Voice OTP telephony | No | Button visible, **disabled with a stated reason** |
| OCR | No | Not built |

---

## 1. Database — the only hard requirement

**Why:** everything persists. **Mandatory:** yes, but it needs no installation.

```bash
DATABASE_URL="file:./data/accessai.db"   # default; a local SQLite file
DATABASE_AUTH_TOKEN=""                    # only for hosted libSQL (Turso)
```

`npm run setup` creates the schema and seeds it. Point `DATABASE_URL` at a Turso URL plus
`DATABASE_AUTH_TOKEN` for a hosted database with no other change. The PRD's PostgreSQL target is a
`client.ts` swap — [DEVIATIONS.md](DEVIATIONS.md) §1.

---

## 2. AI provider — the honest-degradation case

**Purpose.** Exactly one job: **rendering a `ResponsePlan` into fluent prose** in the citizen's
language. It does *not* decide eligibility (PRD §24 forbids that), does not choose programmes, does
not compute confidence, and does not author reasons. Those are all deterministic and happen before
any model is called.

**Providers.** One `LlmProvider` interface, four implementations:

| Provider | Env | Model default | Used for |
|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-5` (`ANTHROPIC_MODEL`) | Response rendering |
| OpenAI | `OPENAI_API_KEY` | `gpt-4.1-mini` (`OPENAI_MODEL`) | Response rendering **and** embeddings |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` (`DEEPSEEK_MODEL`) | Response rendering. OpenAI-compatible; no embeddings endpoint |
| Simulated | *(none set)* | — | The deterministic composer |

With several keys present the order is anthropic → openai → deepseek. Set **`AI_PROVIDER`** to choose
explicitly rather than depending on that order; if it names a provider whose key is missing,
`aiConfigProblems()` reports it instead of quietly falling back to a provider nobody chose.

**Verify any of them with `npm run ai:check`**, which resolves the provider, lists the model ids the
account actually exposes, reports the thinking setting, and performs one real round trip. Guessing a
vendor's current model string is how you get a 404 at request time — this asks the API instead.

### DeepSeek: reasoning is off, by two measures

DeepSeek V4 **thinks by default.** Verified against the live endpoint: `thinking.type` accepts
`adaptive | enabled | disabled` and defaults to `adaptive`, which produced 52–79 reasoning tokens per
call — roughly 4× the output tokens for an identical answer. `reasoning_effort` accepts
`low | medium | high | xhigh | max` and **has no `none`**; sending one is a 400. So turning thinking
off is `thinking: { type: 'disabled' }`, nothing else.

The adapter therefore does two independent things:

1. Sends `thinking: { type: env.DEEPSEEK_THINKING }`, defaulting to **`disabled`**, on every request.
2. **Discards any `reasoning_content` that arrives anyway** — it never reaches the response, the
   `ai_logs` row, or the citizen, and its arrival is logged once as a cost warning.

The second measure is not redundant. A chain of thought contains discarded hypotheses phrased as
statements; putting one beside a benefits decision would present rejected reasoning as advice, and
storing it would pollute an audit trail that has to be defensible. And this product has nothing for a
model to reason about anyway: eligibility, ranking, and citations are all decided deterministically
*before* the model is called — it only rewrites a fixed `ResponsePlan` into fluent prose.

`DEEPSEEK_MODEL` defaults to the **`-flash`** id for the same reason: `-pro` buys reasoning depth this
workload never uses. Switch to `-pro` only if Bangla prose quality matters more than latency and cost.

Measured on a live Bangla turn (widowhood → 5 programmes, 6 citations): **5.5 s** server-side for a
~700-token reply, against the PRD §5 target of 3 s. That is generation time, not pipeline time — the
deterministic path answers in well under a second. Bringing it down means streaming the response
(not implemented — [DEVIATIONS.md](DEVIATIONS.md) §15) or capping `maxTokens` harder.

**Is a mock possible? Yes — and it is the default, because of how the pipeline is ordered.** The
`ResponsePlan` fixes every fact before rendering, so the composer produces the *same* programmes,
outcome, reasons, citations, and next step as a live model. Only prose fluency differs. This is
stated in the UI on every screen, in `meta.ai` on every chat response, and in `ai_logs.engine` for
every stored turn.

```
GET /api/v1/auth/session → { "ai": { "mode": "simulated", "isLive": false,
                                     "model": "deterministic-composer-v1" } }
```

The badge in the UI reads **"Simulated AI (no API key)"** whenever `isLive` is false.

**Degradation is also runtime, not just startup.** If a configured provider errors or exceeds the
45-second abort, the turn falls back to the composer, marks the response `degraded: true`, and tells
the citizen the answer came from the offline engine. A model outage never produces a blank screen or
a lost message.

**Costs and rate limits** are why the `ai` scope is 20/min against the default 120 (PRD §128).

---

## 3. Embeddings — the semantic half of hybrid retrieval

**Why:** PRD §26 requires hybrid retrieval. BM25 matches words; embeddings match meaning, which
matters when a citizen writes *"স্বামী মারা গেছে"* and the programme text says *"বিধবা"*.

**Provider:** OpenAI `text-embedding-3-small` (`OPENAI_EMBEDDING_MODEL`). Requires `OPENAI_API_KEY`.

**Without it:** the semantic channel contributes **nothing** — it is not simulated with a random or
hash-based vector, which would produce confident nonsense. The retriever reports its mode
(`lexical only (BM25)`) in the admin panel, and `rebuild_embeddings` returns:

```json
{ "skipped": true, "reason": "No embedding provider configured (set OPENAI_API_KEY)" }
```

**To enable:** set `OPENAI_API_KEY`, then run `rebuild_embeddings` from **Admin → Jobs**. Vectors are
stored in a JSON column and cosine is computed in process — correct at this corpus size, and
interface-identical to a pgvector swap.

---

## 4. SMS gateway — OTP delivery

**Why:** phone + OTP is the identity model (BDS §10.2.11 — a large share of target users have no
email). **Mandatory:** not for development.

```bash
OTP_DEV_ECHO="true"              # development: the code is logged AND shown, labelled
SMS_PROVIDER="ssl_wireless"      # ssl_wireless | bulksmsbd | twilio
SMS_API_KEY=""
SMS_SENDER_ID=""
```

**Current behaviour, precisely:** with `OTP_DEV_ECHO=true` the code is printed to the server log and
returned as `devCode`, which the UI renders behind an explicit *development only* label so the auth
flow is completable. With echo **off** and no provider, `requestOtp` **throws** — *"SMS delivery is
not configured on this server, so a code cannot be sent."* A citizen waiting for a code that was
never sent is worse than a clear failure. Setting `SMS_PROVIDER` without an implementation also
throws, naming the provider.

`assertProductionSafety()` refuses a production boot with `OTP_DEV_ECHO` still on.

**To implement**, add one function to `sendSms` in
[src/modules/auth/auth.service.ts](../src/modules/auth/auth.service.ts). The three shapes:

| Provider | Endpoint | Credentials |
|---|---|---|
| **SSL Wireless** (most common for BD government/NGO) | `POST https://smsplus.sslwireless.com/api/v3/send-sms` — JSON `{api_token, sid, msisdn, sms, csms_id}` | API token + SID, allow-listed server IP |
| **BulkSMSBD** | `GET/POST http://bulksmsbd.net/api/smsapi` — `api_key`, `senderid`, `number`, `message` | API key + approved sender ID |
| **Twilio** | `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` — basic auth, form-encoded `To`/`From`/`Body` | Account SID + auth token. Works internationally; costs more per BD message and needs a sender that BD operators accept |

A `+880` sender ID needs BTRC-registered masking; without it, messages arrive from a shortcode and
some operators filter them. That is an operational prerequisite, not a code one.

---

## 5. Voice OTP — the accessible-authentication path

**Why:** BDS §10.2.5 requires a voice fallback for citizens who cannot read the SMS. **Not built.**

The button exists and is **disabled with a visible reason** ("this needs a telephony service") rather
than absent or silently inert — an accessibility affordance that appears to work and does not is
worse than one that explains itself.

**Needs** a voice provider with Bangla TTS or a pre-recorded digit set and a callback endpoint: Twilio
Programmable Voice, or a local operator's IVR. Credentials as for SMS, plus a public callback URL.

---

## 6. SMTP — email notifications

**Why:** PRD §Feature 13 lists email among the notification channels. Secondary here, since email is
explicitly *not* the identity.

```bash
SMTP_HOST=""      SMTP_PORT="587"    SMTP_USER=""
SMTP_PASSWORD=""  SMTP_FROM="AccessAI <no-reply@accessai.local>"
```

**Without it:** notifications are created, persisted, badged, and shown in-app — the citizen still
learns about a closing deadline the next time they open the app. The settings screen **disables the
email toggle and says why** (`emailAvailable={Boolean(env.SMTP_HOST)}`) rather than offering a switch
that does nothing. Same for the SMS toggle.

---

## 7. Map tiles — Nearby Services

**Why:** PRD §70 describes an interactive map.

```bash
NEXT_PUBLIC_MAP_PROVIDER="none"   # none | mapbox | google
NEXT_PUBLIC_MAPBOX_TOKEN=""
GOOGLE_MAPS_API_KEY=""
```

**Without it:** a **distance-ordered list** with call and directions actions, plus an info banner
stating that no map is configured. Distances come from district-headquarters coordinates or, with
permission, device geolocation — and are **labelled approximate** where the reference is a centroid,
because presenting a centroid distance as precise would send someone walking the wrong way.

Geolocation denial is handled as a normal state, not an error: the list stays usable and the district
selector remains the primary control.

Mapbox is the cheaper option at this scale and its raster tiles behave better on 2G; Google Maps has
better Bangladesh POI coverage. Either is a drop-in; neither is required.

---

## 8. Object storage — not yet used

```bash
S3_BUCKET=""  S3_REGION=""  S3_ACCESS_KEY=""  S3_SECRET_KEY=""  S3_ENDPOINT=""
```

Document capture is **not implemented** ([DEVIATIONS.md](DEVIATIONS.md) §15) — the `documents` table
and the admin indexing path exist, but nothing writes citizen files, so setting these has no effect
today. Validated and ready for the writer. Set `S3_ENDPOINT` for Cloudflare R2, which has no egress
charge and is the better fit for a Bangladesh-served deployment.

---

## 9. OCR — not built

PRD §Feature 8 implies reading a National ID or a certificate photo. Not implemented. It would need
Google Cloud Vision or Azure Document Intelligence for Bangla print, or Tesseract with `ben`
traineddata for a self-hosted option (noticeably weaker on Bangla conjuncts and on the low-light
phone photos this audience actually takes).

**Deliberate position:** OCR that misreads a National ID number is worse than typing it, so this
should not ship without a confirm-what-we-read step. That is a design decision, not just missing code.

---

## 10. Full environment variable reference

Validated by Zod at boot in [src/lib/config/env.ts](../src/lib/config/env.ts); an invalid value
**stops the process with a per-variable message** rather than failing mysteriously later.

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Enables production safety checks |
| `DATABASE_URL` | `file:./data/accessai.db` | libSQL / SQLite target |
| `DATABASE_AUTH_TOKEN` | — | Hosted libSQL only |
| `JWT_SECRET` | dev value | Access-token signing. **Must be replaced** |
| `JWT_REFRESH_SECRET` | dev value | Refresh-token signing. **Must be replaced** |
| `ACCESS_TOKEN_TTL` | `15m` | Short by design |
| `REFRESH_TOKEN_TTL` | `30d` | Rotated on use |
| `AI_PROVIDER` | — | `anthropic \| openai \| deepseek \| simulated`. Overrides key-order resolution |
| `ANTHROPIC_API_KEY` | — | Live AI. First in key order |
| `OPENAI_API_KEY` | — | Live AI **and** embeddings |
| `DEEPSEEK_API_KEY` | — | Live AI. No embeddings endpoint |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | |
| `OPENAI_MODEL` | `gpt-4.1-mini` | |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Run `npm run ai:check` to list what your account exposes |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | For a proxy or regional endpoint |
| `DEEPSEEK_THINKING` | `disabled` | `disabled \| adaptive \| enabled`. The API's own default is `adaptive`, which does think |
| `DEEPSEEK_REASONING_EFFORT` | — | `low…max`. Sent only when thinking is not disabled |
| `DEEPSEEK_EXTRA_BODY` | — | JSON merged into the request body last, if the API changes |
| `OTP_DEV_ECHO` | `true` | Shows the OTP in the UI, labelled. **Blocked in production** |
| `SMS_PROVIDER` / `SMS_API_KEY` / `SMS_SENDER_ID` | — | Gateway credentials |
| `NEXT_PUBLIC_MAP_PROVIDER` | `none` | `none \| mapbox \| google` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` / `GOOGLE_MAPS_API_KEY` | — | Tile credentials |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | port `587` | Email |
| `S3_*` | — | Reserved; unused today |
| `NEXT_PUBLIC_APP_NAME` | `AccessAI` | |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Bucket window |
| `RATE_LIMIT_MAX_REQUESTS` | `120` | Default scope |
| `RATE_LIMIT_AI_MAX_REQUESTS` | `20` | AI scope |

### Production refuses to boot unsafely

`assertProductionSafety()` returns problems that block a production start:

- `JWT_SECRET` or `JWT_REFRESH_SECRET` still the shipped `dev-only-…` value
- `JWT_SECRET` shorter than 32 characters
- `OTP_DEV_ECHO` still enabled — it reveals OTPs to the client

A weak signing secret is a total-compromise defect, so it is an error rather than a warning.

---

## 11. Optional native dependency

`@node-rs/argon2` is an **optional** dependency. Present → Argon2id. Absent (common on Windows
without prebuilt binaries) → scrypt at N=2^15. Both hashes are self-describing, so an installation
can gain Argon2 later without invalidating credentials, and a host that *loses* the module fails
closed rather than silently accepting a password it cannot verify.

The first build also fetches the Inter and Noto Sans Bengali font files through `next/font`, so it
needs network access **once**; after that the cache makes builds offline.
