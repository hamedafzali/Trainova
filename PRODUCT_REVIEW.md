# Trainova Product, UX, Architecture & AI Review

**Review scope (10 August 2026):** source code, data model, API routes, local mobile rendering, domain tests, deployment configuration, and the referenced AI fitness-coach workflow. This is an evidence-backed product review; it does not assume unimplemented wearable, payment, camera, or studio capabilities exist.

## Executive Summary

Trainova has a credible core: a fast local-first workout logger with a well-designed distinction between reusable plans, dated sessions, and immutable-ish history. Its deterministic progression logic, explicit session lifecycle, structured device model, offline guest path, and initial trainer workflow are stronger foundations than most early fitness apps.

The main risk is not feature scarcity; it is product focus. The app currently behaves as a capable training log with several disconnected AI generators. It does not yet form a trustworthy adaptive coaching loop: ingest reality, explain the recommendation, apply a safe change, measure outcome, and learn. Until that loop exists, more chat, vision, or nutrition features would raise cost and risk without creating durable differentiation.

**Recommended positioning:** *the AI operating system for coached strength training—gym-floor fast for members, scalable for independent coaches and boutique studios.* Start with individuals and coach-client teams; do not build broad studio operations until assignments, consent, billing, retention analytics, and data normalization are reliable.

## Strengths

- **Strong training-domain core.** Templates, programs, sessions, and historical sets are separated; a single active-session invariant prevents fragmented workout records.
- **Gym-floor intent.** Device metadata, keyboard-light steppers, rest timers, PR detection, haptics, PWA/offline behavior, and per-exercise focus mode are appropriate for live logging.
- **Explainable baseline intelligence.** The deterministic `suggestNextLoad` rules are testable and should remain the decision layer behind any AI explanation.
- **Pragmatic product access.** Guest mode removes activation friction while account sync offers a clear conversion moment.
- **Early coach wedge.** Trainer/client links, read-only progress, and plan assignments identify a viable B2B2C path.
- **Operational basics exist.** Container deployment, Postgres, Redis, password resets, rate limiting for login, backups, and Sentry scaffolding are useful starting points.

## Weaknesses

- **The promise is ahead of the shipped experience.** “AI-powered” is mainly one-shot generation; it does not automatically alter today’s plan from logged readiness, performance, or adherence.
- **Cloud data is a JSON snapshot, not a product data platform.** It makes trainer analytics, reliable conflicts, AI retrieval, cohort analytics, and event-driven work expensive and brittle.
- **AI routes are not consistently authenticated, rate-limited, schema-validated, metered, or safety-governed.** This is P0 before a public rollout with an API key.
- **Onboarding has high form friction and captures sensitive health/body data without visible consent, retention policy, or granular sharing controls.**
- **The mobile welcome screen overflows horizontally at 390px in local visual testing.** The app’s first screen is currently not reliably mobile-ready.
- **Product surfaces are too dense and desktop-card-like for a one-handed workout.** Several set controls and destructive actions compete inside the active session.
- **Studio functionality is not yet a studio product.** There is no class schedule, booking/waitlist, capacity, attendance, payments, multi-location tenancy, or staff operations model.

## UX/UI Review

### What works

- Calendar-first home gives users a clear “what do I do today?” answer.
- Plan/session/history semantics are materially clearer than typical simple loggers.
- Progress charts, device cards, and trainer assignment are useful secondary surfaces.

### Highest-impact issues

