# Trainova — Architecture Redesign

Goal: a strict separation of **Template (definition)**, **Session (execution)**, and
**History (record)**, with structured **Devices**, an explicit session **state machine**,
and home-screen logic that can never present a finished workout as "continuable."

---

## 1. Corrected system architecture

Three independent concerns, never conflated:

```
DEFINITION              EXECUTION                 RECORD
──────────              ─────────                 ──────
Program  ─┐
          ├─ Template ──(instantiate)──► Session ──(complete)──► History/Calendar
Device ───┘   (undated,      copies         (dated,                (read-only,
              reusable)      targets        single active)          status-filtered)
                             into sets
```

- **Template** is a pure, undated, reusable definition. It is never tied to a date and
  never carries execution state.
- **Session** is a dated instance with an explicit lifecycle. Exactly **one active
  session** may exist per user at a time (singleton invariant).
- **History/Calendar** are projections over sessions filtered by `status`, not separate
  objects.
- **Device** is a first-class structured entity referenced by both templates and sessions,
  replacing free-text `equipment` and name-embedded machine numbers.

---

## 2. Entity schema

```ts
// ---------- Equipment ----------
type DeviceCategory = "machine" | "free_weight" | "cable" | "bodyweight" | "cardio";

interface Device {
  id: string;
  ownerId: string | null;        // null = shared/global library
  name: string;                  // "Leg Press"  (NO number in the name)
  machineNumber: string | null;  // "22"         (structured, optional)
  category: DeviceCategory;
  imageUrl: string | null;       // visual card
  primaryMuscle: string | null;  // optional mapping
}

// ---------- Movement ----------
interface Exercise {
  id: string;
  ownerId: string | null;
  name: string;                  // movement, e.g. "Leg Press"
  defaultDeviceId: string | null;// structured link, not text
  isCompound: boolean;
  primaryMuscle: string | null;
}

// ---------- Definition (reusable, UNDATED) ----------
interface TemplateSet {           // per-set targets → supports ramps
  targetReps: number;
  targetWeight: number | null;
}
interface TemplateExercise {
  id: string;
  exerciseId: string;
  deviceId: string | null;       // device assigned in THIS template
  position: number;
  sets: TemplateSet[];           // e.g. [30×12, 35×12, 42.5×12]
  restSeconds: number;
}
interface WorkoutTemplate {
  id: string;
  ownerId: string;
  name: string;                  // INVARIANT: no dates allowed
  notes: string | null;
  exercises: TemplateExercise[];
}
interface Program {              // multi-day grouping of templates
  id: string;
  ownerId: string;
  name: string;
  source: "trainer" | "self";
  dayTemplateIds: string[];
}

// ---------- Execution (instance, DATED, explicit state) ----------
type SessionStatus = "active" | "completed" | "archived";

interface WorkoutSession {
  id: string;
  ownerId: string;
  templateId: string | null;     // null = free-form
  title: string;                 // snapshot of template name at start
  date: string;                  // YYYY-MM-DD (the calendar key)
  status: SessionStatus;         // EXPLICIT — replaces "endedAt === null"
  startedAt: string;             // ISO
  completedAt: string | null;    // set on completion
  reopenedAt: string | null;     // audit for completed→active edits
  updatedAt: string;
}

interface WorkoutSet {           // actual logged performance
  id: string;
  sessionId: string;
  exerciseId: string;
  deviceId: string | null;       // consistent with template
  setIndex: number;
  targetReps: number | null;     // snapshot from template at start
  targetWeight: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  rpe: number | null;
  completed: boolean;
  completedAt: string | null;
}
```

**Key invariants**
1. Template names may not contain dates (enforced at create/edit).
2. At most one session with `status = "active"` per owner.
3. `status` is the single source of truth for lifecycle — there is no separate
   `activeSessionId` pointer and no implicit null-as-state.
4. Sets snapshot their targets at start, so editing a template never rewrites history.

---

## 3. State machine

States: **active → completed → archived** (with a guarded `completed → active` re-open).

```
                ┌────────────── discard (empty/abandoned) ──────────────┐
                │                                                        ▼
 [create] ──► ACTIVE ──── finish ────► COMPLETED ──── archive ────► ARCHIVED
                ▲                          │                            │
                │                          │                            │
                └──── reopen (guarded) ◄───┘        unarchive ──────────┘
```

**Transition rules**

| From | Event | Guard | To | Effects |
|---|---|---|---|---|
| — | `create(templateId?)` | no other ACTIVE session exists | ACTIVE | copy template targets → sets; `startedAt=now`, `date=today` |
| ACTIVE | `finish` | ≥1 completed set | COMPLETED | `completedAt=now` |
| ACTIVE | `discard` | session has 0 completed sets | (deleted) | removes the dangling session entirely |
| COMPLETED | `reopen` | no other ACTIVE session exists | ACTIVE | `reopenedAt=now` (audit) |
| COMPLETED | `archive` | — | ARCHIVED | hidden from default history |
| ARCHIVED | `unarchive` | — | COMPLETED | — |

