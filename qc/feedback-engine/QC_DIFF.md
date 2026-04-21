# QC Diff

## Scope

- Scenes tested: **20**
- QC cases tested: **560**
- Scene source: [src/data/scenes.js](/Users/erikgw/Documents/tellastory/src/data/scenes.js)
- Harness: [qc/feedback-engine/run_qc.mjs](/Users/erikgw/Documents/tellastory/qc/feedback-engine/run_qc.mjs)

## Before vs After

| Area | Before | After | Outcome |
| --- | ---: | ---: | --- |
| Level clarity PASS | 480 / 560 | 560 / 560 | improved |
| Level boundary safety PASS | 480 / 560 | 560 / 560 | improved |
| Better version level safety PASS | 480 / 560 | 560 / 560 | improved |
| Next step level safety PASS | 382 / 560 | 560 / 560 | improved |
| Readiness hint discipline PASS | 558 / 560 | 560 / 560 | improved |
| Grammar-function explanation quality PASS | 560 / 560 | 560 / 560 | unchanged strong |
| Specificity PASS | 560 / 560 | 560 / 560 | unchanged strong |
| Scene relevance PASS | 560 / 560 | 560 / 560 | unchanged strong |
| Classroom usefulness PASS | 560 / 560 | 560 / 560 | unchanged strong |
| Better version quality PASS | 497 / 560 | 560 / 560 | improved |

## Major Failure Patterns

### `nextstep-crossed-level-boundary`
- **Before:** 178 cases
- **After:** 0 cases
- **Status:** resolved
- **What changed:** `nextStep` no longer uses stretch-mode escalation. Stretch is now reserved for `levelReadinessHint`, not the main next action.

### `basic-leaked-higher-level-grammar-by-default`
- **Before:** 80 cases
- **After:** 0 cases
- **Status:** resolved
- **What changed:** beginner `nextStep` now stays inside basic narration even when the answer is already strong.

### `better-version-felt-generic-or-artificial`
- **Before:** 63 cases
- **After:** 0 cases
- **Status:** resolved
- **What changed:** advanced rewrites now prefer repaired student wording or a scene-grounded earlier-past sentence instead of the generic placeholder line.

### `readiness-hint-discipline-issue`
- **Before:** 2 cases
- **After:** 0 cases
- **Status:** resolved
- **What changed:** intermediate readiness detection now recognizes clear action-linking that uses equivalent relationship marking, such as `as`.

## Remaining Risks

- The QC suite runs the deterministic/local feedback path because this environment cannot reach `api.openai.com`. That means the before/after improvement is verified for the fallback engine and shared normalization layer, not for live model output quality.
- The English QC framing is strong and repeatable. Cross-language QC for Spanish and Swedish/Norwegian text remains outside this suite.
