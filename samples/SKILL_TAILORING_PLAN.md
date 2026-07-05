# Skill Tailoring Plan (plain language)

Status: DRAFT — for approval
Date: 2026-07-04

---

## The goal

When you submit a job description, the app compares what the job wants to what
your profile has, and for every gap it **suggests how to update your resume** —
and you approve. Nothing untrue goes on the resume; you always approve the words.

---

## Step 1 — Find the gaps

The app compares the job's skills to your profile's skills and sorts each into:

- **You have it** (exact) — nothing to do.
- **You have something close** (similar) — e.g. job wants Vue, you have React.
- **You don't have it** (missing) — e.g. job wants GraphQL, nothing close.

(Required skills become cards. Preferred skills you lack are quietly left out
and just listed as "assumed defaults".)

---

## Step 2 — The choices depend on the gap TYPE

There are two different situations, and the card is different for each.

### A) SIMILAR — you have a close skill (job wants Vue, you have React)
Choices:
- **Exchange** — rewrite your React bullet to say Vue instead
  ```
  Before:  Built dashboards with React.
  After:   Built dashboards with Vue.
  ```
- **Both** — mention React and Vue together
  ```
  Before:  Built dashboards with React.
  After:   Built dashboards with React and Vue.
  ```
- **Add to Skills only** — keep React in experience, just list Vue in skills
- **Leave it out** — nothing

### B) MISSING — nothing close (job wants GraphQL)
Choices:
- **Add a new bullet** (there is nothing to exchange with)
  ```
  + Built GraphQL APIs for flexible client data fetching.
  ```
- **Add to Skills only**
- **Leave it out**

### Certifications gap
Its own card: "Say I'm studying for it" / "Leave it out" / "Cancel".

---

## Step 3 — Which bullet the app touches (automatic)

The app decides WHERE automatically; the user only decides Exchange vs Both
(for similar) or Add-new (for missing).

- The app scans existing bullets for one that's **relevant / exchangeable**
  (the skill or a related skill appears in the bullet's text/technologies).
- **Similar skill + relevant bullet found** → app updates THAT bullet (Exchange or Both, per user choice).
- **Missing skill, or no relevant bullet** → app adds a NEW bullet.

---

## Honesty flag (important)

Exchange and Both both **claim the new skill**. The app treats these as
"user is confirming this is fair to claim", and attaches a quiet **risk note**
(e.g. "Vue claimed via React similarity — be ready to speak to it").
The app never silently invents — the user consciously chooses and is warned.

---

## Step 4 — You always approve the words

Whatever the app writes (updated bullet or new bullet), it shows you
**before → after** and you can:

- **Approve** — use it as is
- **Edit** — change the wording yourself
- **Back** — pick a different choice instead

Only after you approve does it go on the resume. This keeps everything truthful
and in your control.

---

## What's buildable now vs. needs the real AI

- **Buildable now (dev):** the whole flow — gap detection, the cards, the
  auto-placement decision (relevant bullet → update, else new), the
  before/after approval screen, applying edits.
  Wording will be **basic/placeholder** because the dev stub can't write smart sentences.
- **Needs Claude (later):** natural, high-quality wording for the updated/new bullets.
  We flip this on when we connect the real AI.

So we build and test the full experience now; the sentences get smart when Claude is connected.

---

## How "relevant bullet" is decided (dev version)

A bullet counts as relevant/exchangeable for a skill if the bullet's
technologies or text contains a related skill, using a small built-in
"related skills" map (e.g. Docker↔Kubernetes, React↔Vue, AWS↔GCP,
Postgres↔MySQL). If nothing matches → add a new bullet.
Later, Claude can make this judgment smarter.

---

## Build order

1. Gap detection (job skills vs profile skills) + the 3-choice cards.
2. "Add Experience" auto-placement (update relevant bullet, else new bullet).
3. Before → after approval screen (approve / edit / back).
4. Apply approved edits into the generated resume.
5. (Later) Connect Claude for smart wording.

Certifications gap card is included in step 1.
No seniority check anywhere (per your decision).
```
