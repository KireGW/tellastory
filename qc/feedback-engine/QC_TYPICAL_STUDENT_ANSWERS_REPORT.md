# Typical Student Answer QC

Generated: 2026-06-06T17:59:50.383Z

## Scope

- Scenes: 20
- Levels: beginner, intermediate, advanced
- Cases: 120 (one typical good and one typical weak answer per scene and level)
- Feedback path: deterministic local `generateFeedback` with `OPENAI_API_KEY` cleared

## Verdict Breakdown

| Level | Quality | Cases | Cases with findings | Excellent | Good work | Good start | Needs work |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| beginner | good | 20 | 8 | 6 | 12 | 2 | 0 |
| beginner | bad | 20 | 20 | 0 | 0 | 20 | 0 |
| intermediate | good | 20 | 2 | 20 | 0 | 0 | 0 |
| intermediate | bad | 20 | 0 | 0 | 0 | 20 | 0 |
| advanced | good | 20 | 1 | 19 | 0 | 1 | 0 |
| advanced | bad | 20 | 4 | 0 | 6 | 14 | 0 |

## Improvement Patterns

- **feedback did not name the relevant verb form**: 20 case(s). Examples: `midnight-knock__beginner__typical-bad`, `market-spill__beginner__typical-bad`, `train-platform__beginner__typical-bad`, `kitchen-smoke__beginner__typical-bad`, `museum-alarm__beginner__typical-bad`, `beach-rescue__beginner__typical-bad`
- **feedback did not explain what the grammar does in the story**: 20 case(s). Examples: `midnight-knock__beginner__typical-bad`, `market-spill__beginner__typical-bad`, `train-platform__beginner__typical-bad`, `kitchen-smoke__beginner__typical-bad`, `museum-alarm__beginner__typical-bad`, `beach-rescue__beginner__typical-bad`
- **good typical answer received a rewrite that drifted from student wording**: 6 case(s). Examples: `midnight-knock__beginner__typical-good`, `market-spill__beginner__typical-good`, `office-outage__beginner__typical-good`, `airport-delay__beginner__typical-good`, `restaurant-proposal__beginner__typical-good`, `library-whisper__beginner__typical-good`
- **advanced weak-answer feedback did not clearly target earlier past**: 4 case(s). Examples: `kitchen-smoke__advanced__typical-bad`, `farm-storm__advanced__typical-bad`, `restaurant-proposal__advanced__typical-bad`, `library-whisper__advanced__typical-bad`
- **good typical answer was not treated as on target**: 4 case(s). Examples: `hospital-hall__intermediate__typical-good`, `school-lab__beginner__typical-good`, `city-parade__intermediate__typical-good`, `snowy-bus__beginner__typical-good`
- **good typical answer was not rewarded enough**: 3 case(s). Examples: `school-lab__beginner__typical-good`, `restaurant-proposal__advanced__typical-good`, `snowy-bus__beginner__typical-good`

## Representative Findings

### feedback did not name the relevant verb form

- `midnight-knock__beginner__typical-bad`
  - Student: The stranger knocks now. The cat is here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.
- `market-spill__beginner__typical-bad`
  - Student: The child drops now. The cyclist is here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.
- `train-platform__beginner__typical-bad`
  - Student: The man runs now. Pigeons are here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.

### feedback did not explain what the grammar does in the story

- `midnight-knock__beginner__typical-bad`
  - Student: The stranger knocks now. The cat is here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.
- `market-spill__beginner__typical-bad`
  - Student: The child drops now. The cyclist is here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.
- `train-platform__beginner__typical-bad`
  - Student: The man runs now. Pigeons are here.
  - Verdict/task: good-start / partly on target
  - Coach note: You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.
  - Try this: Change the verbs that are still in present tense to past tense.
  - Next step: Change the main verbs to the past tense.

### good typical answer received a rewrite that drifted from student wording

- `midnight-knock__beginner__typical-good`
  - Student: The stranger knocked. The cat jumped.
  - Verdict/task: good-work / on target
  - Coach note: You described the scene in the past. Now add a little more detail.
  - Try this: Add one more past-tense sentence about a visible action.
  - Next step: Add one more sentence about what another person was doing.
