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
- **linkedFailureIds:** `nextstep-crossed-level-boundary`, `basic-leaked-higher-level-grammar-by-default`

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