| Problem | Proposed solution | User benefit | Business impact | Complexity | Priority | AI integration |
|---|---|---|---|---|---|---|
| Welcome page horizontally overflows on a 390px viewport. | Add a mobile visual regression suite; remove/minimize fixed or intrinsic-width content; validate 320/375/390px layouts. | A trustworthy first impression and accessible sign-in. | Protects acquisition conversion. | Low | P0 | None. |
| Onboarding asks many inputs in a form before value is shown. | Use progressive conversational intake: goal → available time/equipment → constraints → a preview plan; collect optional measurements later. | Faster time-to-first-workout; lower disclosure burden. | Better activation and lower abandonment. | Medium | P0 | Intake agent asks only information that changes the plan. |
| Active workout still contains competing controls and prominent delete/discard options. | Make current set the hero; put destructive actions in an overflow sheet; auto-advance after complete; retain a persistent finish CTA only after the last exercise. | Fewer errors and less thumb travel while training. | Better completion and weekly adherence. | Medium | P0 | Show a small deterministic “today’s load” explanation, not chat. |
| Emoji navigation and dark translucent cards feel prototype-like and do not encode product states consistently. | Establish an accessible design system with semantic icons, state tokens, typography scale, empty/loading/error states, and 44–56px controls. | Faster scanning and broader accessibility. | Premium perception; lower support burden. | Medium | P1 | AI recommendations use a distinct “why this changed” card state. |
| Progress is exercise-centric only. | Add a weekly “Coach Brief”: adherence, volume by muscle, PRs, fatigue, next workout, and one actionable habit. | Makes outcomes understandable without chart literacy. | Creates weekly return loop. | Medium | P1 | Summarize computed metrics with citations to the user’s data. |

### Recommended primary flow

`Today → readiness/check-in (10 seconds) → recommended session → focus-mode logging → one-tap post-session feedback → plan update visible before next workout → weekly review.`

Do not make chat the starting point. The best AI interaction is an action card embedded where a decision is required: “Keep 52.5 kg today—last session hit target at RPE 8; sleep is normal.” Provide **Accept**, **Adjust**, and **Why**.

### Wireframe idea: Today

```text
Good morning, Sam                         Recovery: self-reported 3/5
Today: Full Body A · ~46 min
[ Start recommended workout ]

Why this plan changed
Last session: all target reps at RPE 7–8. Add 2.5 kg to leg press.
[ Accept ] [ Keep last load ] [ Why? ]

This week: 2 / 3 sessions · next check-in Sunday
```

## Product Review

### Target customer and product thesis

Prioritize **independent trainers and boutique strength studios with 20–300 members**. Their problem is not merely generating a workout: it is scaling individualized coaching, improving adherence, proving value, and keeping coaching quality consistent. Members receive a calm, fast logging experience; coaches receive exceptions and decisions—not raw charts.

Avoid promising clinical recovery, injury diagnosis, body-fat estimation, or “real-time form correction” until there is validated data, consent, clear limitations, and an appropriate regulatory/privacy review.

### Retention loops

1. **Daily:** a five-second readiness/adherence check changes the recommended session.
2. **During workout:** load suggestion + form cue + post-set RPE make logging meaningful.
3. **Weekly:** coach brief and plan adjustment creates an anticipation loop.
4. **Social/accountability:** coach acknowledgment, shared challenge, or training partner commitment—not an undifferentiated social feed.
5. **Studio:** at-risk member list triggers human outreach with approved, personalized suggestions.

### Monetization

- **Free:** offline logger, 1–2 templates, basic progress, limited AI plan preview.
- **Member Pro (€10–20/month):** adaptive programming, nutrition targets, full reports, integrations, check-ins, and coaching memory.
- **Coach (€49–149/month):** member seats, assignments, review inbox, branded plans, AI copilot, messaging, and exports.
- **Studio (€199–599+/month):** location/staff roles, booking/attendance integrations, member health dashboard, retention workflows, and usage-based AI credits.
- Meter expensive vision and food-photo processing as credits or a premium tier; never hide uncertain output behind a paywall as medical advice.

## Technical Architecture Review

### Current state

The React/Next.js client uses a persisted Zustand store and optimistic snapshot sync. Domain rules are well isolated and tested. The deployed backend uses custom Postgres auth and stores each user’s product state in `user_state.data` JSONB. A separate Supabase schema exists but is not the runtime path. AI services call Mistral directly from route handlers and parse model output with regex + `JSON.parse`.

### P0 architecture findings

