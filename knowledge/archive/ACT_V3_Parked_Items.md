# ACT — V3 Parked Items
### Do not action until Golden Evals are collected and V2 second demo is complete.

---

## Items parked from V2 — action in V3

### 1. Inline comment output format
Red/yellow/green inline guidance inside the copy itself.
Currently too unstable on long copy — model loses formatting
discipline mid-article. Revisit after Golden Evals calibrate
the model's judgment. May require a separate "inline mode"
the journalist can request rather than the default output.

### 2. Legal accuracy check
"Does this story accurately reflect the court's ruling?"
Andrea flagged this as useful for adoption with court reporters.
Needs Golden Evals with court-beat stories to calibrate correctly.
Do not add without examples — risk of false flags on legal copy.

### 3. Visuals as formal editorial dimension
Seven_ways_to_boost_engagement.md covers this in the knowledge
base. Do not add as a formal Step 1 dimension until V3. Currently
referenced implicitly through the engagement guide.

### 4. Full grammar quality expansion
Beyond UK English and banned words (already in V2). Broader
English grammar quality check — sentence structure, passive
construction patterns, over-nominalisation. Add in V3 once
core checks are stable.

### 5. Print vs digital workflow distinction
One tool for now per meeting decision. V3 may need:
- Different handling for breaking news copy (shorter checklist,
  speed-aware output)
- Print desk workflow (different headline rules, different
  structural expectations)
- Digital urgency layer (SEO, mobile-first lede)
Architecture stub: add a "COPY TYPE" field to the output header
(Breaking / Feature / Analysis / Print) and route to different
check weights accordingly.

### 6. Breaking news adoption
Andrea flagged journalist reluctance under deadline pressure.
V3 consideration: a "quick mode" — 3 checks only, output in
under 30 seconds, no repair sequence. Triggered by journalist
typing "quick check" or "breaking."

### 7. Golden Evals — collection and integration
Do not ask Andrea to annotate 30–40 stories from scratch.
Process agreed:
- Generate V2 outputs on 5–10 real IE drafts
- Andrea reacts and edits each output
- Each edited output becomes a golden eval automatically
- Target: 10 evals minimum before V3 prompt calibration
- Format: Google Sheet (story, original output, Andrea's
  corrections, primary failure mode, quality rating)

### 8. Approachability and conversational style
Andrea flagged: over time, push for approachability, relatability,
and conversational style especially in features. This requires
golden evals on feature copy specifically. Not a prompt instruction
— a calibration outcome from the evals.

### 9. Consistency enforcement across newsroom
Andrea's broader expectation: the tool should help enforce
uniformity across IE newsroom over time. V3 consideration:
aggregate pattern reporting — what are the most common failure
modes across submissions? Requires session logging infrastructure
(Make.com or equivalent) outside the prompt itself.

---

## Reminder: Golden Evals method
Agreed in Andrea demo debrief:
- Generate outputs first, have Andrea react and edit
- Her edits = the golden eval
- Target 10 before V3 prompt calibration
- 30–40 is the long-term target for a robust system

---

*Parked: ACT V2.0 build | To be actioned: V3.0 after Golden Evals*
