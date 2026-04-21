# QC Summary

## Scene retrieval

- Real scene models were found in [src/data/scenes.js](/Users/erikgw/Documents/tellastory/src/data/scenes.js).
- The suite uses the live `scenes` export directly.
- Scene semantics come from the real per-scene data, including:
  - `id`
  - `title`
  - `prompt`
  - `sample`
  - `sceneScript.coreActions`
  - `sceneScript.relationships`
  - `sceneScript.targetRelationships`

See [QC_SCENE_SOURCE.md](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_SCENE_SOURCE.md) for the full source-of-truth note.

## What was generated

- Scenes found: **20**
- QC cases generated: **560**
- Cases per scene: **28**
- Artifact files:
  - [QC_CASES.json](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_CASES.json)
  - [QC_RESULTS_BEFORE.json](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_RESULTS_BEFORE.json)
  - [QC_EVAL_BEFORE.json](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_EVAL_BEFORE.json)
  - [QC_RESULTS_AFTER.json](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_RESULTS_AFTER.json)
  - [QC_EVAL_AFTER.json](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_EVAL_AFTER.json)

## Major difficulty-system failures before changes

1. `nextStep` crossed the selected level boundary in **178** cases.
2. beginner leaked higher-level grammar by default in **80** cases.
3. readiness hints were too strict in a small subset of intermediate cases (**2** cases).

## Major feedback failures before changes

1. `Better version` felt generic or artificial in **63** advanced cases.
2. The main weakness there was the generic fallback line:
   - `Before that, something had already happened.`

## Major changes implemented

1. Added a pure exported backend entrypoint `generateFeedback(...)` for repeatable QC without HTTP.
2. Switched the QC runner to use that pure entrypoint directly.
3. Kept `nextStep` strictly inside the selected level.
4. Made advanced `nextStep` explicitly name earlier-past work.
5. Added advanced rewrite repair plus scene-grounded earlier-past fallback sentences.
6. Broadened intermediate readiness detection to accept clearly expressed action relationships beyond a literal `when/while` match.

See [QC_CHANGES.md](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_CHANGES.md) for the full mapping from failure patterns to code changes.

## Before vs after

- Baseline top failure patterns: **4**
- After rerun top failure patterns: **0**
- All 560 cases now score `PASS` across:
  - difficulty level clarity
  - level boundary safety
  - betterVersion level safety
  - nextStep level safety
  - readiness hint discipline
  - grammar-function explanation quality
  - specificity
  - scene relevance
  - classroom usefulness

See [QC_DIFF.md](/Users/erikgw/Documents/tellastory/qc/feedback-engine/QC_DIFF.md) for the detailed before/after comparison.

## Remaining risks

1. The QC suite is running in an environment without network access to OpenAI, so it validates:
   - the deterministic/local feedback engine
   - shared normalization logic
   - shared level-safety behavior
   but **not** live cloud-model output quality.
2. The suite is strongest in English, because that is the classroom grammar target and the QC UI framing is currently English-only.
3. The scene-derived test generation is robust, but still synthetic. It is much better than a tiny hand-written set, though still not a substitute for real classroom logs.

## Future safety

**Yes, with one explicit caveat.**

Why it is future-safe:
- the QC runner imports live scene models from [src/data/scenes.js](/Users/erikgw/Documents/tellastory/src/data/scenes.js)
- the dataset scales automatically with the scene list
- the generated cases derive from current `sceneScript` relationships and actions

The caveat:
- if the app later depends heavily on live OpenAI output style rather than the deterministic normalization path, this suite should be extended with an online integration mode once networked CI or a controlled staging environment is available.
