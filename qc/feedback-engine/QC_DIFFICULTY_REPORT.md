# QC Difficulty Report

## Does beginner behave like beginner?

**After the fixes: yes.**

What the suite checked:
- beginner answers can stay broad past narration
- stronger grammar is accepted if the student already uses it
- `Better version` does not automatically inject `when`, `while`, `had`, or `had been`
- `nextStep` stays focused on one more past sentence, one more detail, or one more action

What was weak before:
- beginner `nextStep` escalated to `when/while` too quickly
- this created the impression that beginner was secretly trying to become intermediate

What is true now:
- beginner keeps its descriptive role
- higher-level grammar is tolerated, not punished
- the main teaching move stays inside beginner by default

## Does intermediate behave like intermediate?

**After the fixes: yes.**

What the suite checked:
- intermediate centers on action relationships
- it pushes toward `when/while` when they are missing
- it does not jump to `had` / `had been` by default
- it accepts stronger answers that already contain earlier-past grammar without deleting them

What was weak before:
- a few readiness cases were too strict because the system treated `as` as weaker than the actual relationship quality justified

What is true now:
- intermediate still clearly teaches action-linking
- it now recognizes clear background/event relationships a little more gracefully
- the level does not collapse downward into beginner or upward into advanced

## Does advanced behave like advanced?

**After the fixes: yes.**

What the suite checked:
- advanced asks for an earlier past layer
- `Better version` includes or repairs `had` / `had been`
- `nextStep` explicitly names earlier-past work
- malformed earlier-past attempts are repaired instead of being replaced with generic filler

What was weak before:
- advanced rewrites sometimes fell back to the generic sentence `Before that, something had already happened.`
- some advanced prompts were too vague about the actual target

What is true now:
- advanced consistently targets earlier-time meaning
- `Better version` is more scene-aware and less artificial
- `nextStep` clearly reinforces `had` / `had been`

## Where are the level boundaries weak?

After this QC loop, no major boundary failures remain in the 560-case suite.

The previous weak spots were:
- beginner upward leakage through `nextStep`
- advanced rewrites using generic fallback text
- intermediate readiness being a little too strict in a narrow subset of relationship-marking cases

## Where does the system leak upward or downward?

**Before:** mainly upward from beginner into intermediate through `nextStep`.

**After:** no recurring upward or downward leak remains in the QC dataset.

## Is progression pedagogically coherent?

**Yes.**

The progression now behaves like:
- **beginner** = describe in the past
- **intermediate** = connect actions in the past
- **advanced** = add what happened before

This now holds not only in the instruction copy, but also in:
- `Better version`
- `nextStep`
- `levelReadinessHint`

## Are `betterVersion` and `nextStep` aligned with the selected level?

**Yes, after the fixes.**

Highlights:
- beginner `Better version` stays close and non-escalatory
- intermediate `Better version` can refine connection without inventing advanced grammar
- advanced `Better version` now repairs or adds an earlier-past layer in a scene-grounded way
- `nextStep` gives exactly one current-level action by default

## Are readiness hints too early, too late, or appropriate?

**Appropriate in the tested suite.**

Behavior now:
- they are separate from `nextStep`
- they are soft, optional, and non-evaluative
- they only appear when the current target is clearly established across recent attempts
- they never auto-switch the selected level

## Bottom line

The difficulty system now behaves like a coherent teaching ladder rather than a moving target:
- beginner stays beginner
- intermediate teaches connection
- advanced teaches earlier past
- stronger student grammar is preserved instead of simplified away