- `market-spill__beginner__typical-good`
  - Student: The child dropped. The cyclist swerved.
  - Verdict/task: good-work / on target
  - Coach note: You described the scene in the past. Now add a little more detail.
  - Try this: Add one more past-tense sentence about a visible action.
  - Next step: Add one more sentence about what another person was doing.
- `office-outage__beginner__typical-good`
  - Student: Lights went out. The coffee spilled.
  - Verdict/task: good-work / on target
  - Coach note: You described the scene in the past. Now add a little more detail.
  - Try this: Add one more past-tense sentence about a visible action.
  - Next step: Add one more sentence about what another person was doing.

### advanced weak-answer feedback did not clearly target earlier past

- `kitchen-smoke__advanced__typical-bad`
  - Student: The children were setting the table while the milk spilled.
  - Verdict/task: good-start / partly on target
  - Coach note: The sentence is understandable, but these background actions sound clearer in past continuous.
  - Try this: Keep the same scene details. Show the background actions with past continuous.
  - Next step: Use while with two ongoing actions so the time relationship is clearer.
- `farm-storm__advanced__typical-bad`
  - Student: The chickens ran while the child was carrying eggs.
  - Verdict/task: good-start / partly on target
  - Coach note: The sentence is understandable, but these background actions sound clearer in past continuous.
  - Try this: Keep the same scene details. Show the background actions with past continuous.
  - Next step: Use while with two ongoing actions so the time relationship is clearer.
- `restaurant-proposal__advanced__typical-bad`
  - Student: While the musicians were playing, the man opened the ring box.
  - Verdict/task: good-start / partly on target
  - Coach note: The sentence is understandable, but these background actions sound clearer in past continuous.
  - Try this: Keep the same scene details. Show the background actions with past continuous.
  - Next step: Use while with two ongoing actions so the time relationship is clearer.

### good typical answer was not treated as on target

- `hospital-hall__intermediate__typical-good`
  - Student: As the nurse was pushing the cart, the doors opened.
  - Verdict/task: excellent / partly on target
  - Coach note: You connected the actions clearly, and the time relationship works well.
  - Try this: Use when or while to connect two actions in the past.
  - Next step: Add one more sentence that connects actions clearly.
- `school-lab__beginner__typical-good`
  - Student: The foam overflowed. Students mixed.
  - Verdict/task: good-start / partly on target
  - Coach note: This sentence is grammatical, but it does not show the scene relationship as clearly as it could.
  - Try this: Keep the same scene details. Use one ongoing background action and one shorter past event.
  - Next step: Show the background action with past continuous so the time relationship is clearer.
- `city-parade__intermediate__typical-good`
  - Student: As the band was marching, a child lost a balloon.
  - Verdict/task: excellent / partly on target
  - Coach note: You connected the actions clearly, and the time relationship works well.
  - Try this: Use when or while to connect two actions in the past.
  - Next step: Add one more sentence that connects actions clearly.

### good typical answer was not rewarded enough

- `school-lab__beginner__typical-good`
  - Student: The foam overflowed. Students mixed.
  - Verdict/task: good-start / partly on target
  - Coach note: This sentence is grammatical, but it does not show the scene relationship as clearly as it could.
  - Try this: Keep the same scene details. Use one ongoing background action and one shorter past event.
  - Next step: Show the background action with past continuous so the time relationship is clearer.
- `restaurant-proposal__advanced__typical-good`
  - Student: The man had already opened the ring box before everyone noticed.
  - Verdict/task: good-start / on target
  - Coach note: You showed clearly what had happened earlier in the timeline.
  - Try this: Add one more sentence showing what had happened before the glass broke.
  - Next step: Add one more sentence showing what had happened before the glass broke.
- `snowy-bus__beginner__typical-good`
  - Student: Bus splashed. People waited.
  - Verdict/task: good-start / partly on target
  - Coach note: This sentence is grammatical, but it does not show the scene relationship as clearly as it could.
  - Try this: People were waiting in the snow when the bus splashed slush.
  - Next step: Show the background action with past continuous so the time relationship is clearer.