**Creation rule** — starting a template/empty workout when an ACTIVE session already
exists is **blocked**; the user must resume or discard the active one first. This removes
fragmentation.

**Continuation rule** — "Continue" applies **only** to the single ACTIVE session. A
COMPLETED session is terminal; it is *viewed*, not continued. Editing a completed workout
is a deliberate, separate `reopen` action, not the default home action.

**Completion rule** — completion is explicit and sets `status=completed`. An ACTIVE
session with no logged sets that the user walks away from is auto-discardable, so it can
never linger and masquerade as "in progress."

---

## 4. UX flow rules

**Home screen (derived, not pointer-based):**
```
active = sessions.find(s => s.status === "active")   // singleton, derived

if (active)            → show ONLY "Continue workout" (resume `active`)
else
  primary             → "Start from template"  (templates + program days)
  secondary (small)   → "Start empty workout"   (fallback, de-emphasized)
```
- Never render a dated/past session as a reusable plan.
- Templates are listed **without dates**; they are selectable independently of any date.
- Dates appear only on **sessions** (History, Calendar).
- Choosing a template while a session is ACTIVE → prompt **Resume / Discard**, never a
  silent second active session.

**Separation of surfaces**
- **Plans tab** → templates & programs (definitions, undated, reusable).
- **Calendar/History tabs** → sessions (dated, `status`-filtered; completed by default,
  archived hidden).
- **Session screen** → execution of the one active (or reopened) session.

---

## 5. Device UX

Replace text equipment with a structured library:
- **Visual device cards**: image + name + category badge + machine number.
- **Searchable device library** backed by the `Device` table (filter by category/muscle).
- **Template builder**: add exercise → assign a device from the library (picker returns a
  `deviceId`), never a typed string.
- **Session logging**: the same device id renders the same card/badge as the template, so
  equipment is consistent across definition and execution.
- **Number is data, not text**: `machineNumber` is its own field, not parsed out of the
  exercise name with a regex.

---

## 6. Bug root-cause analysis — "16.06 plan continues even when completed"

Four compounding design faults, all present in the current code:

1. **State persistence error (dangling pointer).** `activeSessionId` is persisted to
   localStorage and only cleared by an explicit `endSession`. Leaving a workout without
   tapping *Finish* leaves the pointer set forever, so Home keeps offering "Continue."
   The active marker is stored, not derived/validated.

2. **Template ↔ instance conflation.** The reusable template is literally named
   `"Gym Plan — 16.06"`. A definition is wearing an instance's identity (a date), so both
   the user and the UI treat the *plan* as *the workout done on the 16th*.

3. **Missing completion-state enforcement.** `WorkoutSession` encodes completion only as
   `endedAt === null`. "Active" is the *absence* of a value, not an asserted state. There
   is no `status` enum, no terminal-completed guarantee, and no guard against multiple
   un-ended sessions — so any session that never received `endedAt` is "active" forever.

4. **UI treats the latest session as the active plan.** Home keys off the persisted
   pointer and History renders `!endedAt → "in progress"`, so the most recent
   un-finished session is presented as a continuable plan instead of a finished record.

**Net:** implicit state (`null endedAt`) + a persisted pointer (`activeSessionId`) +
date-named templates ⇒ a completed-looking workout that still says "continue."

---

## 7. Refactor steps, ordered by priority

**P0 — Correctness (ship first, behavior-fixing)**
1. Add `status: "active"|"completed"|"archived"` + `completedAt` to `WorkoutSession`;
   migrate (`endedAt != null → completed`, else `active`). Drop `activeSessionId`; derive
   the active session from `status === "active"`.
2. Enforce the **single-active invariant** at creation; block new starts while one is
   active (Resume/Discard prompt).
3. `finish` → `completed`; auto-**discard** an abandoned ACTIVE session with 0 completed
   sets. Add explicit Discard.
4. Home logic: Continue only for the derived active session; otherwise template-first,
   empty-secondary. Forbid dates in template names; rename the `"16.06"` template
   (e.g. "Full Body A").

**P1 — Structure (Devices)**
5. Introduce `Device`; migrate `equipment` text + `(No.x)` name suffixes into Device rows;
   add `deviceId` to Exercise / TemplateExercise / WorkoutSet; clean exercise names.
6. Device library UI (searchable visual cards) + assignment in template builder +
   consistent device badge in logging.

**P2 — Depth**
7. Per-set template targets (`TemplateSet[]`) for ramps; snapshot into set targets at start.
8. Guarded `reopen` (completed→active) with audit; `archive` / auto-archive flow.
9. Extract transitions into a small session-state service with unit tests for every edge.

**P3 — Platform**
10. Persist the new schema to Supabase (status enum + RLS); add analytics on
    create/finish/discard to monitor fragmentation.

---

*Backwards-compat:* a one-time migration bumps the persisted store version, maps existing
`endedAt` → `status`, splits equipment/number into `Device`, and strips dates from template
names. Idempotent, keyed by stable ids.
