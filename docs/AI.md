# AI in Trainova

**Principle:** the app computes every number; the model only explains it.
The rules in `src/domain` produce the measurements, assessments and targets.
A model may cite only the facts it was handed. A validator checks every
reply, and a rule-based reading is always ready when the model fails or
gets rejected.

## Features

| Task (`src/services/ai/tasks.ts`) | Route | Tier | Context source | Fallback |
|---|---|---|---|---|
| `analyst`: training analysis | `POST /api/ai/analyst` | deep | synced document → `buildAnalystEvidence` | `ruleInterpretation` |
| `exercise_coach`: in-workout sheet | `POST /api/ai/exercise-coach` | fast | synced document → `buildExerciseContext` + `assessSets` | `ruleReading` |
| `trainer.chat`: plan chat with actions | `POST /api/ai/trainer` | deep | client context, parsed and size-capped | error message, no actions |
| `trainer.review`: weekly status | `POST /api/ai/review` | deep | client context, parsed and size-capped | the deterministic status card |
| `coach.intro`: one line above Signals | `POST /api/ai/coach` `intro` | fast | client situations (no numbers) | no intro |
| `coach.meals`: meal ideas | `POST /api/ai/coach` `meals` | fast | targets recomputed on the server (`mealIdeasInputFor`) | static ideas |

Every route goes through the same gate (`src/server/aiGuard.ts`):

1. **AI configured:** `MISTRAL_API_KEY` is set (`aiConfigured`).
2. **Signed in.**
3. **Consent:** the user has allowed AI data sharing (`users.ai_consent_at`).
   The disclosure in Coach and Profile lists what is sent.
4. **Rate limits:** 20 requests a minute, plus a daily budget
   (`AI_DAILY_LIMIT`, default 200), shared across instances through Redis.

## Models and routing

- **Two tiers:** each task has one. "deep" starts on the largest model the
  key allows; "fast" starts on a small one.
- **Fallback:** `chatComplete` walks down (or up) the list in `TIER_MODELS`
  when a model is denied or rate-limited.
- **Pinning:** `MISTRAL_MODEL` pins every tier;
  `MISTRAL_MODEL_DEEP` / `MISTRAL_MODEL_FAST` pin one.
- **JSON only:** all tasks ask for JSON mode, and `parseJsonObject` rejects
  anything else.
- **Prompt version:** `task@hash` of the system prompt. Editing a prompt
  creates a new version automatically; you'll see it on `/admin/ai`.

## Guardrails

- **Numeric grounding** (analyst, exercise coach): `unsupportedNumbers`
  rejects any number in the reply that isn't a fact, or a whole-number
  rounding or absolute value of one. One stray number rejects the whole
  reply.
- **Fact references:** each point must cite known `factIds`.
- **Safety** (`src/services/ai/safety.ts`): rejects harmful advice, such as
  training through pain, drugs, or crash diets below safe calories. Replies
  containing personal information are rejected. Emails and phone numbers are
  redacted from user text before it's sent.
- **Red flags:** chest pain, sharp joint pain and similar symptoms in the
  user's words, or in recent feedback, skip or override the model. The user
  sees "stop and get it checked", and any plan actions are dropped.
- **Plan actions** (trainer chat): validated against the actual plan.
  Unknown workouts or exercises are dropped. Applied changes are recorded in
  `planChanges` with undo.
- **Machine settings:** the exercise coach may not invent seat or pin
  positions. A setting number that isn't in the evidence fails the
  numeric check.
- **Nutrition:** no targets for minors, during pregnancy or breastfeeding,
  or with a diet-related medical condition or a disordered-eating history.
  The calorie, protein, fat and carb floors always win over the goal
  (`src/domain/nutrition.ts`). Gated and opted-out users never reach the
  model.

## Evaluation

`pnpm eval` runs `src/services/ai/evals/dataset.v1.json`. These are canned
model replies passed through the real services and validators, with no
network.

- **Expectations:** each case states whether the reply must be accepted,
  which fallback must show, the `ai_runs` outcome, and text that must not
  appear.
- **CI:** runs on every push.
- **Changing the dataset:** add cases freely. A behaviour change that breaks
  existing cases means a new dataset version (`dataset.v2.json`), not edits
  to v1.

Add a case whenever a real model reply slips past a validator.

## Observability

`meteredAi` (`src/server/aiRuns.ts`) records one `ai_runs` row per model call:

- **Recorded:** task, model, prompt version, input schema version, tokens,
  latency, validation issues, error code, and whether the fallback was shown.
- **Never recorded:** prompts, replies or user text.
- **Not logged at all:** requests answered without a model (cache, red flag,
  AI off).
- **Failure isolation:** a logging failure never fails the request.

`/admin/ai` summarises 1, 7 or 30 days per task, model, error code and prompt
version.

## Known gaps

- **Client-built context:** trainer chat and review still receive a context
  built by the client. It is parsed, bounded and validated, but not rebuilt
  from the synced document as the analyst and exercise coach are.
- **Readiness and AI:** the recovery readiness estimate isn't sent to any
  AI task yet.
- **Caches:** the analyst cache is in-process. Move it to Redis before
  running more than one app instance.