| Problem | Proposed solution | User benefit | Business impact | Complexity | Priority | AI integration |
|---|---|---|---|---|---|---|
| AI endpoints accept requests without a shared server-side auth/authorization layer; some attempt to use client-only token helpers on the server. | Add an `requireUser(request)` server guard to every private route; verify bearer/cookie server-side; enforce role and tenant checks. | Data and account safety. | Prevents API-key abuse and privacy incidents. | Medium | P0 | Associate every AI run with user, coach, tenant, and consent scope. |
| AI input/output is weakly typed, parsed via broad JSON regex, and sometimes imports generated text lossy into templates. | Use JSON Schema/structured outputs, Zod validation, bounded retries, idempotency keys, and a canonical `ProgramRevision` mapper. | Reliable plans that retain cues, RPE, substitutions, rest, and provenance. | Fewer failures/support cases; safe AI scaling. | Medium | P0 | Tool calls return constrained program-change proposals, never arbitrary text as state. |
| Snapshot sync serializes the whole user product state into one JSONB column. | Keep local outbox, but normalize cloud writes by aggregate (`sessions`, `sets`, `plans`, `check-ins`, etc.); add version/event IDs and incremental sync. | Faster and safer multi-device use. | Enables analytics, coaches, and AI data products. | High | P0 | Produces trustworthy retrieval and feature tables. |
| Two competing backend directions exist (custom Postgres runtime and unused Supabase schema). | Choose one operating model within two weeks. Recommended: retain Postgres + a typed API now, or fully migrate to Supabase Auth/Postgres/RLS—do not maintain both. | Fewer auth and data surprises. | Lower maintenance and audit scope. | Medium | P0 | Unified identity and consent are prerequisites for AI. |
| Token is held in localStorage and JWT has a development fallback secret. | Move production auth to secure HttpOnly SameSite cookies with rotation; fail startup without `JWT_SECRET`; add CSRF protections where needed. | Safer account session. | Reduces breach impact and enterprise sales friction. | Medium | P0 | Protects sensitive health and AI context. |
| AI safety is keyword filtering rather than policy + deterministic constraints. | Add risk triage, medical escalation copy, eating-disorder handling, user-visible uncertainty, response policy tests, and human review audit logs. | Safer, more honest coaching. | Essential for trust, claims control, and partner sales. | High | P0 | Safety gateway is mandatory for every generation. |

### Scalability and performance

- Full-state read/write creates write amplification, more conflicts, slow account migration, and an all-or-nothing failure surface. Normalized commands plus a local outbox solve this before user growth.
- No background job model is visible for reports, vision, notifications, analytics rollups, retries, or AI queues. Add a worker and durable queue before async workloads.
- Redis exists but AI rate limits/caching/queue use should be explicit; cache only non-sensitive deterministic summaries and canonical library/RAG assets.
- Domain tests are good but coverage is narrow: route authorization, migrations, sync conflicts, AI schema validation, safety scenarios, and responsive E2E are missing.

## AI Opportunities

### Product rule

**Deterministic systems decide; AI explains, gathers context, and proposes bounded changes.** A model should not independently prescribe risky load changes, interpret pain as a diagnosis, or mutate the plan without an accepted, auditable command.

