# QC Changes

## Change Log

### CHG-001
- **systemArea:** `shared`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js), [qc/feedback-engine/run_qc.mjs](/Users/erikgw/Documents/tellastory/qc/feedback-engine/run_qc.mjs)
- **whatChanged:** Exported a pure `generateFeedback(...)` function from the real backend and switched the QC harness to call it directly instead of spinning up a local HTTP listener.
- **whyChanged:** The sandbox blocked local port binding, and network access to the OpenAI API is unavailable here. Direct invocation keeps the QC run repeatable and still exercises the real feedback engine.
- **linkedFailureIds:** `shared-harness-blocker`

### CHG-002
- **systemArea:** `difficulty`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Removed stretch-mode escalation from `generateNextStep(...)` for beginner and intermediate. `nextStep` now always stays inside the currently selected level.
- **whyChanged:** Baseline QC showed 178 cases where `nextStep` crossed the level boundary and 80 beginner cases where higher-level grammar leaked in by default.
- **linkedFailureIds:** `nextstep-crossed-level-boundary`, `beginner-leaked-higher-level-grammar-by-default`

### CHG-003
- **systemArea:** `difficulty`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Tightened advanced `nextStep` copy so advanced prompts always name earlier-past work explicitly with `had`, `had been`, or `before`.
- **whyChanged:** Baseline QC flagged advanced `nextStep` prompts as only partially level-safe when they asked for an “earlier detail” without explicitly naming the earlier-past target.
- **linkedFailureIds:** `nextstep-crossed-level-boundary`

### CHG-004
- **systemArea:** `feedback`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Added `repairAdvancedTimelineRewrite(...)` and `sceneAwareEarlierPastSentence(...)`, and threaded them into `normalizeRewrite(...)` and the fallback rewrite path.
- **whyChanged:** Baseline QC showed 63 advanced cases where `Better version` fell back to the generic line “Before that, something had already happened.” or preserved unnatural malformed forms like `had been stole`.
- **linkedFailureIds:** `better-version-felt-generic-or-artificial`

### CHG-005
- **systemArea:** `difficulty`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Broadened intermediate clear-target detection so strong action-linking with `as` plus a clear background/event contrast counts as a stable intermediate success.
- **whyChanged:** Two readiness cases were being suppressed even when the answer clearly showed the intermediate relationship target, just not with the literal `when/while` pair.
- **linkedFailureIds:** `readiness-hint-discipline-issue`

## Notes

- No random prompt churn was introduced. Every logic change maps back to one of the recurring failures in `QC_EVAL_BEFORE.json`.
- The harness remains future-safe because it imports live scene data from [src/data/scenes.js](/Users/erikgw/Documents/tellastory/src/data/scenes.js) on every run.

### CHG-006
- **systemArea:** `feedback`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Rebuilt `betterVersion` around an explicit gated flow: `HIDE`, `POLISH`, `REPAIR`, or `REBUILD`. Removed the old “always force a distinct rewrite” behavior, added mode selection based on scene fit / level fit / clarity, and only keep a rewrite when it passes level-safety and usefulness checks.
- **whyChanged:** The new QC pass showed that `betterVersion` was still acting like an always-on paraphrase layer instead of a teaching scaffold, especially on already-strong answers.
- **linkedFailureIds:** `better-version-felt-generic-or-artificial`, `betterversion-display-rule-did-not-match-the-expected-hide-show-behavior`, `betterversion-rewrite-mode-did-not-match-the-expected-polish-repair-rebuild-behavior`

### CHG-007
- **systemArea:** `feedback`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js), [qc/feedback-engine/run_qc.mjs](/Users/erikgw/Documents/tellastory/qc/feedback-engine/run_qc.mjs)
- **whatChanged:** Added scene-aware rewrite helpers for article repair, sentence-boundary repair, connector repair, and scene-model rebuilds; expanded QC cases so each live scene now includes explicit hide/polish/repair/rebuild expectations for `betterVersion`.
- **whyChanged:** We needed repeatable coverage for the four rewrite outcomes, and we needed the real rewrite engine to produce educational repairs for weak but usable answers instead of only cosmetic surface changes.
- **linkedFailureIds:** `better-version-felt-generic-or-artificial`, `betterversion-rewrite-mode-did-not-match-the-expected-polish-repair-rebuild-behavior`

### CHG-008
- **systemArea:** `feedback`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js), [qc/feedback-engine/run_qc.mjs](/Users/erikgw/Documents/tellastory/qc/feedback-engine/run_qc.mjs)
- **whatChanged:** Added a minimal allowlist-based phrasal-verb detector and threaded it through narrative example extraction so feedback now prefers full meaning units like `went off`, `blew away`, `rolled away`, `hurried past`, and `rolled in`. Added targeted QC cases to verify full-phrase detection, full-phrase feedback wording, and one non-merge control case.
- **whyChanged:** Feedback was sometimes at risk of referring only to the base verb token instead of the full event phrase, which weakens the teaching value for scene narration.
- **linkedFailureIds:** `phrasal-verb-detector-missed-or-mis-merged-a-meaning-unit`, `feedback-did-not-refer-to-the-full-phrasal-verb`

### CHG-009
- **systemArea:** `shared`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js), [qc/feedback-engine/run_qc.mjs](/Users/erikgw/Documents/tellastory/qc/feedback-engine/run_qc.mjs)
- **whatChanged:** Hardened advanced earlier-past handling across detection, rating, rewrite, and `nextStep`. Past-perfect tokens are now excluded from simple-past extraction, advanced rating gets a floor when valid earlier-past structure is understandable, advanced `nextStep` shifts to structure/timeline refinement once `had` or `had been` is already present, and QC now includes explicit advanced cases for valid earlier-past sentences with clause/punctuation problems.
- **whyChanged:** QC exposed a recurring classroom failure where valid advanced answers were being treated as if they still needed `had`, or were at risk of being summarized around the wrong verb problem instead of the real structure issue.
- **linkedFailureIds:** `feedback-misread-past-perfect-as-simple-past`, `advanced-answer-with-valid-earlier-past-was-underrated`, `nextstep-repeated-the-advanced-target-structure-even-though-the-student-already-used-it`

### CHG-010
- **systemArea:** `feedback`
- **changedFiles:** [server/index.js](/Users/erikgw/Documents/tellastory/server/index.js)
- **whatChanged:** Tightened advanced sentence-extension selection so any added past-perfect sentence must match the student’s main event through shared actors or event tokens, and is rejected if it looks redundant or templated.
- **whyChanged:** We wanted to stop advanced rewrites from appending earlier-past lines that merely repeat the same action in another tense or pull in loosely related scene material.
- **linkedFailureIds:** `better-version-felt-generic-or-artificial`