## All Flagged Cases

| Case | Findings | Student answer | Verdict | Task fit | First correction |
| --- | --- | --- | --- | --- | --- |
| `midnight-knock__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | The stranger knocked. The cat jumped. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `midnight-knock__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The stranger knocks now. The cat is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `market-spill__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | The child dropped. The cyclist swerved. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `market-spill__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The child drops now. The cyclist is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `train-platform__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The man runs now. Pigeons are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `kitchen-smoke__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The smoke begins now. The grandmother is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `kitchen-smoke__advanced__typical-bad` | advanced weak-answer feedback did not clearly target earlier past | The children were setting the table while the milk spilled. | good-start | partly on target | Keep the same scene details. Show the background actions with past continuous. |
| `museum-alarm__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The alarm goes now. Visitors are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `beach-rescue__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The kite snaps now. The woman is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `office-outage__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | Lights went out. The coffee spilled. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `office-outage__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | Lights go now. The coffee is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `campfire-story__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The raccoon opens now. Campers are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `hospital-hall__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | Doors open now. The patient is here. | good-start | partly on target | A nurse was pushing a medical cart. A doctor was reading a chart. |
| `hospital-hall__intermediate__typical-good` | good typical answer was not treated as on target | As the nurse was pushing the cart, the doors opened. | excellent | partly on target | Use when or while to connect two actions in the past. |
| `school-lab__beginner__typical-good` | good typical answer was not rewarded enough; good typical answer was not treated as on target | The foam overflowed. Students mixed. | good-start | partly on target | Keep the same scene details. Use one ongoing background action and one shorter past event. |
| `school-lab__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The foam overflows now. Students are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `airport-delay__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | The announcement appeared. The family checked. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `airport-delay__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The announcement appears now. The family is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `farm-storm__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The rain starts now. The horse is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `farm-storm__advanced__typical-bad` | advanced weak-answer feedback did not clearly target earlier past | The chickens ran while the child was carrying eggs. | good-start | partly on target | Keep the same scene details. Show the background actions with past continuous. |
| `restaurant-proposal__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | The glass broke. Guests turned around. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `restaurant-proposal__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The glass breaks now. Guests are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `restaurant-proposal__advanced__typical-good` | good typical answer was not rewarded enough | The man had already opened the ring box before everyone noticed. | good-start | on target | Add one more sentence showing what had happened before the glass broke. |
| `restaurant-proposal__advanced__typical-bad` | advanced weak-answer feedback did not clearly target earlier past | While the musicians were playing, the man opened the ring box. | good-start | partly on target | Keep the same scene details. Show the background actions with past continuous. |
| `library-whisper__beginner__typical-good` | good typical answer received a rewrite that drifted from student wording | The shelf collapsed. Papers flew. | good-work | on target | Add one more past-tense sentence about a visible action. |
| `library-whisper__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The shelf collapses now. Papers are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `library-whisper__advanced__typical-bad` | advanced weak-answer feedback did not clearly target earlier past | The librarian was stamping books while someone whispered into a phone. | good-start | partly on target | Keep the same scene details. Show the background actions with past continuous. |
| `city-parade__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The child losts now. The photographer is here. | good-start | partly on target | A band was marching down the street. Dancers were waving flags. |
| `city-parade__intermediate__typical-good` | good typical answer was not treated as on target | As the band was marching, a child lost a balloon. | excellent | partly on target | Use when or while to connect two actions in the past. |
| `garage-repair__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The oil starts now. The tire is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `snowy-bus__beginner__typical-good` | good typical answer was not rewarded enough; good typical answer was not treated as on target | Bus splashed. People waited. | good-start | partly on target | People were waiting in the snow when the bus splashed slush. |
| `snowy-bus__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | Bus splash now. People are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `garden-party__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The tablecloth blews now. Candles are here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `film-set__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The prop sword falls now. The director is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
| `mountain-trail__beginner__typical-bad` | feedback did not name the relevant verb form; feedback did not explain what the grammar does in the story | The fog rols now. The hiker is here. | good-start | partly on target | Change the verbs that are still in present tense to past tense. |