| AI feature | User experience | Required models | Suggested architecture | Complexity | MVP → advanced |
|---|---|---|---|---|---|
| Adaptive workout plan | Today card adjusts sets/load/exercise after check-in and gives one reason. | Rules engine + LLM explanation; optional ML later. | Rules calculate suggestion from sets/RPE/adherence; LLM turns structured rationale into copy; user accepts a `PlanChange`. | Medium | MVP: RPE/adherence/sleep self-report. Advanced: wearable readiness and learned response. |
| Personalized workout generation | User gets a reviewable week of sessions matched to library/equipment. | LLM + RAG + schema validator. | Retrieve vetted exercise/program rules; structured output references exercise IDs; validation/rules reject unsafe or unavailable movements. | Medium | MVP: 3–12 week program. Advanced: periodized revisions with coach approval. |
| Progressive overload | Next-set load is prefilled with “why.” | Rules engine; LLM optional. | Extend existing deterministic progression service using rep ranges, RIR/RPE, fatigue, and plate availability. | Low | MVP: per-lift suggestion. Advanced: volume/fatigue-aware mesocycle planner. |
| Recovery recommendations | User sees “train, reduced volume, or recovery day” with confidence/limits. | Rules + time-series ML; wearable API. | Readiness service combines self-report first, device data only by consent; no medical claims. | Medium | MVP: sleep/stress/soreness. Advanced: HRV/RHR and personal baselines. |
| Injury-aware substitutions | Pain report swaps an exercise with a reviewable rationale and escalation guidance. | Clinical policy RAG + LLM + rules. | Triage severity; block diagnosis; retrieve vetted substitutions by movement pattern; send red flags to emergency/professional guidance. | High | MVP: static substitution matrix with safety copy. Advanced: coach/physio workflow. |
| Nutrition coach | Daily targets, meal ideas, and weekly trend adjustments; numbers are editable. | Rules calculator + LLM + food database/RAG. | Deterministic energy/macros baseline; LLM composes meals/grocery list from preferences and local food data. | Medium | MVP: macro targets/meal plans. Advanced: adaptive targets from trends and integrations. |
| Food-photo logging | Photo returns editable candidate foods/portions and uncertainty; never silently logs. | Vision multimodal model + food database. | Upload to private object storage; vision proposes items; canonical food search resolves nutrition; user confirms. | High | MVP: photo-to-draft meal. Advanced: personalized portion learning/receipt support. |
| AI coach & habit coaching | Brief, contextual prompts in Today/Weekly screens—not open-ended chat by default. | LLM + memory + RAG. | Topic router fetches scoped user facts, policy, and knowledge; response links to app actions and logs an outcome. | Medium | MVP: daily/weekly cards. Advanced: multilingual voice coaching and longitudinal memory controls. |
| Weekly progress summary | A one-screen summary says what changed, what to do next, and asks one check-in question. | Metrics service + LLM. | Precompute metrics; send minimal de-identified context; cite data points; queue weekly generation. | Low | MVP: scheduled in-app card. Advanced: coach co-sign and experiments. |
| Plateau/churn prediction | Coach sees “needs attention” with transparent drivers; member sees a supportive intervention. | Rules initially; supervised ML with enough data. | Feature store of adherence, missed sessions, streak changes, check-ins; score with calibration and bias monitoring. | Medium | MVP: deterministic risk rules. Advanced: trained model + experiment framework. |
| Form analysis & rep counting | During a recorded set, user receives an after-set cue and rep count with confidence. | Pose estimation + movement classifier; optional speech. | On-device pose first; upload only with explicit consent; per-exercise state machine; never market as injury prevention. | High | MVP: asynchronous rep count/range-of-motion for 2–3 exercises. Advanced: real-time personalized cues after validation. |
| Studio scheduler and coach copilot | Staff gets draft schedules/class blocks and coach-facing session revisions. | LLM + optimization solver + RAG. | Scheduling constraints remain deterministic; LLM turns natural language into constraints and explains drafts. | High | MVP: draft class descriptions/coach plans. Advanced: capacity, payroll, waitlist optimization. |

### AI quality system prompts to adapt

Adapt—not copy—the reference workflow’s strongest concepts:

1. **Gated intake.** Do not generate a plan until the minimal decision-critical data is present. Improve it by allowing “start simple” defaults and explaining what is optional.
2. **Program phase + weekly check-in.** Treat the plan as a versioned hypothesis, not a document. Log check-ins, apply a bounded revision, and surface the difference.
3. **Exercise substitutions and form cues.** Store them as structured library content tied to movement patterns, equipment, contraindication flags, and locale—not prose generated afresh each time.
4. **RPE/RIR and progression rules.** Keep them as deterministic policy and show a short reason; do not rely on an LLM to calculate loads.
5. **Safety boundaries.** Retain explicit pain/red-flag escalation and uncertainty. Remove the “must ask every question” rigidity and avoid using body photos as a basis for diagnosis or precise body-fat claims.

