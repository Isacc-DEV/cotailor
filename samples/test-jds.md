# Test Job Descriptions (dev / stub provider)

The dev stub only branches on: (a) civil/structural regex, (b) word count >= 50.
Use these against the "Backend Engineer - Node.js" sample profile.

---

## TC1 — Happy path (FinTech Full-Stack) → subtype_mismatch card → FINAL_READY

Paste this JD. Expect: category passes, ONE `subtype_mismatch` card
(Backend vs Full Stack). Answer "Yes, Generate Anyway" → board (no knockout
card because the profile has US work authorization) → strategy → resume.

```
Senior Full Stack Engineer — Payments (FinTech)

We are building the checkout and payments platform for a fast-growing fintech
company. You will design and ship customer-facing payment flows end to end,
from React interfaces down to Node.js services backed by PostgreSQL.

Responsibilities:
- Build and operate REST APIs for high-volume payment processing
- Integrate third-party payment providers and ensure PCI compliance
- Collaborate closely with product and design on the checkout experience

Requirements:
- Strong JavaScript and Node.js
- Experience with Vue or React on the frontend
- PostgreSQL and relational data modeling
- Cloud deployment on GCP with Kubernetes

Nice to have: Terraform, AWS Certified Solutions Architect, and prior
payments-domain experience. US work authorization required.
```

---

## TC2 — Category mismatch (Civil Engineering) → CATEGORY_REJECTED

Paste this JD. Expect: `category_mismatch` card, session goes to
CATEGORY_REJECTED (terminal — options are "Select Another Profile" /
"Use Another JD").

```
Structural Engineer — Commercial Construction

A leading civil engineering firm seeks a licensed Structural Engineer to design
and inspect commercial buildings and bridges.

Responsibilities:
- Perform structural analysis and load calculations
- Produce detailed drawings in AutoCAD
- Conduct on-site inspections during construction
- Ensure compliance with local building codes and safety standards

Requirements:
- PE License required
- Bachelor's degree in Civil or Structural Engineering
- 5+ years of experience on construction projects
- Familiarity with seismic design is essential
```

---

## TC3 — Too short → 422 (not a job description)

Paste this. Expect: error "This text is too short to be a job description —
please paste the full posting." (precheck needs >= 50 words).

```
Backend engineer wanted. Node.js and PostgreSQL. Apply now.
```

---

## TC4 — Knockout requirement (needs a profile with NO work authorization)

Use a profile whose Work Authorization is empty, then paste the TC1 FinTech JD.
After answering the subtype card with "proceed", expect a critical
`knockout_requirement` card: "US work authorization required".

(The stub's non-civil branch always emits a work_authorization knockout;
it auto-resolves only when the profile has workAuthorization set.)

---

## TC5 — Clean subtype pass (no subtype card)

Set the profile subtype to "Full Stack Engineer", then paste the TC1 JD.
Expect: NO subtype card; flow goes straight to the board.

---

## TC6 — Subtype "subsumes" (recommend proceed)

Set the profile subtype to exactly "Backend Engineer", then paste the TC1 JD.
Expect: `subtype_mismatch` card but recommended option = "proceed"
(vs. subtype "Backend" which yields a `sibling` relation → recommends cancel).

---

## Not reproducible with the stub
category_low_confidence, seniority_gap, missing_required_skill, similar_skill,
certification_risk — these need the real Claude provider or a more input-aware
stub.
```
