# DOM to PPTX Fidelity Issue Intake

Use this template for every Slides DOM to PPTX fidelity report before engineering triage.

## Required fields

- `Title`: short issue summary
- `Reporter`: name or team
- `Date`: YYYY-MM-DD
- `Affected story`: existing Slides story ID if known, otherwise `epic-unassigned`
- `Expected PPTX behavior`: concise description of what should happen
- `Actual PPTX behavior`: concise description of the mismatch
- `Impact`: why this blocks or degrades deck delivery
- `Minimal repro HTML`: smallest standalone HTML snippet that reproduces the issue
- `Minimal repro CSS`: smallest standalone CSS snippet that reproduces the issue
- `Fixture target path`: `tests/fixtures/slides/<filename>.html`
- `Regression target`: contract and/or e2e test file that should cover the case
- `Waiver`: `none` or explicit waiver ID with owner/date

## Triage rules

- Repros must be self-contained and deterministic. Strip app auth, network fetches, and unrelated markup.
- If the issue depends on linked CSS, inline the minimum required CSS into the report and fixture.
- Map every accepted issue to a Slides story before implementation.
- Add the repro to the edge-case corpus manifest before closing the story.
- New fixture failures block release unless the corpus entry includes an explicit waiver with owner and expiry rationale.

## Submission skeleton

```md
Title:
Reporter:
Date:
Affected story:
Expected PPTX behavior:
Actual PPTX behavior:
Impact:

Minimal repro HTML:
```html
<div class="slide-canvas"></div>
```

Minimal repro CSS:
```css
.slide-canvas {}
```

Fixture target path:
Regression target:
Waiver:
```
