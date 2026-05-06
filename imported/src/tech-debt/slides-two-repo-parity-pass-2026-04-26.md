# Slides Two-Repo Parity Pass (2026-04-26)

Scope reviewed:
- `oliver-app` (current repo)
- `sibling parity repo` (sibling parity repo)

Goal:
- Ensure Slides backlog in `oliver-app` does not miss proven capability patterns already hardened in `sibling parity repo`, especially around full journey depth, chatbot fuzzy routing, design parity, and mobile safety.

## Parity Matrix

| Area | `sibling parity repo` pattern observed | `oliver-app` Slides current state | Gap decision |
| --- | --- | --- | --- |
| Chatbot command-flow contracts | Dedicated coverage contracts enforce action-flow-fuzzy parity (`chatbot-functionality-contracts`, alias checks). | Slides had command/flow runtime support but no dedicated contract gate. | Add `SLD-QA-611` + ship contract test. |
| Fuzzy routing robustness | Explicit fuzzy tests and trigger coverage across command catalogs. | Slides had aliases but no explicit drift guard for alias depth or required intents. | Add alias-depth and required-intent gate in contract test. |
| Mobile route-depth journey checks | Route/button flow tests + responsive overflow checklist across surfaces. | Slides mobile checks existed but were mostly shell-level and shallow. | Add `SLD-QA-612` + deeper Slides mobile path assertions. |
| Full click-path depth audits | Seeded route button flows and detailed journey docs with branch outcomes. | Slides has strong regression e2e, but no Slides-specific journey depth matrix artifact. | Add `SLD-QA-613`. |
| Design-system parity governance | Strong token/typography/layout contract discipline across modules. | Cross-module matrix exists, but Slides-specific shell parity story was not explicit. | Add `SLD-FE-616`. |
| Chatbot edit-function parity | Chatbot in `sibling parity repo` covers action workflows deeply, not just page-open intents. | Slides chatbot focused on import/save/export/open-tab actions; core editor commands were thinner. | Start `SLD-FE-615` with undo/redo + import-workspace coverage. |
| Data mapping + visualization risk checks | Contract-heavy checks for flow/data paths and rendering constraints. | Slides covers many contracts/e2e paths but matrixed click/data/visual traceability artifact is missing. | Capture in `SLD-QA-613` acceptance criteria. |

## Execution Completed In This Pass

1. Chatbot capability expansion in Slides:
   - Added commands: `slides-open-import`, `slides-undo`, `slides-redo`.
   - Added matching flows + runtime handlers.

2. Chatbot contract gate:
   - Added `tests/contracts/slides-chatbot-contract.test.mjs` to assert:
     - command-flow id parity
     - alias-depth minimums
     - required Slides journey capability ids

3. Mobile journey deepening:
   - Extended `tests/e2e/mobile-clickpaths.spec.ts` with a Slides-specific path test:
     - tab transitions (Import/My Slides/Templates/Activity)
     - chatbot-triggered workspace navigation
     - no-horizontal-overflow assertions per step

4. Backlog/story expansion:
   - Added stories:
     - `SLD-FE-615`
     - `SLD-FE-616`
     - `SLD-QA-611`
     - `SLD-QA-612`
     - `SLD-QA-613`

## Remaining High-Value Gaps

1. Extend chatbot edit-action surface beyond undo/redo (align/distribute/lock lifecycle with safe target validation).
2. Add mobile parse/edit/save assertions and overlap guards for chatbot panel versus toolbar actions.
3. Publish a Slides journey depth matrix with click counts, data-boundary mapping, and visual-overlap risk annotations.