**Production system prompt pattern:** “You are Trainova Coach. Use only retrieved athlete facts and approved knowledge. Never diagnose or claim certainty from photos. When pain/red flags are reported, follow the escalation policy. Return a valid `CoachingProposal` with evidence IDs, confidence, risk level, and actions selected from allowed commands. Prefer the smallest safe change. State what data is missing.”

The referenced prompt’s staged intake, weekly check-in, RPE progression logic, substitutions, and safety disclaimer are worth adapting; its photo-body-analysis step should be opt-in, privacy-forward, and explicitly low-confidence. Source: [fitness-coach-prompt.md](https://github.com/thatssoheil/prompts/blob/main/fitness-coach-prompt.md).

## Missing Features

### Member

- Check-ins (sleep, stress, soreness, motivation, pain) and a versioned plan-revision history.
- Rep ranges, warm-up sets, tempo, cues, substitutions, exercise video, rest defaults, and session feedback retained end-to-end.
- Notifications, streaks, milestones, calendar commitments, and explicit goals with progress projections.
- Apple Health/Health Connect/wearable integrations with granular consent.
- Nutrition diary, food database, macro targets, grocery lists, and dietary/religious/allergen preferences.
- Data export, account deletion, privacy center, AI-memory controls, unit conversion history, and accessibility settings.

### Coach/studio

- Team/tenant model, coach approval queue, client messaging, intake review, schedule/booking/waitlist, attendance, payments, waivers, and class programming.
- Coach dashboard that highlights exceptions: missed sessions, pain flags, stalled lifts, low engagement, and achievements needing acknowledgement.

## Competitor-Inspired Ideas

- **Freeletics:** Adopt post-session difficulty feedback and context modifiers (available time, gym closed, quiet/no-space); this is a simple route to true adaptation rather than a static generated plan. [Freeletics Coach](https://www.freeletics.com/en/blog/posts/how-freeletics-coach-gets-you/)
- **WHOOP:** Adopt a daily outlook and behavior journal only after Trainova can explain the relationship and uncertainty; link habits to action rather than expose more scores. [WHOOP Coach](https://support.whoop.com/s/article/How-to-Use-the-AI-Powered-WHOOP-Coach)
- **Tonal:** Treat form feedback as confidence-building post-set guidance, not a medical or injury-prevention claim. Start with a narrow exercise set and measurable accuracy target. [Tonal form feedback](https://tonal.com/blogs/all/tonal-gym-features-for-confidence)
- **Peloton:** Personalized plans and member teams reinforce that programming plus accountability/community is more defensible than an exercise library. [Peloton AI product update](https://investor.onepeloton.com/node/12701/pdf)

## Prioritized Product Roadmap

| Horizon | Recommendation | Problem → proposed solution | User benefit | Business impact | Complexity | Priority | AI integration |
|---|---|---|---|---|---|---|---|
| **Quick wins (1–2 days)** | Fix mobile welcome and add visual checks | First-screen overflow → responsive constraints and Playwright screenshots at 320/375/390px. | Can sign up on any phone. | Protects acquisition. | Low | P0 | None. |
| | Lock down AI API | Unauthenticated/weakly validated endpoints → common auth guard, input limits, rate limits, schema validation, audit logging. | Safer reliable output. | Limits cost and liability. | Medium | P0 | Required foundation. |
| | Keep structured AI fields | Generator loses programming fields → preserve rest/RPE/cue/substitution in template schema and UI. | Actionable plans. | Increases perceived AI quality. | Low | P0 | Structured output mapping. |
| | Add post-workout feedback | Static plan → “easy/right/hard,” pain, time, and confidence input after finish. | Plan feels responsive. | Generates core retention data. | Low | P0 | Feeds deterministic adaptation. |
| **Short-term (1–4 weeks)** | Ship Adaptive Today | One-shot generation → recommendations based on performance/check-in with Accept/Why. | Personal plan without chat friction. | Main product differentiation. | Medium | P0 | Rules + LLM explanation. |
| | Normalize core sync aggregates | Full snapshot conflicts → command/outbox + session/set/plan/check-in tables and incremental pull. | Reliable multi-device logging. | Enables scale, analytics, coach workflows. | High | P0 | Trusted AI context. |
| | Rebuild onboarding | High disclosure/form abandonment → progressive intake and plan preview in under 90 seconds. | Faster first workout. | Higher activation. | Medium | P0 | Adaptive interview. |
| | Coach review inbox | Coach sees raw history → exceptions plus approve/edit/reject plan revisions. | Better human coaching. | Monetizable coach tier. | Medium | P1 | AI drafts, humans approve. |
| | Weekly Coach Brief | Charts lack decisions → summary, next action, and one question. | Understandable progress. | Weekly habit loop. | Medium | P1 | Metrics-to-language service. |
| **Mid-term (1–3 months)** | Nutrition foundation | Training-only product → macro calculator, meal plan, grocery list, logging. | One place for body-composition goals. | Pro upgrade path. | Medium | P1 | Rules + LLM/RAG. |
| | Integrations/readiness | No recovery context → consented Health Connect/Apple Health and self-report readiness service. | Safer adaptation. | Increases daily relevance. | High | P1 | Baselines/rules first. |
| | Studio/coaching team MVP | Trainer is a simple assignment screen → multi-tenant roles, membership, client consent, schedule/attendance integration. | Coordinated coaching. | Studio SaaS revenue. | High | P1 | Coach/scheduler copilot. |
| | Analytics and experimentation | No retention learning loop → event taxonomy, warehouse, funnel dashboards, feature flags. | Better product over time. | Proves ROI and pricing. | High | P1 | Enables calibrated churn/plateau models. |
| **Long-term (3–12 months)** | Vision fitness lab | No camera capability → opt-in pose/rep MVP for 2–3 exercises with accuracy review. | More confidence training alone. | Premium differentiation. | High | P2 | On-device pose + classifier. |
| | Predictive coaching | Rules only → calibrated adherence/plateau risk and intervention experiments. | Help before setbacks. | Retention and coach leverage. | High | P2 | Supervised ML with governance. |
| | Operations suite | No studio operations → booking, capacity, payments, member success workflows. | Seamless studio experience. | Larger contracts/churn reduction. | High | P2 | Constraint solver + LLM drafts. |

## Technical Architecture Recommendations

1. Establish a **modular monolith**: Next.js BFF/API, domain command handlers, Postgres, Redis queue/cache, object storage, and worker processes. Split services only at real scale boundaries (vision, analytics, notifications).
2. Preserve **local-first** behavior with an append-only outbox and idempotent commands (`CompleteSet`, `FinishSession`, `AcceptPlanChange`) rather than syncing arbitrary state objects.
3. Use authoritative, versioned program entities. AI outputs are `proposals`; only accepted proposals create a `program_revision` and derived session targets.
4. Implement end-to-end observability: request correlation ID, product events, AI run cost/latency/safety outcome, queue retries, and SLOs for logging.
5. Build feature flags and an evaluation harness before complex AI: golden test athletes, safety cases, schema tests, output comparison, and periodic coach review.

## Database & API Improvements

### Core tables

Add or normalize: `organizations`, `organization_members`, `athlete_profiles`, `health_consents`, `training_goals`, `check_ins`, `programs`, `program_revisions`, `program_days`, `exercise_library`, `exercise_variants`, `exercise_substitutions`, `workout_sessions`, `workout_sets`, `session_feedback`, `nutrition_targets`, `food_logs`, `coach_client_relationships`, `assignments`, `events`, `ai_runs`, `ai_proposals`, and `audit_events`.

Keep sensitive body/health data separate with purpose, consent version, retention policy, and access scope. Store photographs/video in private object storage with short-lived URLs; never put media or raw model traces in broad analytics tables.

### API shape

```text
POST /v1/check-ins                         -> CheckIn
GET  /v1/today                             -> TodayRecommendation
POST /v1/ai/proposals/training             -> CoachingProposal (async if slow)
POST /v1/ai/proposals/{id}/accept          -> ProgramRevision
POST /v1/sessions/{id}/sets/{id}/complete  -> SetCompleted event
POST /v1/sessions/{id}/feedback            -> SessionFeedback
GET  /v1/coaches/me/attention-queue        -> ClientAttention[]
POST /v1/media/food-analysis               -> DraftMeal (confirmation required)
```

Use an idempotency key, actor/tenant context, optimistic version, and audit event for every mutating command. Return explicit errors (`CONFLICT`, `NOT_AUTHORIZED`, `SAFETY_ESCALATION`, `AI_UNAVAILABLE`) with recoverable client actions.

## AI Architecture Diagram (described in text)

```text
Mobile PWA
  └─ Local store + encrypted outbox
       └─ API/BFF: auth, tenant, consent, rate limit, idempotency
            ├─ Command domain: sessions, plans, check-ins, nutrition
            │    └─ Postgres (normalized source of truth) → event/outbox
            ├─ Read models: Today, coach queue, weekly metrics
            ├─ Worker queue: notifications, rollups, AI jobs, media jobs
            └─ AI orchestration
                 ├─ Policy/safety gateway and risk triage
                 ├─ Context builder: minimum scoped athlete facts + consent
                 ├─ Rules engine: progression, readiness, contraindications
                 ├─ Knowledge retrieval: vetted exercise/nutrition/coaching RAG
                 ├─ Model gateway: structured LLM / vision / speech
                 ├─ Output validator + deterministic safety checks
                 └─ Proposal store: evidence, confidence, cost, audit, evaluation

Only an accepted proposal becomes a versioned training/nutrition change.
```

## Future Vision (12–24 months)

Trainova becomes a **coaching intelligence layer**, not a chatbot or a generic gym-management system. A member opens Today and sees a recommendation grounded in their data, consent, constraints, and coach’s methodology. A coach sees the few people who need attention, can approve AI-drafted changes in seconds, and has transparent proof of why a recommendation was made. A studio sees adherence, capacity, and retention risks—while athletes retain control of their health data and AI memory.

The moat is the closed loop of high-quality structured training data, accepted/rejected coaching proposals, verified outcomes, and trusted human-in-the-loop feedback. Build that loop before broad vision, autonomous messaging, or full studio operations.

## Evidence and Validation

- Domain tests and type-checking pass: `28` tests across session lifecycle, merging, and progression; `pnpm typecheck` passes.
- Local mobile visual inspection found a horizontally overflowing welcome screen at 390px.
- The current product contains a well-designed session state model and deterministic progression rules, but deployed sync uses a full JSONB snapshot and AI route protections are inconsistent.
- Competitor inspiration is intentionally feature-level, not copied implementation: [WHOOP](https://support.whoop.com/s/article/Membership-Features-Benefits?language=en_US), [Freeletics](https://www.freeletics.com/en/hiit-workout-app/), [Tonal](https://tonal.com/blogs/all/tonal-gym-features-for-confidence), and [Peloton](https://investor.onepeloton.com/node/12701/pdf).

## Information Needed Before Committing to the Next Phase

- Target segment, geography, business model, price tolerance, and current user/retention data.
- Whether the active production backend is the custom Postgres Docker deployment or Supabase; migration constraints and privacy/compliance requirements.
- Availability and legality of exercise content, food database licensing, wearable integrations, and trainer/studio workflows.
- AI model/vendor constraints, budget per active member, data residency, and human safety-review policy.
- Any validated studio operating requirements: locations, class formats, booking system, member count, and payment provider.
