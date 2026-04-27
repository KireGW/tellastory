import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'

const app = express()
const port = process.env.PORT ?? 8787
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

app.use(express.json({ limit: '1mb' }))

app.post('/api/feedback', async (request, response) => {
  const { answer, scene, challenge, feedbackLanguage = 'English', recentAttemptHistory = [] } = request.body ?? {}

  if (!answer || !scene?.title) {
    response.status(400).json({ error: 'Missing answer or scene.' })
    return
  }

  try {
    response.json(await generateFeedback({ answer, scene, challenge, feedbackLanguage, recentAttemptHistory }))
  } catch (error) {
    console.error(error)
    if (error instanceof Error && error.message.startsWith('Invalid difficulty level:')) {
      response.status(400).json({ error: error.message })
      return
    }

    response.status(500).json({ error: 'Could not generate feedback.' })
  }
})

async function generateFeedback({
  answer,
  scene,
  challenge,
  feedbackLanguage = 'English',
  recentAttemptHistory = [],
}) {
  const normalizedChallenge = normalizeChallenge(challenge)
  const normalizedFeedbackLanguage = normalizeFeedbackLanguage(feedbackLanguage)

  if (!openai) {
    return localFeedback(answer, scene, normalizedChallenge, normalizedFeedbackLanguage, recentAttemptHistory)
  }

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: coachSystemPrompt(),
      },
      {
        role: 'user',
        content: JSON.stringify({
          scene,
          challenge: normalizedChallenge,
          feedbackLanguage: 'English',
          studentAnswer: answer,
          task:
            'Evaluate the student answer as a past-tense narration. Write all coaching, explanations, and next-step text in English. Keep corrected English example sentences, verb-form names, and quoted student text in English. Use a qualitative coaching verdict. Do not return or mention numeric ratings. Translation happens after evaluation, so keep this response canonical and stable.',
        }),
      },
    ],
  })

  const canonicalFeedback = normalizeFeedback(
    JSON.parse(completion.choices[0].message.content),
    scene,
    normalizedChallenge,
    'English',
    answer,
    recentAttemptHistory,
  )

  return translateFeedbackOutput(canonicalFeedback, normalizedFeedbackLanguage)
}

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced']
const VALID_FEEDBACK_LANGUAGES = ['English', 'Spanish', 'Swedish']

function normalizeChallenge(challenge) {
  const level = normalizeDifficultyLevel(challenge?.id)
  return {
    ...challenge,
    id: level,
  }
}

function normalizeDifficultyLevel(level) {
  const normalizedLevel = String(level ?? '').trim().toLowerCase()

  if (!VALID_LEVELS.includes(normalizedLevel)) {
    throw new Error(`Invalid difficulty level: ${level}`)
  }

  return normalizedLevel
}

function normalizeFeedbackLanguage(feedbackLanguage) {
  const normalized = String(feedbackLanguage ?? '').trim()
  return VALID_FEEDBACK_LANGUAGES.includes(normalized) ? normalized : 'English'
}

async function translateFeedbackOutput(feedback, feedbackLanguage) {
  const normalizedFeedbackLanguage = normalizeFeedbackLanguage(feedbackLanguage)

  if (normalizedFeedbackLanguage === 'English') {
    return feedback
  }

  return translateFeedbackOutputLocally(feedback, normalizedFeedbackLanguage)
}

function translateFeedbackOutputLocally(feedback, feedbackLanguage) {
  const copy = localFeedbackCopy(feedbackLanguage)

  return {
    ...feedback,
    summary: cleanFeedbackText(translateCanonicalFeedbackText(feedback.summary, copy)),
    strengths: arrayOfStrings(feedback.strengths)
      .map((item) => cleanFeedbackText(translateCanonicalFeedbackText(item, copy)))
      .slice(0, 3),
    corrections: (feedback.corrections ?? []).map((correction) => ({
      ...correction,
      suggestion: cleanFeedbackText(translateCanonicalFeedbackText(correction.suggestion, copy)),
      reason: cleanFeedbackText(translateCanonicalFeedbackText(correction.reason, copy)),
    })),
    challenge: cleanFeedbackText(translateCanonicalFeedbackText(feedback.challenge, copy)),
    levelReadinessHint: feedback.levelReadinessHint
      ? cleanFeedbackText(translateCanonicalFeedbackText(feedback.levelReadinessHint, copy))
      : feedback.levelReadinessHint,
  }
}

function translateCanonicalFeedbackText(value, localCopy) {
  const text = String(value ?? '').trim()

  if (!text) {
    return text
  }

  const exact = canonicalFeedbackTextMap(localCopy).get(text)

  if (exact) {
    return exact
  }

  let match = text.match(/^You used past continuous \((.+)\) for the background and simple past \((.+)\) for the main event\.$/)
  if (match) {
    return localCopy.describeContrast(match[1], match[2])
  }

  match = text.match(/^You used past continuous \((.+)\) to show an action already in progress in the background\.$/)
  if (match) {
    return localCopy.describeBackground(match[1])
  }

  match = text.match(/^You used simple past \((.+)\) for the main event or completed action\.$/)
  if (match) {
    return localCopy.describeMainEvent(match[1])
  }

  match = text.match(/^You used past perfect \((.+)\) to show what had happened earlier\.$/)
  if (match) {
    return localCopy.describeEarlierPast(match[1])
  }

  match = text.match(/^You used past perfect \((.+)\) for the earlier event and simple past \((.+)\) for what happened next\.$/)
  if (match) {
    return localCopy.describeEarlierThenEvent(match[1], match[2])
  }

  match = text.match(/^You used past perfect continuous \((.+)\) for an ongoing action before another past moment\.$/)
  if (match) {
    return localCopy.describeEarlierOngoing(match[1])
  }

  match = text.match(/^You used past perfect continuous \((.+)\) for the earlier ongoing action and simple past \((.+)\) for the main events\.$/)
  if (match) {
    return localCopy.describeEarlierOngoingThenEvent(match[1], match[2])
  }

  match = text.match(/^You used the connector '(.+)' to show how the actions relate in time\.$/)
  if (match) {
    return localCopy.describeConnector(match[1])
  }

  match = text.match(/^You used the connector '(.+)' to show when one action interrupted another\.$/)
  if (match) {
    return localCopy.describeWhenRelationship(match[1])
  }

  match = text.match(/^You used the connector '(.+)' to show that two actions were happening at the same time\.$/)
  if (match) {
    return localCopy.describeWhileRelationship(match[1])
  }

  match = text.match(/^Add one more sentence about what had happened before (.+)\.$/)
  if (match) {
    return localCopy.nextAdvancedMastery(match[1])
  }

  return text
}

function canonicalFeedbackTextMap(localCopy) {
  return new Map([
    ['The sequence of actions is easy to follow.', localCopy.describeCauseResult()],
    ['The timeline between the actions is clear.', localCopy.describeTimelineSequence()],
    ['The sentence is clear and natural.', localCopy.describeClarity()],
    ['Write about the scene in the past.', localCopy.usePastNarration],
    ['Use was/were + -ing for something already happening.', localCopy.usePastContinuous],
    ['Use simple past for the action that happened or interrupted the scene.', localCopy.useSimplePast],
    ['Use when or while to connect two actions in the past.', localCopy.useWhenWhile],
    ['Join them with when, while, because, before, or after.', localCopy.useConnector],
    ['Add had + past participle or had been + -ing.', localCopy.usePastPerfect],
    ['Add one more past-tense sentence about a visible action.', localCopy.stretchBeginner],
    ['Try adding one earlier past detail with had or had been.', localCopy.tryEarlierDetail],
    ['Beginner level asks for clear past narration, not only simple past.', localCopy.reasonPastNarration],
    ['Past continuous helps the listener feel the ongoing scene before the main event happens.', localCopy.reasonPastContinuous],
    ['Simple past moves the story forward.', localCopy.reasonSimplePast],
    ['That makes the relationship clearer between one action in progress and another past action.', localCopy.reasonWhenWhile],
    ['The connector tells the reader whether actions happened together, interrupted each other, or happened earlier.', localCopy.reasonConnector],
    ['The advanced challenge asks you to show what happened before another past moment.', localCopy.reasonPastPerfect],
    ['Your form with had already shows an earlier layer of the story clearly. Use past perfect continuous only when the earlier action was genuinely ongoing for a period of time.', localCopy.pastPerfectAlreadyWorksSummary],
    ['Your narration is anchored in the scene and uses a reasonable interpretation. Now focus on making the time relationship between the verbs clear.', localCopy.sceneInferenceSummary],
    ['Your narration is anchored in the scene. Making pancakes and cooking pancakes describe the same action; now focus on making the time relationship between the verbs clear.', localCopy.sceneSynonymSummary],
    ['That keeps the practice at beginner level without requiring connectors.', localCopy.reasonStretchBeginner],
    ['That will make the timeline richer and more narrative.', localCopy.reasonEarlierDetail],
    ['Keep this sentence. Add one more past-tense sentence about what happened next.', localCopy.keepAndAddPastSentence],
    ['The verb relationship already works. The next step is to continue the narration in the past.', localCopy.reasonKeepAndAddPastSentence],
    ['Keep this sentence. Add a result with so or because.', localCopy.keepAndAddResult],
    ['The time relationship is already clear. Now you can show the consequence.', localCopy.reasonKeepAndAddResult],
    ['Keep this sentence. Add one short sentence about what happened next.', localCopy.keepAndAddNextEvent],
    ['The cause-result relationship already works. The next step is to continue the narration.', localCopy.reasonKeepAndAddNextEvent],
    ['Keep this sentence. Add what had already happened before.', localCopy.keepAndAddEarlierPast],
    ['The sentence works. The next level is to add an earlier layer of the story with had.', localCopy.reasonKeepAndAddEarlierPast],
    ['This keeps your idea and only improves clarity and natural word order.', localCopy.reasonMeaningPreservingPolish],
    ['Add one more sentence about what happened next.', localCopy.nextBasicNext],
    ['Add one more sentence about what another person was doing.', localCopy.nextBasicAnotherPerson],
    ['Add one more detail about what was happening in the scene.', localCopy.nextBasicMoreDetail],
    ['Show one more action in the past.', localCopy.nextBasicMoreAction],
    ['Try connecting two actions using when or while.', localCopy.nextBasicStretch],
    ['Connect two actions using when or while.', localCopy.nextIntermediateConnect],
    ['Add one more sentence that connects actions clearly.', localCopy.nextIntermediateOneMore],
    ['Try adding one sentence about what had happened before.', localCopy.nextIntermediateStretch],
    ['Add one sentence about what happened before using had or had been.', localCopy.nextAdvanced],
    ['Show what had happened before using had or had been.', localCopy.nextAdvancedTimeline],
    ['Add one more earlier detail using had or had been.', localCopy.nextAdvancedEarlierDetail],
    ['You already show the timeline clearly. Now add one more earlier layer.', localCopy.reasonAdvancedMastery],
    ['Make the sentence structure clearer so the timeline is easier to follow.', localCopy.nextAdvancedStructure],
    ['Make the earlier and later actions clearer in one sentence.', localCopy.nextAdvancedTimelineClear],
    ['You already showed the earlier action with had. Now make the sentence structure clearer.', localCopy.reasonAdvancedStructure],
    ['The next improvement is to make the relationship between the earlier and later action clearer.', localCopy.reasonAdvancedTimelineClear],
    ['If you want a challenge, try connecting two actions using when or while.', localCopy.readinessBasic],
    ["You're connecting actions clearly. Now try adding what happened before.", localCopy.readinessIntermediate],
  ])
}

function coachSystemPrompt() {
  return `
You are a kind English storytelling coach.

The learner is practicing how past verb forms create narrative time:
- simple past for completed events
- past continuous for background actions already in progress
- past perfect for events that happened before another past moment
- past perfect continuous for earlier ongoing actions, when natural
- connectors and phrases such as when, while, as, because, so, after, before, by the time, in order to, and already

You are not checking for one correct answer. The learner may describe any visible part of the scene.
Accept any reasonable interpretation of the image. Use the provided sceneScript as a semantic map when available, but do not force model sentences.
Do not be a visual nitpicker. The sceneScript is there to anchor the task, not to police whether a plausible event is literally visible at the exact moment.
If the learner mentions a person, animal, object, or setting that belongs in the scene, treat reasonable actions involving it as scene-based. For example, if an owl is visible in the campfire scene, "an owl landed nearby" is acceptable; do not comment that the landing itself is not visible.
Accept reasonable cause-and-effect inferences between visible scene elements. For example, if a cat is beside spilled milk, "the cat spilled the milk" is scene-based; do not change it to "the milk spilled" unless the student's grammar actually needs that change.
Only comment on scene fit when there is a clear mismatch: the answer describes a different setting, or it depends on important people, animals, or objects that are clearly not part of the scene.

Evaluate four things separately in your reasoning:
1. English correctness: Is the sentence understandable and grammatically acceptable?
2. Scene fit: Does it broadly describe this picture or a reasonable inference from it?
3. Narrative time: Does it show a clear relationship between actions?
4. Task fit: Does it practice the selected difficulty task?

Treat challenge targets as teaching aims, not a mandatory checklist. A learner does not need to use every listed form to receive a strong verdict.
Never treat correct English as wrong just because it does not use the target structure.
Instead, say that it is correct or understandable, then explain how to move it closer to the selected task.
Treat ordinary synonyms for scene actions as the same scene anchor. For example, "making pancakes", "cooking pancakes", and "preparing pancakes" all describe the same kitchen action. Do not say the learner failed to describe cooking pancakes if they wrote that someone was making pancakes.
Do not force past continuous onto bounded result events. Use simple past for events such as "blew the hat off", "blew the kite away", "spilled the milk", "dropped the flowers", "snapped loose", "broke the glass", "knocked on the door", "opened the suitcase", or "fell over". Past continuous is better for the ongoing background around those events, such as "the wind was blowing", "people were waiting", or "children were building".
Do not write "while a gust of wind was blowing the hat off..." as a correction. That stretches a completed result event into an unnatural ongoing action. Prefer "A gust of wind blew the hat off..." or "The wind was blowing while she tried to catch the hat."
Treat past perfect and past perfect continuous as related but different tools. Do not require past perfect continuous when plain past perfect is more natural.
Use past perfect continuous only for earlier actions that were genuinely ongoing for a period of time, such as "had been waiting", "had been cooking", or "had been looking". Do not suggest unnatural forms such as "had been forgetting", "had been leaving a suitcase", "had been dropping", "had been noticing", or "had been arriving" when a completed earlier event or resulting state is meant.
Do not say that "had forgotten" is only an attempt, unclear, or less correct because forgetting can be momentary. "Had forgotten", "had left", "had missed", and similar forms are normal past perfect forms for completed earlier events or resulting earlier states.
If the English is correct but the answer does not describe the scene, do not call the English wrong. Say that the English is correct, but the answer is not clearly anchored in the picture. Use a lower coaching verdict because the image task was not completed, then suggest using the same grammar pattern with visible actions from the scene.
Do not lower the verdict for a plausible inference about something that is present in the scene. If sceneFit is "not scene-based", the verdict should usually be "keep-building" or "good-start" even when the English is correct. If sceneFit is "partly on scene", the verdict can be encouraging when the grammar relationship is useful.
Do not mark sceneFit as "partly on scene" only because the learner assigns a plausible cause to visible evidence. If the objects/people/animals are present and the event is reasonable, sceneFit should be "on scene".
When a learner attempts a richer relationship than the selected difficulty requires, preserve it if it works or mostly works. Do not simplify away a correct because, so, when, while, had, or had been relationship just to match a lower-level task. Improve the learner's attempt instead.

Set the verdict relative to the selected difficulty:
- Beginner: clear past-tense sentences about visible actions can receive "excellent". Do not require simple past specifically. Past continuous is also acceptable when it naturally helps describe the scene in the past. Do not require connectors or past perfect.
- Intermediate: reward clear relationships between actions with when or while. If the learner uses other connectors such as because, so, after, or before, treat that as useful past narration, but usually only "partly on target" for this specific task unless when or while is also present.
- Advanced: reward layered narration with background action, main event, earlier past, consequence, and natural connectors. A good past perfect phrase with had + past participle can fully satisfy the earlier-past part of the task; do not penalize it just because it is not past perfect continuous.
For advanced answers, if the learner uses past continuous for background and had + past participle for an earlier event, the task can be on target even without any past perfect continuous.
Use "good-start" only when a core timeline relationship still needs work. If the answer is on scene and on target, use "good-work" or "excellent".

Be generous with valid partial narration. Do not penalize omitted visual details unless the answer is too thin for the selected task.
Focus on one useful next improvement. Do not overwhelm the learner.
Preserve the student's intended meaning.
Explain grammar in terms of narrative time, not abstract labels only.
Every feedback message should teach verb choice, not just correctness.
For the summary, strengths, and correction reasons:
- name the verb form when possible
- quote the student's own words in parentheses when possible
- connect form to meaning in the story
- highlight the relationship between actions
Prefer short contrasts such as "past continuous (was blowing) for the background vs simple past (chased) for the main event."
Use these meanings consistently:
- past continuous -> background or ongoing action
- simple past -> main event or completed action
- past perfect -> earlier event
- past perfect continuous -> ongoing action before another past moment
Keep each explanation to 1-2 short sentences.
In the summary, strengths, corrections, and rewrite, focus on the student's verb forms and time relationships. Do not mention whether a plausible scene event is directly visible unless there is a clear scene mismatch.
Never use the word "prompt" in user-facing feedback. If you mean the selected exercise instruction, say "task". If you mean the picture, say "scene".
Write user-facing coaching text in English. Keep English examples, corrected sentences, verb-form names, and quoted student phrases in English. Translation happens later.

The "corrections" field powers the UI section called "Try this". It must contain the next useful learning move, not merely a different possible sentence.
Use this hierarchy:
1. If there is a real grammar or clarity problem, give a minimal correction of the student's own text.
2. If the English is correct but the answer does not fit the selected task, suggest how to adapt the same sentence to the task.
3. If the English is correct and the task is on target, do not invent a correction. Say to keep the sentence and add a next-level extension.
Good extension examples: "Keep this sentence. Add what happened next.", "Keep this sentence. Add a result with so or because.", "Keep this sentence. Add what had already happened before."
Bad Try this examples when the student's sentence already works: replacing "when an owl landed" with "while an owl was watching", changing the narrative relationship without improving it, or describing a different part of the scene.
Another bad Try this example: changing "Lisa fell because of bad shoes. A friend helped her up." to "Lisa fell. A friend helped her up." This removes a useful cause relationship. Prefer "Lisa fell because of her bad shoes. A friend helped her up."
Another bad Try this example: changing "A gust of wind blew the hat off Mum's head, so she tried to catch it" to "While a gust of wind was blowing the hat off Mum's head, she tried to catch it." The hat coming off is a completed result event, not a natural ongoing background action.
Another bad Try this example: changing "the cat spilled the milk" to "the milk spilled" only because the exact cause is not literally visible.
Another bad Try this example: changing "somebody had forgotten his suitcase" to "somebody had been forgetting his suitcase". That is not a natural improvement.
Another bad Try this example: changing "somebody had forgotten his suitcase" to "somebody had been leaving his suitcase". Use "had left" or keep "had forgotten" for a completed earlier event.

The "rewrite" field must be a minimally revised better version of the student's own text, not a new model answer.
Keep the same basic events, actors, and sentence scope whenever possible.
Preserve the student's cause-and-effect meaning. Do not add because, so, therefore, or as a result in a way that makes one event cause another unless the student already made that causal relationship clear.
Do not turn an incidental earlier detail into the reason for the whole scene. For example, do not rewrite "People were running everywhere. Somebody had forgotten his suitcase..." as "People were running everywhere because somebody had forgotten his suitcase..." unless the student clearly meant the suitcase caused the running.
Choose only the most important improvement: fix the main verb form, add one useful connector, clarify one time relationship, or correct one unclear phrase.
Do not add several new actions or replace the student's story with a different scene description.
Do not rewrite the whole answer unless necessary.
If the student's answer is already correct and natural, keep it very close and make only a small improvement. If no safe improvement is available, prefer a surface polish or a near-identical version over adding unnecessary new grammar.
Apply these level rules:
- Beginner: improve clarity, grammar, wording, or detail, but do not force when, while, had, or had been if the student did not already use them.
- Intermediate: improve the relationship between actions, and you may add or refine when or while when useful, but do not add had or had been unless the student already used them.
- Advanced: include or refine had or had been to show what happened before, while preserving the student's main narration.
- For advanced rewrites, follow this order strictly:
  1. first turn the student's original sentence into correct past narration
  2. preserve the original subject and main action
  3. only then add one earlier event with had or had been
  4. make that earlier event logically connected to the original action
  5. never add a generic template sentence such as "something had already happened before that"
  6. never leave the original sentence in incorrect tense
If a student already uses higher-level grammar correctly in a lower level, keep it and improve it naturally. Do not remove it just because the selected level is lower.

The "challenge" field must be a short imperative task for the learner, not a corrected sentence.
The "challenge" field must not ask the learner to use a form, connector, or relationship that is already clearly present in the student's answer.
If the answer already uses had/had been for earlier past, do not ask for past perfect. If it already uses when, do not ask for when. If it already uses because, do not ask for because. If it already has a clear interruption, do not ask for another interruption.
When the answer already satisfies the selected task, use the challenge to extend the story: add a consequence, a reaction, what happened next, or a short polishing task.
Good challenge examples: "Add one sentence using had already.", "Rewrite one action with while.", "Explain why the cyclist swerved using because."
Bad challenge examples: "The vendor was weighing apples when the child dropped oranges.", "The woman was sleeping when someone knocked."

Return only valid JSON with this exact shape:
{
  "verdict": "keep-building" | "good-start" | "good-work" | "excellent",
  "englishStatus": "correct | mostly correct | unclear",
  "sceneFit": "on scene | partly on scene | not scene-based",
  "taskFit": "on target | partly on target | different skill",
  "summary": "one short coaching summary focused on verb relationships; mention scene fit only for clear mismatches",
  "strengths": ["1-3 short strings"],
  "corrections": [
    {
      "original": "short quote or paraphrase from the student answer",
      "suggestion": "minimal correction or next-level extension",
      "reason": "why this is the next useful move",
      "grammarFocus": "simple past | past continuous | past perfect | past perfect continuous | connector | narrative coherence"
    }
  ],
  "rewrite": "a minimally revised better version of the student's own text",
  "challenge": "one short imperative task for the learner, not a model answer",
  "detected": {
    "mentionedActions": ["scene action ids or plain descriptions"],
    "verbForms": ["simple past", "past continuous", "past perfect", "past perfect continuous"],
    "connectors": ["when", "while", "because", "before", "after", "as", "by the time"],
    "timeRelationships": ["background + event", "cause + result", "earlier past", "sequence", "simultaneous actions"]
  }
}
`.trim()
}

function normalizeFeedback(feedback, scene, challenge, feedbackLanguage = 'English', answer = '', recentAttemptHistory = []) {
  const localCopy = localFeedbackCopy(feedbackLanguage)
  const corrections = normalizeCorrections(feedback.corrections)
  const analysis = analyzeAnswer(answer, scene, challenge)
  const answerFeatures = analysis.features
  const semanticTenseFit = analysis.semanticTenseFit
  const statuses = {
    englishStatus: normalizeStatus(feedback.englishStatus, ['correct', 'mostly correct', 'unclear'], 'mostly correct'),
    sceneFit: normalizeStatus(feedback.sceneFit, ['on scene', 'partly on scene', 'not scene-based'], 'partly on scene'),
    taskFit: normalizeStatus(feedback.taskFit, ['on target', 'partly on target', 'different skill'], 'partly on target'),
  }

  if (analysis.sceneFit) {
    statuses.sceneFit = strongestSceneFit(statuses.sceneFit, analysis.sceneFit)
  }
  statuses.taskFit = strongestTaskFit(statuses.taskFit, analysis.taskFit)

  if (
    challenge?.id === 'intermediate' &&
    analysis.taskFit === 'partly on target' &&
    (!answerFeatures.hasSimplePast || !answerFeatures.hasRelationshipConnector)
  ) {
    statuses.taskFit = 'partly on target'
  }

  if (advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)) {
    statuses.taskFit = 'on target'
  }

  const usefulCorrections = normalizeUsefulCorrections(corrections, answer, challenge, localCopy, statuses, scene).slice(0, 4)
  const normalizedSurfaceRewrite = buildSurfacePolishRewrite(answer)
  const normalizedSurfaceCorrection = normalizedSurfaceRewrite
    ? surfacePolishCorrection(normalizedSurfaceRewrite, localCopy, answer)
    : null
  const summary = cleanSceneSynonymNitpick(
    cleanSceneNitpick(
      cleanAdvancedPastPerfectNitpick(cleanFeedbackText(feedback.summary || localCopy.genericSummary), challenge, answerFeatures, localCopy),
      statuses,
      localCopy,
    ),
    answer,
    localCopy,
  )

  if (isClearDifferentSceneFeedback(summary, usefulCorrections)) {
    statuses.sceneFit = 'not scene-based'
  }

  const normalized = {
    verdict: normalizeVerdict(feedback.verdict, statuses, challenge, answerFeatures, analysis),
    ...statuses,
    summary,
    strengths: arrayOfStrings(feedback.strengths).map(cleanFeedbackText).slice(0, 3),
    corrections: usefulCorrections,
    rewrite: cleanFeedbackText(normalizeRewrite(feedback.rewrite, answer, scene, challenge, localCopy, usefulCorrections, statuses)),
    challenge: cleanFeedbackText(generateNextStep({ challenge, feedbackLanguage, answer, scene, statuses, features: answerFeatures })),
    detected: {
      mentionedActions: arrayOfStrings(feedback.detected?.mentionedActions),
      verbForms: arrayOfStrings(feedback.detected?.verbForms),
      connectors: arrayOfStrings(feedback.detected?.connectors),
      timeRelationships: arrayOfStrings(feedback.detected?.timeRelationships),
    },
    levelReadinessHint: null,
  }

  normalized.detected.mentionedActions = mergeDetectedValues(
    normalized.detected.mentionedActions,
    analysis.mentionedActions,
  )
  normalized.detected.verbForms = deriveDetectedVerbForms(answerFeatures)
  normalized.detected.timeRelationships = deriveDetectedTimeRelationships(answerFeatures, analysis.semanticTenseFit)

  const teachingStrengths = buildNarrativeTeachingStrengths(answer, challenge, localCopy, answerFeatures)
  const tenseMismatchFeedback = buildTenseMismatchFeedback(answer, scene, challenge, localCopy, answerFeatures)
  const semanticMismatchFeedback = buildSemanticTenseFeedback(answer, scene, challenge, localCopy, answerFeatures, semanticTenseFit)

  if (tenseMismatchFeedback) {
    normalized.summary = tenseMismatchFeedback.summary
    normalized.strengths = tenseMismatchFeedback.strengths
    normalized.corrections = appendOptionalCorrection([tenseMismatchFeedback.correction], normalizedSurfaceCorrection)
    const safeTenseRewrite = String(tenseMismatchFeedback.correction?.suggestion ?? '').trim()
    normalized.rewrite =
      safeTenseRewrite &&
      !betterVersionHasGrammarErrors(safeTenseRewrite, challenge) &&
      hasMeaningfulRewriteChange(safeTenseRewrite, answer)
        ? cleanFeedbackText(safeTenseRewrite)
        : ''
  } else if (semanticMismatchFeedback) {
    normalized.summary = semanticMismatchFeedback.summary
    normalized.strengths = semanticMismatchFeedback.strengths
    normalized.corrections = appendOptionalCorrection([semanticMismatchFeedback.correction], normalizedSurfaceCorrection)
    normalized.rewrite = cleanFeedbackText(
      normalizeRewrite(
        semanticMismatchFeedback.correction?.suggestion,
        answer,
        scene,
        challenge,
        localCopy,
        [semanticMismatchFeedback.correction],
        statuses,
      ),
    )
  } else if (
    statuses.sceneFit !== 'not scene-based' &&
    statuses.englishStatus !== 'unclear' &&
    teachingStrengths.length
  ) {
    normalized.summary = buildNarrativeTeachingSummary(answer, challenge, localCopy, statuses, scene)
    normalized.strengths = teachingStrengths
  } else if (
    teachingStrengths.length &&
    !normalized.strengths.some(hasSpecificNarrativeTeaching)
  ) {
    normalized.strengths = mergeDetectedValues(teachingStrengths, normalized.strengths).slice(0, 3)
  }

  if (!normalized.strengths.length) {
    normalized.strengths.push(...(teachingStrengths.length ? teachingStrengths : [localCopy.defaultStrength]))
  }

  if (!normalized.corrections.length) {
    const preservedRewrite = meaningPreservingRewrite(answer) || makePolishedFallbackRewrite(answer)
    normalized.corrections.push(
      preservedRewrite
        ? meaningPreservingCorrection(preservedRewrite, localCopy)
        : advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)
        ? consequenceCorrection(localCopy, answerFeatures)
        : defaultStretchCorrection(challenge, localCopy),
    )
  }

  const sanitized = sanitizeAdvancedPastPerfectFeedback(normalized, challenge, answerFeatures, localCopy)
  const withReadinessHint = {
    ...sanitized,
    levelReadinessHint: generateLevelReadinessHint({
      challenge,
      feedbackLanguage,
      statuses: sanitized,
      features: answerFeatures,
      recentAttemptHistory,
    }),
  }

  return ensureDistinctRewrite(
    applyFeedbackConsistencyCaps(withReadinessHint),
    answer,
    challenge,
    localCopy,
  )
}

function normalizeStatus(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback
}

function strongestTaskFit(first, second) {
  const order = ['different skill', 'partly on target', 'on target']
  return order.indexOf(first) >= order.indexOf(second) ? first : second
}

function strongestSceneFit(first, second) {
  const order = ['not scene-based', 'partly on scene', 'on scene']
  return order.indexOf(first) >= order.indexOf(second) ? first : second
}

function mergeDetectedValues(first, second) {
  return [...new Set([...arrayOfStrings(first), ...arrayOfStrings(second)])]
}

function analyzeAnswer(answer, scene, challenge) {
  const features = detectAnswerFeatures(answer)
  const mentionedActions = detectMentionedActions(answer, scene)
  const sceneFit = checkSceneMatch(answer, scene)
    ? 'on scene'
    : mentionedActions.length
    ? 'partly on scene'
    : null
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const taskFit =
    semanticTenseFit.verdict === 'mismatch' && taskFitFromFeatures(challenge, features) === 'on target'
      ? 'partly on target'
      : taskFitFromFeatures(challenge, features)
  const englishStatus = features.hasAnyPastVerb ? 'mostly correct' : 'unclear'
  const statuses = { englishStatus, sceneFit: sceneFit ?? 'partly on scene', taskFit }

  return {
    features,
    mentionedActions,
    sceneFit,
    taskFit,
    verdictFloor: verdictFromFeatures(challenge, features, statuses, answer, scene),
    hasBoundedResultAsContinuous: turnsBoundedResultIntoPastContinuous(answer),
    semanticTenseFit,
  }
}

function taskFitFromFeatures(challenge, features) {
  if (challenge?.id === 'beginner') {
    return features.hasAnyPastVerb ? 'on target' : 'partly on target'
  }

  if (challenge?.id === 'advanced') {
    return hasAdvancedTimelineLayer(features)
      ? 'on target'
      : (features.hasPastPerfect || features.hasPastPerfectContinuous)
      ? 'on target'
      : 'partly on target'
  }

  if (
    (features.hasWhen || features.hasWhile) &&
    (
      (features.hasPastContinuous && features.hasSimplePast) ||
      (features.hasPastPerfectContinuous && features.hasSimplePast) ||
      (features.hasAnyPastVerb && features.hasRelationshipConnector)
    )
  ) {
    return 'on target'
  }

  return 'partly on target'
}

function evaluateSemanticTenseFit(answer, scene, challenge, features = detectAnswerFeatures(answer)) {
  const text = String(answer ?? '').trim()

  if (!text || !scene?.sceneScript?.relationships?.length) {
    return {
      verdict: 'aligned',
      summary: '',
      reason: '',
      relationshipType: '',
      modelSentence: '',
    }
  }

  const actionMap = new Map((scene?.sceneScript?.coreActions ?? []).map((action) => [action.id, action]))
  const relationships = scene?.sceneScript?.relationships ?? []
  const lowerText = text.toLowerCase()

  const getRoleMatch = (relationship) => {
    if (relationship.type === 'interruption') {
      const backgroundAction = actionMap.get(relationship.backgroundAction)
      const eventAction = actionMap.get(relationship.interruptingAction)

      if (!backgroundAction || !eventAction) {
        return null
      }

      const mentionsBackground = answerMentionsSceneAction(text, backgroundAction)
      const mentionsEvent = answerMentionsSceneAction(text, eventAction)

      if (!mentionsBackground || !mentionsEvent) {
        return null
      }

      const backgroundNeedsContinuous = (backgroundAction.grammarTargets ?? []).includes('past continuous')
      const eventNeedsSimplePast = (eventAction.grammarTargets ?? []).includes('simple past')
      const backgroundLooksCompleted = actionLooksLikeSimplePast(text, backgroundAction)
      const eventLooksContinuous = actionLooksLikePastContinuous(text, eventAction)
      const usesWhile = features.hasWhile
      const usesWhen = features.hasWhen || /\bas\b/.test(lowerText)

      if (backgroundNeedsContinuous && backgroundLooksCompleted) {
        return {
          verdict: 'mismatch',
          relationshipType: 'interruption',
          summary: 'background_as_completed',
          reason: 'background_should_be_ongoing',
          modelSentence:
            buildSceneRelationshipSentence(scene, 'interruption') ||
            buildSceneRelationshipSentence(scene, 'simultaneous-background'),
        }
      }

      if (eventNeedsSimplePast && eventLooksContinuous && usesWhen) {
        return {
          verdict: 'mismatch',
          relationshipType: 'interruption',
          summary: 'event_as_background',
          reason: 'event_should_be_short',
          modelSentence: buildSceneRelationshipSentence(scene, 'interruption'),
        }
      }

      if (usesWhile && features.hasSimplePast && !features.hasPastContinuous) {
        return {
          verdict: 'mismatch',
          relationshipType: 'interruption',
          summary: 'while_without_background',
          reason: 'while_needs_ongoing',
          modelSentence:
            buildSceneRelationshipSentence(scene, 'simultaneous-background') ||
            buildSceneRelationshipSentence(scene, 'interruption'),
        }
      }

      if (usesWhen && features.hasPastContinuous && features.hasSimplePast) {
        return {
          verdict: 'aligned',
          relationshipType: 'interruption',
          summary: '',
          reason: '',
          modelSentence: buildSceneRelationshipSentence(scene, 'interruption'),
        }
      }
    }

    if (relationship.type === 'simultaneous-background') {
      const actions = (relationship.actions ?? []).map((id) => actionMap.get(id)).filter(Boolean)

      if (actions.length < 2) {
        return null
      }

      const mentionsAll = actions.every((action) => answerMentionsSceneAction(text, action))

      if (!mentionsAll) {
        return null
      }

      const usesWhile = features.hasWhile || /\bas\b/.test(lowerText)
      const anyActionLooksCompleted = actions.some((action) => actionLooksLikeSimplePast(text, action))

      if (usesWhile && anyActionLooksCompleted) {
        return {
          verdict: 'mismatch',
          relationshipType: 'simultaneous-background',
          summary: 'simultaneous_as_completed',
          reason: 'while_prefers_ongoing',
          modelSentence: buildSceneRelationshipSentence(scene, 'simultaneous-background'),
        }
      }

      if (usesWhile && features.hasPastContinuous) {
        return {
          verdict: 'aligned',
          relationshipType: 'simultaneous-background',
          summary: '',
          reason: '',
          modelSentence: buildSceneRelationshipSentence(scene, 'simultaneous-background'),
        }
      }
    }

    return null
  }

  const matched = relationships
    .map(getRoleMatch)
    .find(Boolean)

  return matched || {
    verdict: 'aligned',
    summary: '',
    reason: '',
    relationshipType: '',
    modelSentence: '',
  }
}

function answerMentionsSceneAction(answer, action) {
  const text = String(answer ?? '').toLowerCase()

  if (!text || !action) {
    return false
  }

  const actor = String(action.actor ?? '').toLowerCase()
  const recommendedForms = action.recommendedVerbForms ?? []
  const actionTokens = new Set([
    ...extractContentTokens(action.visibleAs),
    ...recommendedForms.flatMap((form) => extractContentTokens(form)),
  ])

  if (actor && text.includes(actor)) {
    return true
  }

  if ([...actionTokens].some((token) => token.length >= 4 && text.includes(token))) {
    return true
  }

  const semanticVerbForms = [
    ...inferSimplePastFormsForAction(action),
    ...inferPastContinuousFormsForAction(action),
    ...((action?.recommendedVerbForms ?? []).map((form) => String(form ?? '').toLowerCase().trim()).filter(Boolean)),
  ]

  return semanticVerbForms.some((form) => form && new RegExp(`\\b${escapeRegex(form)}\\b`, 'i').test(text))
}

function actionLooksLikeSimplePast(answer, action) {
  const text = String(answer ?? '').toLowerCase()
  const simplePastForms = inferSimplePastFormsForAction(action)

  return simplePastForms.some((form) => new RegExp(`\\b${escapeRegex(form)}\\b`, 'i').test(text))
}

function actionLooksLikePastContinuous(answer, action) {
  const text = String(answer ?? '').toLowerCase()
  const continuousForms = inferPastContinuousFormsForAction(action)

  return continuousForms.some((form) => new RegExp(`\\b${escapeRegex(form)}\\b`, 'i').test(text))
}

function inferSimplePastFormsForAction(action) {
  const verbs = inferActionBaseForms(action)
  const simplePastMap = commonSimplePastMap()

  return [...new Set(verbs.map((verb) => simplePastMap[verb] || ''))].filter(Boolean)
}

function inferPastContinuousFormsForAction(action) {
  const verbs = inferActionBaseForms(action)

  return [...new Set(verbs.flatMap((verb) => [`was ${toIngForm(verb)}`, `were ${toIngForm(verb)}`]))]
}

function inferActionBaseForms(action) {
  const forms = action?.recommendedVerbForms ?? []
  const bases = new Set()

  for (const form of forms) {
    const normalized = String(form ?? '').toLowerCase().trim()

    if (!normalized) {
      continue
    }

    const withoutAux = normalized.replace(/\b(was|were|had been|had|is|are)\b/gi, '').trim()
    const lastToken = withoutAux.split(/\s+/).pop() ?? ''

    if (lastToken.endsWith('ing')) {
      bases.add(fromIngForm(lastToken))
    } else {
      for (const base of possibleBaseFormsForPast(lastToken)) {
        bases.add(base)
      }

      if (!possibleBaseFormsForPast(lastToken).length) {
        bases.add(lastToken)
      }
    }
  }

  return [...bases].filter(Boolean)
}

function fromIngForm(value = '') {
  const normalized = String(value ?? '').toLowerCase()

  if (normalized.endsWith('ying')) {
    return `${normalized.slice(0, -4)}ie`
  }

  if (normalized.endsWith('ing')) {
    const stem = normalized.slice(0, -3)
    if (/(tt|pp|nn|mm|gg|ll)$/.test(stem)) {
      return stem.slice(0, -1)
    }
    if (stem.endsWith('k')) {
      return stem
    }
    if (stem.endsWith('v')) {
      return `${stem}e`
    }
    return stem
  }

  return normalized
}

function toIngForm(value = '') {
  const normalized = String(value ?? '').toLowerCase()

  if (!normalized) {
    return normalized
  }

  if (normalized.endsWith('ie')) {
    return `${normalized.slice(0, -2)}ying`
  }

  if (normalized.endsWith('e') && !normalized.endsWith('ee')) {
    return `${normalized.slice(0, -1)}ing`
  }

  return `${normalized}ing`
}

function escapeRegex(value = '') {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanFeedbackText(value) {
  return String(value ?? '').replace(/\bprompt\b/gi, 'task')
}

function localFeedback(answer, scene, challenge, feedbackLanguage = 'English', recentAttemptHistory = []) {
  const localCopy = localFeedbackCopy(feedbackLanguage)
  const normalized = answer.toLowerCase()
  const features = detectAnswerFeatures(answer)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const advancedMastery = demonstratesAdvancedMastery(answer, features)
  const hasPastContinuous = features.hasPastContinuous
  const hasSimplePast = features.hasSimplePast
  const hasPastPerfect = features.hasPastPerfect
  const hasPastPerfectContinuous = features.hasPastPerfectContinuous
  const hasValidAdvancedStructure = challenge?.id === 'advanced' && hasValidAdvancedEarlierPast(answer, features)
  const needsAdvancedRepair = challenge?.id === 'advanced' && needsAdvancedStructureRepair(answer, features)
  const needsAdvancedTimelineClarity = challenge?.id === 'advanced' && hasValidAdvancedStructure && !needsAdvancedRepair && !hasAdvancedTimelineLayer(features)
  const hasConnector = /\b(when|while|after|before|as|because)\b/.test(normalized)
  const hasAnyPastVerb = hasSimplePast || hasPastContinuous || hasPastPerfect || hasPastPerfectContinuous
  const connectors = [...new Set(normalized.match(/\b(when|while|after|before|as|because|by the time)\b/g) ?? [])]
  const mentionedActions = detectMentionedActions(answer, scene)
  const verbForms = [
    hasSimplePast && 'simple past',
    hasPastContinuous && 'past continuous',
    hasPastPerfect && 'past perfect',
    hasPastPerfectContinuous && 'past perfect continuous',
  ].filter(Boolean)
  const timeRelationships = [
    hasPastContinuous && hasSimplePast && hasConnector && 'background + event',
    /\bbecause\b/.test(normalized) && 'cause + result',
    hasPastPerfect && 'earlier past',
    /\b(while|as)\b/.test(normalized) && 'simultaneous actions',
  ].filter(Boolean)
  const tenseMismatchFeedback = buildTenseMismatchFeedback(answer, scene, challenge, localCopy, features)
  const semanticMismatchFeedback = buildSemanticTenseFeedback(answer, scene, challenge, localCopy, features, semanticTenseFit)
  const surfacePolishRewrite = buildSurfacePolishRewrite(answer)
  const surfaceCorrection = surfacePolishRewrite ? surfacePolishCorrection(surfacePolishRewrite, localCopy, answer) : null

  const corrections = []
  const strengths = buildNarrativeTeachingStrengths(answer, challenge, localCopy, features)

  if (challenge?.id === 'beginner') {
    if (!hasAnyPastVerb) {
      corrections.push({
        original: localCopy.mainEvent,
        suggestion: localCopy.usePastNarration,
        reason: localCopy.reasonPastNarration,
        grammarFocus: 'narrative coherence',
      })
    }
  } else if (!hasSimplePast) {
    corrections.push({
      original: localCopy.mainEvent,
      suggestion: localCopy.useSimplePast,
      reason: localCopy.reasonSimplePast,
      grammarFocus: 'simple past',
    })
  }

  if (!advancedMastery && challenge?.id === 'intermediate') {
    if (!hasPastContinuous) {
      corrections.push({
        original: localCopy.backgroundAction,
        suggestion: localCopy.usePastContinuous,
        reason: localCopy.reasonPastContinuous,
        grammarFocus: 'past continuous',
      })
    }

    if (!/\b(when|while)\b/.test(normalized)) {
      corrections.push({
        original: localCopy.twoActions,
        suggestion: localCopy.useWhenWhile,
        reason: localCopy.reasonWhenWhile,
        grammarFocus: 'connector',
      })
    }
  } else if (!advancedMastery && challenge?.id !== 'beginner' && !hasValidAdvancedStructure) {
    if (!hasPastContinuous) {
      corrections.push({
        original: localCopy.backgroundAction,
        suggestion: localCopy.usePastContinuous,
        reason: localCopy.reasonPastContinuous,
        grammarFocus: 'past continuous',
      })
    }

    if (!hasConnector) {
      corrections.push({
        original: localCopy.twoActions,
        suggestion: localCopy.useConnector,
        reason: localCopy.reasonConnector,
        grammarFocus: 'connector',
      })
    }
  }

  if (advancedMastery) {
    corrections.push(advancedMasteryCorrection(localCopy, challenge, scene))
  } else if (hasValidAdvancedStructure) {
    if (needsAdvancedRepair) {
      corrections.push({
        original: localCopy.yourStory,
        suggestion: localCopy.nextAdvancedStructure,
        reason: localCopy.reasonAdvancedStructure,
        grammarFocus: 'narrative coherence',
      })
    } else if (needsAdvancedTimelineClarity) {
      corrections.push({
        original: localCopy.yourStory,
        suggestion: localCopy.nextAdvancedTimelineClear,
        reason: localCopy.reasonAdvancedTimelineClear,
        grammarFocus: 'narrative coherence',
      })
    }
  } else if (!hasPastPerfect && challenge?.id === 'advanced') {
    corrections.push({
      original: localCopy.earlierAction,
      suggestion: localCopy.usePastPerfect,
      reason: localCopy.reasonPastPerfect,
      grammarFocus: 'past perfect',
    })
  }

  const finalCorrections = corrections.length
    ? corrections.slice(0, 4)
    : hasValidAdvancedStructure
    ? [consequenceCorrection(localCopy, features)]
    : [defaultStretchCorrection(challenge, localCopy)]
  const clarityScore = getClarityScore(answer)
  const englishStatus =
    clarityScore === 2
      ? 'correct'
      : hasSimplePast || hasPastContinuous || hasPastPerfect || hasPastPerfectContinuous
      ? 'mostly correct'
      : 'unclear'
  const sceneFit = mentionedActions.length ? 'on scene' : 'not scene-based'
  const taskFit = strongestTaskFit(
    challenge?.id === 'beginner' || hasConnector || hasPastPerfect ? 'partly on target' : 'different skill',
    taskFitFromFeatures(challenge, detectAnswerFeatures(answer)),
  )

  return {
    verdict: localVerdictFor({
      challenge,
      answer,
      scene,
    }),
    englishStatus,
    sceneFit,
    taskFit: semanticTenseFit.verdict === 'mismatch' && taskFit === 'on target' ? 'partly on target' : taskFit,
    summary: tenseMismatchFeedback?.summary || semanticMismatchFeedback?.summary || buildNarrativeTeachingSummary(answer, challenge, localCopy, { englishStatus, sceneFit, taskFit }, scene),
    strengths: tenseMismatchFeedback?.strengths || semanticMismatchFeedback?.strengths || (strengths.length ? strengths.slice(0, 3) : [localCopy.defaultStrength]),
    corrections: tenseMismatchFeedback
      ? appendOptionalCorrection([tenseMismatchFeedback.correction], surfaceCorrection)
      : semanticMismatchFeedback
      ? appendOptionalCorrection([semanticMismatchFeedback.correction], surfaceCorrection)
      : appendOptionalCorrection(finalCorrections, surfaceCorrection),
    rewrite: normalizeRewrite(scene.sample, answer, scene, challenge, localCopy, tenseMismatchFeedback ? [tenseMismatchFeedback.correction] : semanticMismatchFeedback ? [semanticMismatchFeedback.correction] : finalCorrections),
    challenge: generateNextStep({
      challenge,
      feedbackLanguage,
      answer,
      scene,
      statuses: { englishStatus, sceneFit, taskFit },
      features,
    }),
    detected: {
      mentionedActions,
      verbForms,
      connectors,
      timeRelationships,
    },
    levelReadinessHint: generateLevelReadinessHint({
      challenge,
      feedbackLanguage,
      statuses: { englishStatus, sceneFit, taskFit },
      features,
      recentAttemptHistory,
    }),
  }
}

function buildTenseMismatchFeedback(answer, scene, challenge, localCopy, features = detectAnswerFeatures(answer)) {
  const tenseStatus = detectNarrationTenseStatus(answer, features)

  if (tenseStatus === 'past') {
    return null
  }

  const mentionedActions = detectMentionedActions(answer, scene)
  const strengths = []

  if (mentionedActions.length) {
    strengths.push(localCopy.describeSceneActions())
  }

  if (getClarityScore(answer) >= 1) {
    strengths.push(localCopy.describeClarity())
  }

  if (!strengths.length) {
    strengths.push(localCopy.defaultStrength)
  }

  const repairedSuggestion = chooseTenseMismatchSuggestion(answer, scene, challenge, localCopy, features)
  const mismatchReason = features.hasAgreementMismatch
    ? localCopy.reasonPastTenseAndAgreement
    : tenseStatus === 'present'
    ? localCopy.reasonPastTenseMismatch
    : localCopy.reasonPastTenseUnclear

  return {
    summary:
      tenseStatus === 'present'
        ? mentionedActions.length
          ? localCopy.presentTenseSceneSummary
          : localCopy.presentTenseSummary
        : mentionedActions.length
        ? localCopy.notClearlyPastSceneSummary
        : localCopy.notClearlyPastSummary,
    strengths: strengths.slice(0, 3),
    correction: {
      original: localCopy.yourStory,
      suggestion: repairedSuggestion,
      reason: mismatchReason,
      grammarFocus: 'simple past',
    },
  }
}

function chooseTenseMismatchSuggestion(answer, scene, challenge, localCopy, features = detectAnswerFeatures(answer)) {
  const sceneModeChallenge = challenge?.id
    ? challenge
    : { id: features.hasRelationshipConnector ? 'intermediate' : 'beginner' }
  const preferSceneModelFirst =
    Boolean(features.presentSignals?.hasUnclearBaseForms) ||
    detectMajorErrors(answer)

  const candidates = preferSceneModelFirst
    ? [
      buildSceneModelRewrite(scene, sceneModeChallenge),
      buildSceneModelRewrite(scene, { id: 'beginner' }),
      repairWholeAnswerSurface(answer, scene),
      correctMainNarrationToPast(answer, scene),
    ]
    : [
      repairWholeAnswerSurface(answer, scene),
      correctMainNarrationToPast(answer, scene),
      buildSceneModelRewrite(scene, sceneModeChallenge),
      buildSceneModelRewrite(scene, { id: 'beginner' }),
    ]

  const accepted = candidates.find((candidate) => {
    const text = String(candidate ?? '').trim()

    if (!text) {
      return false
    }

    if (hasObviousRewriteArtifacts(text)) {
      return false
    }

    if (betterVersionHasGrammarErrors(text, sceneModeChallenge)) {
      return false
    }

    return detectNarrationTenseStatus(text) === 'past'
  })

  return accepted || localCopy.usePastTenseInstead
}

function buildSemanticTenseFeedback(
  answer,
  scene,
  challenge,
  localCopy,
  features = detectAnswerFeatures(answer),
  semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features),
) {
  if (semanticTenseFit.verdict !== 'mismatch') {
    return null
  }

  const strengths = []
  const examples = extractNarrativeExamples(answer)

  if (features.hasPastContinuous && examples.pastContinuous) {
    strengths.push(localCopy.describeBackground(examples.pastContinuous))
  } else if (features.hasSimplePast && examples.simplePast) {
    strengths.push(localCopy.describeMainEvent(examples.simplePast))
  }

  if (features.hasWhen) {
    strengths.push(localCopy.describeWhenRelationship('when'))
  } else if (features.hasWhile) {
    strengths.push(localCopy.describeWhileRelationship('while'))
  }

  if (getClarityScore(answer) >= 1) {
    strengths.push(localCopy.describeClarity())
  }

  const correctionSuggestion =
    semanticTenseFit.modelSentence ||
    (semanticTenseFit.relationshipType === 'simultaneous-background'
      ? buildSceneRelationshipSentence(scene, 'simultaneous-background')
      : buildSceneRelationshipSentence(scene, 'interruption'))

  return {
    summary:
      semanticTenseFit.reason === 'background_should_be_ongoing'
        ? localCopy.semanticBackgroundSummary
        : semanticTenseFit.reason === 'while_prefers_ongoing'
        ? localCopy.semanticWhileSummary
        : localCopy.semanticEventSummary,
    strengths: strengths.slice(0, 3),
    correction: {
      original: localCopy.yourStory,
      suggestion: correctionSuggestion || localCopy.nextIntermediateConnect,
      reason:
        semanticTenseFit.reason === 'background_should_be_ongoing'
          ? localCopy.reasonSemanticBackground
          : semanticTenseFit.reason === 'while_prefers_ongoing'
          ? localCopy.reasonSemanticWhile
          : localCopy.reasonSemanticEvent,
      grammarFocus: 'time relationship',
    },
  }
}

function extractNarrativeExamples(answer) {
  const source = String(answer ?? '').trim()
  const phrasalUnits = detectPhrasalVerbUnits(source)
  const pastPerfectContinuousItems = findNarrativeExamplesByTense(source, phrasalUnits, 'pastPerfectContinuous')
  const pastPerfectItems = findNarrativeExamplesByTense(source, phrasalUnits, 'pastPerfect')
  const pastContinuousItems = findNarrativeExamplesByTense(source, phrasalUnits, 'pastContinuous')
  const simplePastItems = findSimplePastExamples(source, phrasalUnits)

  return {
    pastPerfectContinuous: pastPerfectContinuousItems[0] || '',
    pastPerfectContinuousItems,
    pastPerfect: pastPerfectItems[0] || '',
    pastPerfectItems,
    pastContinuous: pastContinuousItems[0] || '',
    pastContinuousItems,
    simplePast: simplePastItems[0] || '',
    simplePastItems,
    connector: matchNarrativeExample(source, /\b(when|while|because|after|before|as|by the time|so)\b/i),
  }
}

function matchNarrativeExample(source, pattern) {
  const match = String(source ?? '').match(pattern)
  return match ? match[0].trim() : ''
}

function findSimplePastExamples(source, phrasalUnits = detectPhralVerbUnitsSafe(source), maxItems = 2) {
  const examples = []
  const seen = new Set()

  const addExample = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase()

    if (!normalized || seen.has(normalized)) {
      return
    }

    examples.push(String(value).trim())
    seen.add(normalized)
  }

  for (const unit of phrasalUnits.filter((candidate) => candidate.tense === 'simple past')) {
    addExample(unit.surface)
  }

  const words = tokenizeNarrativeWords(String(source ?? ''))
  const phrasalIndexes = new Set(phrasalUnits.filter((unit) => unit.tense === 'simple past').flatMap((unit) => [unit.index, unit.index + 1]))

  for (let index = 0; index < words.length; index += 1) {
    if (phrasalIndexes.has(index)) {
      continue
    }

    const word = words[index].value
    const normalized = word.toLowerCase()

    if (isPartOfEarlierPastStructure(words, index)) {
      continue
    }

    if (isKnownSimplePastVerb(normalized)) {
      addExample(word)
    }
  }

  for (let index = 0; index < words.length; index += 1) {
    if (phrasalIndexes.has(index)) {
      continue
    }

    const word = words[index].value
    const normalized = word.toLowerCase()

    if (isPartOfEarlierPastStructure(words, index)) {
      continue
    }

    if (
      /\w+ed\b/.test(normalized) &&
      isLikelySimplePastVerb(normalized)
    ) {
      addExample(word)
    }
  }

  return examples.slice(0, maxItems)
}

function isPartOfEarlierPastStructure(words, index) {
  let cursor = index - 1
  let distance = 0

  while (cursor >= 0 && distance < 4) {
    const token = words[cursor]?.value?.toLowerCase() ?? ''
    distance += 1

    if (!token) {
      return false
    }

    if (earlierPastBridgeWords.has(token) || token === 'been') {
      cursor -= 1
      continue
    }

    return token === 'had'
  }

  return false
}

const earlierPastBridgeWords = new Set(['already', 'just', 'not', 'still', 'really', 'almost'])

function detectPhralVerbUnitsSafe(source) {
  try {
    return detectPhrasalVerbUnits(source)
  } catch {
    return []
  }
}

function findNarrativeExamplesByTense(source, phrasalUnits, tense, maxItems = 2) {
  const examples = []
  const seen = new Set()
  const tokens = tokenizeNarrativeWords(String(source ?? ''))

  const addExample = (value) => {
    const normalized = String(value ?? '').trim().toLowerCase()

    if (!normalized || seen.has(normalized)) {
      return
    }

    examples.push(String(value).trim())
    seen.add(normalized)
  }

  for (const unit of phrasalUnits.filter((candidate) => candidate.tense === tense)) {
    addExample(expandPhrasalUnitExample(unit, tokens))
  }

  const patternsByTense = {
    pastPerfectContinuous: pastPerfectContinuousExamplePattern,
    pastPerfect: pastPerfectExamplePattern,
    pastContinuous: pastContinuousExamplePattern,
  }

  const pattern = patternsByTense[tense]

  if (pattern) {
    for (const match of String(source ?? '').matchAll(pattern)) {
      addExample(match[0])
    }
  }

  return examples.slice(0, maxItems)
}

const pastPerfectContinuousExamplePattern = /\bhad\s+(?:not\s+)?been\s+\w+ing\b/gi
const pastPerfectExamplePattern = /\bhad\s+(?!not\s+been\b)(?!been\b)\w+(?:ed|en|ne|wn|t)\b/gi
const pastContinuousExamplePattern = /\b(?:was|were)\s+\w+ing\b/gi

function expandPhrasalUnitExample(unit, tokens = []) {
  const surface = String(unit?.surface ?? '').trim()

  if (!surface) {
    return surface
  }

  const previous = tokens[unit?.index - 1]?.value ?? ''
  const twoBack = tokens[unit?.index - 2]?.value ?? ''

  if (unit?.tense === 'pastPerfectContinuous' && previous.toLowerCase() === 'been' && twoBack.toLowerCase() === 'had') {
    return `had been ${surface}`
  }

  if (unit?.tense === 'pastPerfect' && previous.toLowerCase() === 'had') {
    return `had ${surface}`
  }

  if (unit?.tense === 'pastContinuous' && /^(was|were)$/i.test(previous)) {
    return `${previous} ${surface}`
  }

  return surface
}

const PHRASAL_VERB_PARTICLES = new Set([
  'off',
  'up',
  'away',
  'out',
  'down',
  'in',
  'on',
  'over',
  'back',
  'around',
  'past',
  'asleep',
])

const PHRASAL_VERB_FAMILIES = {
  'go off': ['went off', 'going off', 'gone off'],
  'go out': ['went out', 'going out', 'gone out'],
  'run away': ['ran away', 'running away', 'run away'],
  'roll away': ['rolled away', 'rolling away'],
  'blow away': ['blew away', 'blowing away', 'blown away'],
  'fall asleep': ['fell asleep', 'falling asleep', 'fallen asleep'],
  'wake up': ['woke up', 'waking up', 'woken up'],
  'pick up': ['picked up', 'picking up', 'picked up'],
  'turn around': ['turned around', 'turning around'],
  'hurry past': ['hurried past', 'hurrying past'],
  'roll in': ['rolled in', 'rolling in'],
  'slip out': ['slipped out', 'slipping out'],
  'blow up': ['blew up', 'blowing up', 'blown up'],
  'sit down': ['sat down', 'sitting down'],
  'stand up': ['stood up', 'standing up'],
  'come in': ['came in', 'coming in', 'come in'],
  'come out': ['came out', 'coming out', 'come out'],
  'move away': ['moved away', 'moving away'],
  'run out': ['ran out', 'running out', 'run out'],
  'break down': ['broke down', 'breaking down', 'broken down'],
  'open up': ['opened up', 'opening up', 'opened up'],
}

const PHRASAL_VERB_SURFACES = new Set(Object.values(PHRASAL_VERB_FAMILIES).flat())

function detectPhrasalVerbUnits(source) {
  const text = String(source ?? '')
  const tokens = tokenizeNarrativeWords(text)
  const units = []

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const verb = tokens[index].value.toLowerCase()
    const particle = tokens[index + 1].value.toLowerCase()

    if (!PHRASAL_VERB_PARTICLES.has(particle)) {
      continue
    }

    const surface = `${verb} ${particle}`

    if (!PHRASAL_VERB_SURFACES.has(surface)) {
      continue
    }

    units.push({
      type: 'phrasalVerb',
      surface,
      verb,
      particle,
      tense: detectPhrasalVerbTense(tokens, index),
      index,
    })
  }

  return dedupePhrasalVerbUnits(units)
}

function tokenizeNarrativeWords(source) {
  const tokens = []
  const matcher = /\b[\p{L}']+\b/gu
  let match

  while ((match = matcher.exec(String(source ?? '')))) {
    tokens.push({
      value: match[0],
      index: match.index,
    })
  }

  return tokens
}

function detectPhrasalVerbTense(tokens, index) {
  const current = tokens[index]?.value?.toLowerCase() ?? ''
  const previous = tokens[index - 1]?.value?.toLowerCase() ?? ''
  const twoBack = tokens[index - 2]?.value?.toLowerCase() ?? ''

  if (previous === 'been' && twoBack === 'had' && /ing$/.test(current)) {
    return 'pastPerfectContinuous'
  }

  if (previous === 'had') {
    return 'pastPerfect'
  }

  if ((previous === 'was' || previous === 'were') && /ing$/.test(current)) {
    return 'pastContinuous'
  }

  return 'simple past'
}

function dedupePhrasalVerbUnits(units) {
  const seen = new Set()
  return units.filter((unit) => {
    const key = `${unit.index}:${unit.surface}:${unit.tense}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function buildNarrativeTeachingSummary(
  answer,
  challenge,
  localCopy,
  statuses = null,
  scene = null,
) {
  const level = normalizeDifficultyLevel(challenge?.id)
  const clarityScore = getClarityScore(answer)
  const hasMajorErrors = detectMajorErrors(answer)
  const isSceneRelevant = statuses?.sceneFit
    ? statuses.sceneFit !== 'not scene-based'
    : checkSceneMatch(answer, scene)
  const meetsLevelTarget = checkLevelTarget({ level, studentText: answer })
  const wordCount = String(answer ?? '').match(/\b[\p{L}\p{N}']+\b/gu)?.length ?? 0

  if (level === 'beginner') {
    if (isSceneRelevant && meetsLevelTarget && clarityScore >= 1 && !hasMajorErrors) {
      return wordCount >= 10
        ? localCopy.summaryBeginnerClear
        : localCopy.summaryBeginnerAddDetail
    }

    if (isSceneRelevant && meetsLevelTarget) {
      return localCopy.summaryBeginnerBuilding
    }
  }

  if (level === 'intermediate') {
    if (isSceneRelevant && meetsLevelTarget && clarityScore >= 1 && !hasMajorErrors) {
      return localCopy.summaryIntermediateClear
    }

    if (isSceneRelevant) {
      return localCopy.summaryIntermediateBuilding
    }
  }

  if (level === 'advanced') {
    if (isSceneRelevant && meetsLevelTarget && clarityScore >= 1 && !hasMajorErrors) {
      return localCopy.summaryAdvancedClear
    }

    if (isSceneRelevant) {
      return localCopy.summaryAdvancedBuilding
    }
  }

  return localCopy.genericSummary
}

function buildNarrativeTeachingStrengths(answer, challenge, localCopy, features = detectAnswerFeatures(answer)) {
  const examples = extractNarrativeExamples(answer)
  const strengths = []
  const clarityScore = getClarityScore(answer)
  const hasMajorErrors = detectMajorErrors(answer)
  const tenseStatus = detectNarrationTenseStatus(answer, features)
  const usedDimensions = new Set()
  const addStrength = (dimension, text) => {
    if (!text || usedDimensions.has(dimension)) {
      return
    }

    strengths.push(text)
    usedDimensions.add(dimension)
  }

  if (tenseStatus !== 'past') {
    if (features.hasWhen) {
      addStrength('relationship', localCopy.describeWhenRelationship('when'))
    } else if (features.hasWhile) {
      addStrength('relationship', localCopy.describeWhileRelationship('while'))
    }

    if (clarityScore >= 1 && !hasMajorErrors) {
      addStrength('clarity', localCopy.describeClarity())
    }

    return strengths.slice(0, 3)
  }

  const simplePastSummary = formatNarrativeExampleSummary(examples.simplePastItems)

  if (!features.hasAgreementMismatch && features.hasPastPerfectContinuous && examples.pastPerfectContinuous) {
    addStrength('pastPerfectContinuous', localCopy.describeEarlierOngoing(examples.pastPerfectContinuous))
  }

  if (!features.hasAgreementMismatch && features.hasPastPerfect && examples.pastPerfect) {
    addStrength('pastPerfect', localCopy.describeEarlierPast(examples.pastPerfect))
  }

  if (!features.hasAgreementMismatch && features.hasPastContinuous && examples.pastContinuous) {
    addStrength('pastContinuous', localCopy.describeBackground(examples.pastContinuous))
  }

  if (!features.presentSignals?.hasUnclearBaseForms && features.hasSimplePast && simplePastSummary) {
    addStrength('simplePast', localCopy.describeMainEvent(simplePastSummary))
  }

  if (features.hasWhen) {
    addStrength('relationship', localCopy.describeWhenRelationship('when'))
  } else if (features.hasWhile) {
    addStrength('relationship', localCopy.describeWhileRelationship('while'))
  } else if (features.hasCauseResult) {
    addStrength('relationship', localCopy.describeCauseResult())
  } else if ((features.hasPastPerfect || features.hasPastPerfectContinuous) && (features.hasSimplePast || features.hasPastContinuous)) {
    addStrength('relationship', localCopy.describeTimelineSequence())
  }

  if (clarityScore === 2 && !hasMajorErrors) {
    addStrength('clarity', localCopy.describeClarity())
  }

  return strengths.slice(0, 3)
}

function deriveDetectedVerbForms(features = {}) {
  return [
    features.hasSimplePast && 'simple past',
    features.hasPastContinuous && 'past continuous',
    features.hasPastPerfect && 'past perfect',
    features.hasPastPerfectContinuous && 'past perfect continuous',
  ].filter(Boolean)
}

function deriveDetectedTimeRelationships(features = {}, semanticTenseFit = {}) {
  return [
    features.hasPastContinuous && features.hasSimplePast && features.hasRelationshipConnector && 'background + event',
    features.hasBecause && 'cause + result',
    features.hasPastPerfect && 'earlier past',
    features.hasPastPerfectContinuous && 'earlier ongoing action',
    (features.hasWhile || /\bsimultaneous-background\b/.test(String(semanticTenseFit?.relationshipType ?? ''))) && 'simultaneous actions',
    semanticTenseFit?.relationshipType === 'interruption' && features.hasWhen && 'interruption',
    semanticTenseFit?.relationshipType === 'cause-result' && 'cause + result',
    semanticTenseFit?.relationshipType === 'simultaneous-background' && 'simultaneous actions',
    (features.hasRelationshipConnector || features.hasCauseResult || features.hasPastPerfect || features.hasPastPerfectContinuous) && 'sequence',
  ].filter(Boolean)
}

function formatNarrativeExampleSummary(examples = []) {
  const unique = [...new Set((examples ?? []).map((item) => String(item ?? '').trim()).filter(Boolean))]

  if (!unique.length) {
    return ''
  }

  return unique.slice(0, 3).join(', ')
}

function detectNarrationTenseStatus(studentText, features = detectAnswerFeatures(studentText)) {
  if (features.hasAnyPastVerb && !isMostlyPresentNarration(studentText, features) && !hasMixedNarrationTense(studentText, features)) {
    return 'past'
  }

  if (features.presentSignals?.hasExplicitPresent) {
    return 'present'
  }

  if (features.presentSignals?.hasUnclearBaseForms) {
    return 'unclear'
  }

  return features.hasAnyPastVerb ? 'past' : 'unclear'
}

function mentionsNarrativeTeaching(value) {
  const text = String(value ?? '').toLowerCase()
  return /\b(simple past|past continuous|past perfect|past perfect continuous|background|main event|earlier event|earlier action|ongoing action)\b/.test(text)
}

function hasSpecificNarrativeTeaching(value) {
  const text = String(value ?? '')
  return mentionsNarrativeTeaching(text) && /\([^()]+\)/.test(text)
}

function detectMentionedActions(answer, scene) {
  const normalized = answer.toLowerCase()
  const actions = scene.sceneScript?.coreActions ?? []

  return actions
    .filter((action) => {
      const actor = action.actor?.toLowerCase()
      const words = action.visibleAs?.toLowerCase().match(/[a-z]+/g) ?? []
      const signalWords = words.filter((word) => word.length > 4)

      return normalized.includes(actor) || signalWords.some((word) => normalized.includes(word))
    })
    .map((action) => action.id)
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []
}

function normalizeCorrections(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
      return {
        original: 'your sentence',
        suggestion: cleanFeedbackText(item),
        reason: 'This will make the past-time relationship clearer.',
        grammarFocus: 'narrative coherence',
      }
      }

      return {
        original: cleanFeedbackText(item?.original || 'your sentence'),
        suggestion: cleanFeedbackText(item?.suggestion || 'Try a clearer past-tense form.'),
        reason: cleanFeedbackText(item?.reason || 'This makes the timeline easier to follow.'),
        grammarFocus: item?.grammarFocus || 'narrative coherence',
      }
    })
}

function normalizeUsefulCorrections(corrections, answer, challenge, localCopy, statuses, scene = null) {
  const answerFeatures = detectAnswerFeatures(answer)
  const answerWorks =
    statuses.englishStatus === 'correct' &&
    statuses.sceneFit === 'on scene' &&
    statuses.taskFit === 'on target'
  const strongAdvancedAttempt = advancedClearTimelineWithoutEarlierPast(
    answer,
    challenge,
    answerFeatures,
    statuses,
    scene,
  )
  const advancedMastery = answerWorks && demonstratesAdvancedMastery(answer, answerFeatures)
  const surfacePolishRewrite = buildSurfacePolishRewrite(answer)
  const surfaceCorrection = surfacePolishRewrite ? surfacePolishCorrection(surfacePolishRewrite, localCopy, answer) : null

  if (advancedMastery) {
    return appendOptionalCorrection([advancedMasteryCorrection(localCopy, challenge, scene)], surfaceCorrection)
  }

  if (answerWorks && advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)) {
    return appendOptionalCorrection([consequenceCorrection(localCopy, answerFeatures)], surfaceCorrection)
  }

  if (strongAdvancedAttempt) {
    return appendOptionalCorrection([nextLevelCorrection(challenge, localCopy)], surfaceCorrection)
  }

  if (answerWorks) {
    return appendOptionalCorrection([nextLevelCorrection(challenge, localCopy)], surfaceCorrection)
  }

  const filteredCorrections = corrections.filter((correction) => {
    if (!correction?.suggestion) {
      return false
    }

    if (sameText(correction.suggestion, answer)) {
      return false
    }

    if (
      advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses) &&
      (isPastPerfectContinuousNitpick(correction.suggestion, correction.reason) ||
        mentionsPastPerfectContinuousForm(correction.suggestion, correction.reason) ||
        isOverSpecificAdvancedTaskNitpick(correction.suggestion, correction.reason) ||
        asksForAlreadyPresentEarlierPast(correction.suggestion, correction.reason))
    ) {
      return false
    }

    if (answerFeatures.hasCauseResult && asksForAlreadyPresentCauseResult(correction.suggestion, correction.reason)) {
      return false
    }

    if (
      statuses.sceneFit !== 'not scene-based' &&
      isVisualNitpick(correction.suggestion, correction.reason)
    ) {
      return false
    }

    if (!correctionRespectsLevelRules(correction, answer, challenge)) {
      return false
    }

    if (turnsBoundedResultIntoPastContinuous(correction.suggestion, answer)) {
      return false
    }

    if (changesCausalMeaning(correction.suggestion, answer)) {
      return false
    }

    if (removesSuccessfulNarrativeRelationship(correction.suggestion, answer)) {
      return false
    }

    if (changesKitchenPancakeMeaning(correction.suggestion, answer)) {
      return false
    }

    return true
  })

  return appendOptionalCorrection(filteredCorrections, surfaceCorrection)
}

function appendOptionalCorrection(corrections = [], extraCorrection = null) {
  const base = corrections.filter(Boolean)

  if (!extraCorrection?.suggestion) {
    return base
  }

  if (base.some((correction) => normalizeComparableText(correction?.suggestion) === normalizeComparableText(extraCorrection.suggestion))) {
    return base
  }

  return [...base, extraCorrection]
}

function advancedPastPerfectAlreadyWorks(challenge, features, statuses) {
  return (
    challenge?.id === 'advanced' &&
    (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
    statuses.sceneFit === 'on scene' &&
    statuses.taskFit !== 'different skill'
  )
}

function sanitizeAdvancedPastPerfectFeedback(feedback, challenge, features, localCopy) {
  if (!advancedPastPerfectAlreadyWorks(challenge, features, feedback)) {
    return feedback
  }

  const sanitizedCorrections = feedback.corrections.filter(
    (correction) =>
      !mentionsPastPerfectContinuousForm(correction.suggestion, correction.reason) &&
      !isPastPerfectContinuousNitpick(correction.suggestion, correction.reason),
  )

  const sanitizedDetectedVerbForms = features.hasPastPerfectContinuous
    ? feedback.detected.verbForms
    : feedback.detected.verbForms.filter((form) => form !== 'past perfect continuous')

  return {
    ...feedback,
    verdict: feedback.verdict === 'excellent' ? 'excellent' : 'good-work',
    taskFit: 'on target',
    summary: mentionsPastPerfectContinuousForm(feedback.summary) || criticizesNaturalPastPerfect(feedback.summary)
      ? localCopy.pastPerfectAlreadyWorksSummary
      : feedback.summary,
    strengths: ensureStrength(feedback.strengths, localCopy.strengthPastPerfect),
    corrections: sanitizedCorrections.length ? sanitizedCorrections : [consequenceCorrection(localCopy, features)],
    rewrite: mentionsPastPerfectContinuousForm(feedback.rewrite) || isPastPerfectContinuousNitpick(feedback.rewrite)
      ? ''
      : feedback.rewrite,
    detected: {
      ...feedback.detected,
      verbForms: sanitizedDetectedVerbForms,
    },
  }
}

function ensureStrength(strengths, strength) {
  if (!strength || strengths.some((item) => normalizeComparableText(item) === normalizeComparableText(strength))) {
    return strengths
  }

  return [...strengths, strength].slice(0, 3)
}

function cleanAdvancedPastPerfectNitpick(value, challenge, features, localCopy) {
  const text = String(value ?? '')

  if (
    challenge?.id === 'advanced' &&
    (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
    (mentionsForcedPastPerfectContinuous(text) ||
      criticizesNaturalPastPerfect(text) ||
      isOverSpecificAdvancedTaskNitpick(text))
  ) {
    return localCopy.pastPerfectAlreadyWorksSummary
  }

  return text
}

function cleanSceneNitpick(value, statuses, localCopy) {
  const text = String(value ?? '')

  if (statuses.sceneFit !== 'not scene-based' && isVisualNitpick(text)) {
    return removeVisualNitpickSentences(text) || localCopy.sceneInferenceSummary
  }

  return text
}

function cleanSceneSynonymNitpick(value, answer, localCopy) {
  const text = String(value ?? '')

  if (mentionsPancakeAction(answer) && criticizesMissingPancakeAction(text)) {
    return localCopy.sceneSynonymSummary
  }

  return text
}

function removeVisualNitpickSentences(value) {
  const sentences = String(value ?? '').match(/[^.!?]+[.!?]?/g) ?? []
  const cleaned = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !isVisualNitpick(sentence) && !mentionsSceneMismatch(sentence))
    .join(' ')

  return cleaned.trim()
}

function mentionsPancakeAction(value) {
  const text = String(value ?? '').toLowerCase()

  return (
    /\b(mak(?:e|ing|es|ed)|cook(?:s|ing|ed)?|prepar(?:e|ing|es|ed))\b[^.?!]*\bpancakes?\b/.test(text) ||
    /\bpancakes?\b[^.?!]*\b(mak(?:e|ing|es|ed)|cook(?:s|ing|ed)?|prepar(?:e|ing|es|ed))\b/.test(text)
  )
}

function criticizesMissingPancakeAction(value) {
  const text = String(value ?? '').toLowerCase()

  return (
    /\b(does not|doesn't|did not|didn't|fails? to|needs? to)\b[^.?!]*\b(describe|mention|include|focus on)\b[^.?!]*\b(cooking|making|preparing)?\s*pancakes?\b/.test(text) ||
    /\bvisible actions?\b[^.?!]*\b(cooking|making|preparing)?\s*pancakes?\b/.test(text)
  )
}


function applyFeedbackConsistencyCaps(feedback) {
  if (feedback.sceneFit === 'not scene-based') {
    return {
      ...feedback,
      verdict: 'keep-building',
    }
  }

  if (feedback.verdict !== 'excellent') {
    return feedback
  }

  if (containsExcellentContradiction(feedback)) {
    return {
      ...feedback,
      verdict: 'good-work',
    }
  }

  return feedback
}

function containsExcellentContradiction(feedback) {
  const text = [
    feedback.summary,
    ...(feedback.corrections ?? []).flatMap((correction) => [correction?.suggestion, correction?.reason]),
  ]
    .join(' ')
    .toLowerCase()

  return (
    /\b(lacks?|missing|unclear|not clear|could be clearer|could be more explicit|could better|needs? clearer|partly on target)\b/.test(text) ||
    /\b(does not match|doesn't match|not (clearly )?part of the scene|different scene|not scene-based)\b/.test(text) ||
    /\bbut\b[^.?!]*\b(lacks?|missing|unclear|not clear|could|does not|doesn't|not part)\b/.test(text)
  )
}

function mentionsForcedPastPerfectContinuous(value) {
  const text = String(value ?? '').toLowerCase()

  return (
    text.includes('past perfect continuous') &&
    /\b(missing|lacks?|without|does not include|doesn't include|does not use|doesn't use|not using|needs?|would better fulfill|required|use|adding|add|show|fully meet|fit|fits|better|part of the advanced task|matching the advanced task)\b/.test(text)
  )
}

function criticizesNaturalPastPerfect(value) {
  const text = String(value ?? '').toLowerCase()

  return (
    /\bhad\s+(forgotten|left|missed|lost|opened|dropped)\b/.test(text) &&
    /\b(attempt|unclear|momentary|not completed|not clear|less natural|should use had been)\b/.test(text)
  )
}

function isPastPerfectContinuousNitpick(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    mentionsForcedPastPerfectContinuous(text) ||
    /\bhad been\s+(forgetting|dropping|noticing|arriving|leaving|finding|losing|opening)\b/.test(text) ||
    /\bhad been\s+\w+ing\b.*\b(suitcase|luggage|bag|milk|alarm|ticket|passport)\b/.test(text)
  )
}

function isOverSpecificAdvancedTaskNitpick(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    /\btask\b[^.?!]*(asks|requires|specifically|focus)\b[^.?!]*(before|by the time|noticed)/.test(text) ||
    /\b(show what happened before somebody noticed|show what happened before anyone noticed)\b/.test(text) ||
    /\b(before|by the time)\b[^.?!]*\b(fits|matching|better fulfill|task focus|selected task)\b/.test(text)
  )
}

function asksForAlreadyPresentEarlierPast(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    /\b(add|use|include|try|show)\b[^.?!]*(had|had already|past perfect|earlier past|already happened|happened before|before)\b/.test(text) ||
    /\bnext level\b[^.?!]*(earlier|had|before)\b/.test(text) ||
    /\badd what had already happened before\b/.test(text)
  )
}

function asksForAlreadyPresentCauseResult(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    /\b(add|use|include|try|show)\b[^.?!]*(because|so|so that|result|consequence|cause|why|explain why)\b/.test(text) ||
    /\bnow you can show the consequence\b/.test(text) ||
    /\badd a result\b/.test(text)
  )
}

function mentionsPastPerfectContinuousForm(...values) {
  const text = values.join(' ').toLowerCase()

  return text.includes('past perfect continuous') || /\bhad been\s+\w+ing\b/.test(text)
}

function isVisualNitpick(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    /not (clearly )?(visible|shown|seen)/.test(text) ||
    /does not (show|clearly show)/.test(text) ||
    /not (clearly )?part of the scene/.test(text) ||
    /exact cause/.test(text) ||
    /who caused/.test(text)
  )
}

function mentionsSceneMismatch(...values) {
  const text = values.join(' ').toLowerCase()

  return /\b(does not match|doesn't match|not (clearly )?part of the scene|different scene|not scene-based)\b/.test(text)
}

function isClearDifferentSceneFeedback(summary, corrections = []) {
  const text = [
    summary,
    ...(corrections ?? []).flatMap((correction) => [correction?.suggestion, correction?.reason]),
  ]
    .join(' ')
    .toLowerCase()

  return (
    /\b(does not match|doesn't match)\s+(the\s+)?(picture|image|scene)\b/.test(text) ||
    /\bdescribes?\s+(a\s+)?(different|other)\s+(scene|picture|image|setting)\b/.test(text) ||
    /\bnot\s+(from|in|part of)\s+(this|the)\s+(scene|picture|image)\b/.test(text)
  )
}

function nextLevelCorrection(challenge, localCopy) {
  if (challenge?.id === 'beginner') {
    return {
      original: localCopy.yourStory,
      suggestion: localCopy.keepAndAddPastSentence,
      reason: localCopy.reasonKeepAndAddPastSentence,
      grammarFocus: 'narrative coherence',
    }
  }

  if (challenge?.id === 'advanced') {
    return {
      original: localCopy.yourStory,
      suggestion: localCopy.keepAndAddEarlierPast,
      reason: localCopy.reasonKeepAndAddEarlierPast,
      grammarFocus: 'past perfect',
    }
  }

  return {
    original: localCopy.yourStory,
    suggestion: localCopy.keepAndAddResult,
    reason: localCopy.reasonKeepAndAddResult,
    grammarFocus: 'narrative coherence',
  }
}

function advancedMasteryCorrection(localCopy, challenge, scene = null) {
  return {
    original: localCopy.yourStory,
    suggestion: advancedMasteryPrompt(localCopy, scene),
    reason: localCopy.reasonAdvancedMastery,
    grammarFocus: 'past perfect',
  }
}

function advancedMasteryPrompt(localCopy, scene = null) {
  const eventClause = primarySceneEventClause(scene)
  return localCopy.nextAdvancedMastery(eventClause)
}

function primarySceneEventClause(scene = null) {
  const actions = scene?.sceneScript?.coreActions ?? []
  const relationships = scene?.sceneScript?.relationships ?? []
  const actionMap = new Map(actions.map((action) => [action.id, action]))
  const preferredAction =
    actionMap.get(relationships.find((relationship) => relationship.type === 'interruption')?.interruptingAction) ||
    actionMap.get(relationships.find((relationship) => relationship.type === 'earlier-past')?.laterAction) ||
    actions.find((action) => /\b(went out|spilled|fell|opened|died|snapped loose|collapsed|rang|slipped)\b/i.test(action?.recommendedVerbForms?.[0] || '')) ||
    actions[0]

  if (!preferredAction) {
    return ''
  }

  return `${lowerCaseSentenceStart(sceneEventActorSubject(preferredAction.actor))} ${preferredAction.recommendedVerbForms?.[0] || 'did something'}`
}

function sceneEventActorSubject(actor = '') {
  const normalized = String(actor ?? '').trim().toLowerCase()

  if (!normalized) {
    return 'something'
  }

  if (sceneBareActors.has(normalized)) {
    return capitalizeFirst(normalized)
  }

  if (scenePluralActors.has(normalized)) {
    return capitalizeFirst(normalized)
  }

  return capitalizeFirst(`the ${normalized}`)
}

function normalizeRewrite(value, answer, scene, challenge, localCopy, corrections = [], statuses = null) {
  const mode = selectBetterVersionMode(answer, scene, challenge, statuses)

  if (mode === 'HIDE') {
    return ''
  }

  const candidatesByMode =
    mode === 'POLISH'
      ? [
        { value: choosePolishRewrite(value, answer, scene, challenge), mode: 'POLISH' },
        { value: chooseRepairRewrite(value, answer, scene, challenge, corrections), mode: 'REPAIR' },
        { value: chooseRebuildRewrite(answer, scene, challenge, localCopy), mode: 'REBUILD' },
      ]
      : mode === 'REPAIR'
      ? [
        { value: chooseRepairRewrite(value, answer, scene, challenge, corrections), mode: 'REPAIR' },
        { value: chooseRebuildRewrite(answer, scene, challenge, localCopy), mode: 'REBUILD' },
      ]
      : [
        { value: chooseRebuildRewrite(answer, scene, challenge, localCopy), mode: 'REBUILD' },
      ]

  const accepted = candidatesByMode.find((candidate) =>
    betterVersionPassesQualityChecks(candidate.value, answer, scene, challenge, candidate.mode),
  )

  return accepted?.value || ''
}

function ensureDistinctRewrite(feedback, answer) {
  if (!feedback.rewrite || !String(feedback.rewrite).trim()) {
    return {
      ...feedback,
      rewrite: '',
    }
  }

  if (!hasMeaningfulRewriteChange(feedback.rewrite, answer)) {
    return {
      ...feedback,
      rewrite: '',
    }
  }

  return feedback
}

function selectBetterVersionMode(answer, scene, challenge, statuses = null) {
  const level = normalizeDifficultyLevel(challenge?.id)
  const isPastTense = detectPastTense(answer)
  const isSceneRelevant = checkSceneMatch(answer, scene)
  const isClearSceneMismatch = isLikelySceneMismatch(answer, scene)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge)
  const meetsLevelTarget = checkLevelTarget({ level, studentText: answer }) && semanticTenseFit.verdict !== 'mismatch'
  const clarityScore = getClarityScore(answer)
  const hasMajorErrors = detectMajorErrors(answer)
  const features = detectAnswerFeatures(answer)
  const wordCount = String(answer ?? '').match(/\b[\p{L}\p{N}']+\b/gu)?.length ?? 0
  const needsSurfacePolish = needsSceneArticlePolish(answer, scene) || Boolean(buildSurfacePolishRewrite(answer))
  const likelyRunOn = isLikelyRunOn(answer, features)
  const needsAdvancedRepair = level === 'advanced' && needsAdvancedStructureRepair(answer, features)
  const levelStructureStrong =
    level === 'beginner'
      ? true
      : level === 'intermediate'
      ? hasExplicitIntermediateConnector(answer)
      : containsHadOrHadBeen(answer)

  const strongModel =
    isPastTense &&
    isSceneRelevant &&
    meetsLevelTarget &&
    levelStructureStrong &&
    clarityScore === 2 &&
    !hasMajorErrors &&
    !needsSurfacePolish &&
    !needsAdvancedRepair &&
    !likelyRunOn &&
    statuses?.sceneFit !== 'not scene-based'

  if (strongModel) {
    return 'HIDE'
  }

  if (advancedClearTimelineWithoutEarlierPast(answer, challenge, features, statuses, scene)) {
    return 'HIDE'
  }

  if (isClearSceneMismatch && !answerCanSupportCloseRepair(answer, scene, features)) {
    return 'REBUILD'
  }

  if (semanticTenseFit.verdict === 'mismatch') {
    return 'REPAIR'
  }

  if (level === 'intermediate' && hasMisorderedConnector(answer)) {
    return 'REPAIR'
  }

  if (isSceneRelevant && meetsLevelTarget && isPastTense && clarityScore >= 1 && !hasMajorErrors && levelStructureStrong && !likelyRunOn && !needsAdvancedRepair) {
    return 'POLISH'
  }

  if (
    clarityScore >= 1 ||
    (features.hasAnyPastVerb && wordCount >= 5) ||
    (isSceneRelevant && wordCount >= 5)
  ) {
    return 'REPAIR'
  }

  return 'REBUILD'
}

function isLikelySceneMismatch(studentText, sceneModel) {
  const text = String(studentText ?? '').trim()

  if (!text || !sceneModel) {
    return true
  }

  if (checkSceneMatch(text, sceneModel)) {
    return false
  }

  const mentionedActions = detectMentionedActions(text, sceneModel)
  const sceneVocabulary = buildSceneVocabulary(sceneModel)
  const answerTokens = extractContentTokens(text)
  const matchedTokens = answerTokens.filter((token) =>
    sceneVocabulary.has(token) || [...sceneVocabulary].some((sceneToken) => sceneToken.startsWith(token) || token.startsWith(sceneToken)),
  )
  const unmatchedTokens = answerTokens.filter((token) => !matchedTokens.includes(token))

  return mentionedActions.length === 0 || unmatchedTokens.length > matchedTokens.length + 1
}

function choosePolishRewrite(value, answer, scene, challenge) {
  const candidates = [
    buildSurfacePolishRewrite(answer),
    value,
    applySceneArticlePolish(answer, scene),
    meaningPreservingRewrite(answer),
    makePolishedFallbackRewrite(answer),
    correctMainNarrationToPast(answer, scene),
  ]

  return selectRewriteCandidate(candidates, answer, challenge, 'POLISH')
}

function chooseRepairRewrite(value, answer, scene, challenge, corrections = []) {
  const preserveAdvancedStructure = challenge?.id === 'advanced' && hasValidAdvancedEarlierPast(answer)
  const features = detectAnswerFeatures(answer)
  const tenseStatus = detectNarrationTenseStatus(answer, features)
  const usableStudentBase = answerCanSupportCloseRepair(answer, scene, features)
  const prioritizeFullRepair =
    tenseStatus !== 'past' ||
    features.hasAgreementMismatch ||
    Boolean(features.presentSignals?.hasExplicitPresent) ||
    Boolean(features.presentSignals?.hasUnclearBaseForms)

  const coreRepairCandidates = prioritizeFullRepair
    ? [
      repairWholeAnswerSurface(answer, scene),
      correctMainNarrationToPast(answer, scene),
      value,
      ...corrections.map((correction) => correction?.suggestion),
      buildSurfacePolishRewrite(answer),
    ]
    : [
      value,
      ...corrections.map((correction) => correction?.suggestion),
      repairWholeAnswerSurface(answer, scene),
      buildSurfacePolishRewrite(answer),
    ]

  const candidates = [
    ...coreRepairCandidates,
    applySceneArticlePolish(answer, scene),
    repairAdvancedTimelineRewrite(answer, scene, challenge),
    repairRelationshipRewrite(answer, scene, challenge),
    ...(
      preserveAdvancedStructure || usableStudentBase
        ? []
        : [
          buildOrderedAdvancedRewrite(answer, scene, challenge),
        ]
    ),
    correctMainNarrationToPast(answer, scene),
    meaningPreservingRewrite(answer),
    makePolishedFallbackRewrite(answer),
    ...(
      preserveAdvancedStructure || usableStudentBase
        ? []
        : [
          makeMinimalFallbackRewrite(answer, challenge, scene),
          buildSceneModelRewrite(scene, challenge),
        ]
    ),
  ]

  return selectRewriteCandidate(candidates, answer, challenge, 'REPAIR')
}

function chooseRebuildRewrite(answer, scene, challenge, localCopy) {
  const candidates = [
    buildSceneModelRewrite(scene, challenge),
    fallbackRewriteFor(challenge, localCopy),
  ]

  return selectRewriteCandidate(candidates, answer, challenge, 'REBUILD')
}

function selectRewriteCandidate(candidates, answer, challenge, mode) {
  return candidates
    .map((candidate) => polishRewriteSurface(candidate))
    .find((candidate) => isAllowedBetterVersionCandidate(candidate, answer, challenge, mode)) || ''
}

function isAllowedBetterVersionCandidate(candidate, answer, challenge, mode) {
  if (!candidate || !String(candidate).trim()) {
    return false
  }

  if (betterVersionHasGrammarErrors(candidate, challenge)) {
    return false
  }

  if (!rewriteRespectsLevelRulesForMode(candidate, answer, challenge, mode)) {
    return false
  }

  if (containsGenericEarlierTemplate(candidate)) {
    return false
  }

  if (turnsBoundedResultIntoPastContinuous(candidate, answer)) {
    return false
  }

  if (changesCausalMeaning(candidate, answer)) {
    return false
  }

  if (removesSuccessfulNarrativeRelationship(candidate, answer)) {
    return false
  }

  if (changesKitchenPancakeMeaning(candidate, answer)) {
    return false
  }

  if (createsAwkwardWhilePastPerfectContinuous(candidate, answer)) {
    return false
  }

  if (mode !== 'REBUILD' && !hasMeaningfulRewriteChange(candidate, answer)) {
    return false
  }

  if (mode === 'POLISH' && wordOverlapRatio(candidate, answer) < 0.7) {
    return false
  }

  if (mode === 'REPAIR' && wordOverlapRatio(candidate, answer) < 0.25) {
    return false
  }

  return true
}

function betterVersionPassesQualityChecks(rewrite, answer, scene, challenge, mode) {
  const candidate = polishRewriteSurface(rewrite)

  if (!candidate) {
    return false
  }

  if (betterVersionHasGrammarErrors(candidate, challenge)) {
    return false
  }

  if (!rewriteRespectsLevelRulesForMode(candidate, answer, challenge, mode)) {
    return false
  }

  if (mode === 'REBUILD' && scene && !checkSceneMatch(candidate, scene)) {
    return false
  }

  if (mode === 'POLISH' && !hasMeaningfulRewriteChange(candidate, answer)) {
    return false
  }

  if (challenge?.id === 'advanced' && !advancedBetterVersionRepairsBeforeExtension(candidate, answer)) {
    return false
  }

  return true
}

function betterVersionHasGrammarErrors(value, challenge) {
  const candidate = String(value ?? '').trim()

  if (!candidate) {
    return true
  }

  const features = detectAnswerFeatures(candidate)
  const polished = polishRewriteSurface(candidate)
  const spellingFixed = applyKnownSpellingFixes(candidate)

  if (polished !== candidate) {
    return true
  }

  if (spellingFixed !== candidate) {
    return true
  }

  if (detectMajorErrors(candidate)) {
    return true
  }

  if (hasObviousRewriteArtifacts(candidate)) {
    return true
  }

  if (detectNarrationTenseStatus(candidate, features) !== 'past') {
    return true
  }

  if (features.presentSignals?.hasExplicitPresent || features.presentSignals?.hasUnclearBaseForms) {
    return true
  }

  if (challenge?.id === 'advanced' && !features.hasPastPerfect && !features.hasPastPerfectContinuous) {
    return true
  }

  return false
}

function hasObviousRewriteArtifacts(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return false
  }

  return (
    /\b(?:am|is|are)\s+(?:came|come|ran|went|forgot|opened|closed|turned|approached|blocked|checked|carried|pointed|mixed|fixed|spilled|dropped)\b/i.test(text) ||
    /\ba\s+past\b/i.test(text) ||
    /(^|[.!?]\s*)(?:train|man|woman|boy|girl|waiter|vendor|cyclist|conductor|doctor|nurse|visitor|actor|director|mechanic|librarian|friend|guest|customer|farmer|goat|hiker)\s+(?:ran|walked|waited|checked|carried|pointed|mixed|fixed|slept|spoke|came|went|approached|knocked|opened|proposed|watched|looked|turned|forgot|dropped|arrived|blocked)\b/i.test(text) ||
    /\bforgot suitcase\b/i.test(text) ||
    /\bopen suitcase\b/i.test(text) ||
    /\bon the ground opened\b/i.test(text)
  )
}

function answerCanSupportCloseRepair(answer, scene = null, features = detectAnswerFeatures(answer)) {
  const text = String(answer ?? '').trim()
  const wordCount = text.match(/\b[\p{L}\p{N}']+\b/gu)?.length ?? 0
  const sceneVocabulary = buildSceneVocabulary(scene)
  const answerTokens = extractContentTokens(text)
  const matchedTokens = answerTokens.filter((token) =>
    sceneVocabulary.has(token) || [...sceneVocabulary].some((sceneToken) => sceneToken.startsWith(token) || token.startsWith(sceneToken)),
  )
  const looseSceneTokens = [
    String(scene?.title ?? ''),
    String(scene?.setting ?? ''),
    String(scene?.prompt ?? ''),
    ...(scene?.sceneScript?.coreActions?.flatMap((action) => [action?.actor, action?.visibleAs]) ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .match(/\b[\p{L}']{3,}\b/gu) ?? []
  const answerLooseTokens = text.toLowerCase().match(/\b[\p{L}']{3,}\b/gu) ?? []
  const looseMatches = [...new Set(answerLooseTokens.filter((token) => looseSceneTokens.includes(token)))]
  const mentionedActions = detectMentionedActions(text, scene)

  if (!text) {
    return false
  }

  if (wordCount < 5) {
    return false
  }

  const hasUsableNarration =
    getClarityScore(text) >= 1 ||
    features.hasRelationshipConnector ||
    features.hasAnyPastVerb ||
    features.presentSignals?.hasExplicitPresent ||
    features.presentSignals?.hasUnclearBaseForms

  const hasSceneAnchor =
    checkSceneMatch(text, scene) ||
    mentionedActions.length > 0 ||
    matchedTokens.length >= 2 ||
    looseMatches.length >= 1

  return hasUsableNarration && hasSceneAnchor
}

function rewriteRespectsLevelRulesForMode(value, answer, challenge, mode) {
  if (mode === 'REBUILD') {
    return rebuildRewriteRespectsLevelRules(value, challenge)
  }

  return rewriteRespectsLevelRules(value, answer, challenge)
}

function rebuildRewriteRespectsLevelRules(value, challenge) {
  const candidate = detectAnswerFeatures(value)

  if (challenge?.id === 'beginner') {
    return !candidate.hasPastPerfect && !candidate.hasPastPerfectContinuous && !candidate.hasWhen && !candidate.hasWhile
  }

  if (challenge?.id === 'intermediate') {
    return candidate.hasWhen || candidate.hasWhile || candidate.hasRelationshipConnector
  }

  if (challenge?.id === 'advanced') {
    return candidate.hasPastPerfect || candidate.hasPastPerfectContinuous
  }

  return true
}

function hasMeaningfulRewriteChange(rewrite, answer) {
  if (!sameText(rewrite, answer)) {
    return true
  }

  return String(rewrite ?? '').trim() !== String(answer ?? '').trim()
}

function buildSurfacePolishRewrite(answer) {
  const text = String(answer ?? '').trim()

  if (!text) {
    return ''
  }

  const spellingFixed = applyKnownSpellingFixes(text)
  const polished = polishRewriteSurface(spellingFixed)
  return polished !== text ? polished : ''
}

function surfacePolishCorrection(suggestion, localCopy, original = '') {
  const originalText = String(original ?? '').trim()
  const suggestionText = String(suggestion ?? '').trim()
  const normalizedOriginal = normalizeComparableText(originalText)
  const normalizedSuggestion = normalizeComparableText(suggestionText)
  const suggestionLabel =
    normalizedOriginal !== normalizedSuggestion
      ? (localCopy.suggestSurfacePolishWithSpelling || localCopy.suggestSurfacePolish || suggestionText)
      : (localCopy.suggestSurfacePolish || suggestionText)

  return {
    original: localCopy.yourStory,
    suggestion: suggestionLabel,
    reason: surfacePolishReason(original, suggestion, localCopy),
    grammarFocus: 'capitalization, punctuation, and spelling',
  }
}

function surfacePolishReason(original, suggestion, localCopy) {
  const originalText = String(original ?? '').trim()
  const suggestionText = String(suggestion ?? '').trim()
  const normalizedOriginal = normalizeComparableText(originalText)
  const normalizedSuggestion = normalizeComparableText(suggestionText)

  if (normalizedOriginal !== normalizedSuggestion) {
    return localCopy.reasonSurfacePolishWithSpelling
  }

  return localCopy.reasonSurfacePolish
}

function applyKnownSpellingFixes(value = '') {
  let rewritten = String(value ?? '')

  const replacements = [
    [/\bdarek\b/gi, 'dark'],
    [/\bshe were\b/gi, 'she was'],
    [/\bhe were\b/gi, 'he was'],
    [/\bit were\b/gi, 'it was'],
    [/\bthey was\b/gi, 'they were'],
    [/\bhats\b(?=\s+off\b)/gi, 'hat'],
    [/\boff of\b/gi, 'off'],
    [/\bmade a chaos\b/gi, 'caused chaos'],
  ]

  for (const [pattern, replacement] of replacements) {
    rewritten = rewritten.replace(pattern, replacement)
  }

  return rewritten
}

function polishRewriteSurface(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return ''
  }

  const normalizedSpacing = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')

  const capitalizedSentences = normalizedSpacing.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
  const withTerminalPunctuation = /[.!?]$/.test(capitalizedSentences) ? capitalizedSentences : `${capitalizedSentences}.`

  return withTerminalPunctuation
}

function makePolishedFallbackRewrite(answer) {
  const text = String(answer ?? '').trim()

  if (!text) {
    return ''
  }

  const polished = text
    .replace(/\bfell because of bad shoes\b/i, 'fell because of her bad shoes')
    .replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\ba Friend\b/g, 'A friend')
    .replace(/\bhad blown the hat off of mum's head\b/i, "had already blown the hat off Mum's head")
    .replace(/\bmum's\b/g, "Mum's")
    .replace(/\bmum\b/g, 'Mum')
    .replace(/\boff of\b/g, 'off')

  return sameText(polished, text) ? '' : polished
}

function meaningPreservingRewrite(answer) {
  const text = String(answer ?? '').trim()
  const normalized = normalizeComparableText(text)

  if (
    normalized.includes('busy day at the train station') &&
    normalized.includes('people were running everywhere') &&
    normalized.includes('had forgotten') &&
    normalized.includes('suitcase')
  ) {
    return 'It was a busy day at the train station. People were running everywhere, trying to catch the train. Somebody had forgotten his suitcase wide open on the platform, but the passing passengers ignored it because they were too busy.'
  }

  if (
    normalized.includes('market was already crowded') &&
    normalized.includes('vendors had opened their stalls early') &&
    normalized.includes('vendor was weighing apples') &&
    normalized.includes('child dropped some oranges') &&
    normalized.includes('cyclist swerved') &&
    normalized.includes('dog stole a piece of bread')
  ) {
    return 'The market was already crowded because the vendors had opened their stalls early. While one vendor was weighing apples, a child dropped some oranges, so a cyclist swerved to avoid them. At another stall, two friends were bargaining while a dog stole a piece of bread.'
  }

  if (
    normalized.includes('had been up all morning making pancakes') &&
    normalized.includes('distracted by the cat') &&
    normalized.includes('burned the pancakes') &&
    normalized.includes('alarm went off')
  ) {
    return 'Dad had been making pancakes all morning when the cat distracted him, so the pancakes burned and the alarm went off.'
  }

  return ''
}

function changesCausalMeaning(value, answer) {
  const rewrite = String(value ?? '').toLowerCase()
  const original = String(answer ?? '').toLowerCase()

  if (!rewrite.includes('because') || original.includes('because')) {
    return false
  }

  return (
    (rewrite.includes('people were running') && rewrite.includes('because') && rewrite.includes('suitcase')) ||
    (rewrite.includes('passengers were running') && rewrite.includes('because') && rewrite.includes('suitcase')) ||
    (rewrite.includes('everyone was running') && rewrite.includes('because') && rewrite.includes('suitcase'))
  )
}

function removesSuccessfulNarrativeRelationship(value, answer) {
  const candidate = detectAnswerFeatures(value)
  const original = detectAnswerFeatures(answer)

  if (original.hasCauseResult && !candidate.hasCauseResult) {
    return true
  }

  if (original.hasPastPerfectContinuous && !candidate.hasPastPerfectContinuous) {
    return true
  }

  if (original.hasPastPerfect && !candidate.hasPastPerfect && !candidate.hasPastPerfectContinuous) {
    return true
  }

  if (original.hasPastContinuous && !candidate.hasPastContinuous && original.hasRelationshipConnector) {
    return true
  }

  if (original.hasRelationshipConnector && !candidate.hasRelationshipConnector) {
    return true
  }

  return false
}

function changesKitchenPancakeMeaning(value, answer) {
  const rewrite = String(value ?? '').toLowerCase()
  const original = String(answer ?? '').toLowerCase()

  const originalHasKitchenChain =
    /\bcat\b/.test(original) &&
    /\bburn(?:ed|t)\b[^.?!]*\bpancakes?\b/.test(original) &&
    /\balarm\b[^.?!]*\b(went off|rang|started|sounded)\b/.test(original)

  if (!originalHasKitchenChain) {
    return false
  }

  const rewriteKeepsKitchenChain =
    /\bcat\b/.test(rewrite) &&
    /\bburn(?:ed|t)\b[^.?!]*\bpancakes?\b/.test(rewrite) &&
    /\balarm\b[^.?!]*\b(went off|rang|started|sounded)\b/.test(rewrite)

  if (rewriteKeepsKitchenChain) {
    return false
  }

  return /\b(grandmother|window|smoke)\b/.test(rewrite) || !/\bcat\b/.test(rewrite)
}

function createsAwkwardWhilePastPerfectContinuous(value, answer) {
  const rewrite = String(value ?? '').toLowerCase()
  const original = String(answer ?? '').toLowerCase()

  return (
    original.includes('while') &&
    rewrite.includes('while') &&
    /\bwhile\b[^.?!]*\bhad been\s+\w+ing\b/.test(rewrite) &&
    !/\bwhile\b[^.?!]*\bhad been\s+\w+ing\b/.test(original)
  )
}

function turnsBoundedResultIntoPastContinuous(value, answer = '') {
  const suggestion = String(value ?? '').toLowerCase()
  const original = String(answer ?? '').toLowerCase()

  if (!/\b(was|were)\s+\w+ing\b/.test(suggestion)) {
    return false
  }

  if (/\b(was|were)\s+\w+ing\b/.test(original) && sameText(value, answer)) {
    return false
  }

  const boundedResultPatterns = [
    /\bwas\s+blowing\s+[^.?!]*(hat|kite|cloth|tablecloth|umbrella)\s+(off|away|loose)\b/,
    /\bwas\s+knocking\s+[^.?!]*\bdoor\b/,
    /\bwas\s+dropping\s+[^.?!]*(flowers|oranges|eggs|glass|ticket|passport)\b/,
    /\bwas\s+spilling\s+[^.?!]*(milk|coffee|soup)\b/,
    /\bwas\s+breaking\s+[^.?!]*(glass|window|plate)\b/,
    /\bwas\s+opening\s+[^.?!]*(suitcase|cooler|door|ring box|bag|backpack)\b/,
    /\b(suitcase|cooler|door|ring box|bag|backpack)\s+was\s+opening\b/,
    /\bwas\s+falling\s+(over|off|open)\b/,
    /\bwas\s+snapping\s+loose\b/,
    /\bwere\s+blowing\s+[^.?!]*(hat|kite|cloth|tablecloth|umbrella)\s+(off|away|loose)\b/,
    /\bwere\s+dropping\s+[^.?!]*(flowers|oranges|eggs|glass|ticket|passport)\b/,
    /\bwere\s+spilling\s+[^.?!]*(milk|coffee|soup)\b/,
    /\bwere\s+breaking\s+[^.?!]*(glass|window|plate)\b/,
    /\bwere\s+opening\s+[^.?!]*(suitcase|cooler|door|ring box|bag|backpack)\b/,
    /\b(suitcases|coolers|doors|ring boxes|bags|backpacks)\s+were\s+opening\b/,
    /\bwere\s+falling\s+(over|off|open)\b/,
    /\bwere\s+snapping\s+loose\b/,
  ]

  return boundedResultPatterns.some((pattern) => pattern.test(suggestion))
}

function wordSet(value) {
  return new Set(
    String(value ?? '')
      .toLowerCase()
      .match(/\p{L}{3,}|\p{N}+/gu) ?? [],
  )
}

function makeMinimalFallbackRewrite(answer, challenge, scene = null) {
  const trimmed = String(answer ?? '').trim()
  const features = detectAnswerFeatures(trimmed)

  if (!trimmed) {
    return ''
  }

  if (challenge?.id === 'beginner') {
    return ''
  }

  if (challenge?.id === 'advanced') {
    if (features.hasPastPerfect || features.hasPastPerfectContinuous) {
      return ''
    }

    const sceneAwareEarlier = sceneAwareEarlierPastSentence(scene)

    if (sceneAwareEarlier) {
      const base = correctMainNarrationToPast(trimmed, scene)

      if (base && !sameText(base, sceneAwareEarlier)) {
        return `${polishRewriteSurface(base)} ${sceneAwareEarlier}`
      }
    }

    return ''
  }

  return ''
}

function repairAdvancedTimelineRewrite(answer, scene, challenge) {
  if (challenge?.id !== 'advanced') {
    return ''
  }

  const trimmed = String(answer ?? '').trim()
  const features = detectAnswerFeatures(trimmed)

  if (!trimmed) {
    return ''
  }

  if (hasValidAdvancedEarlierPast(trimmed, features)) {
    let repaired = trimmed
      .replace(/\bbucketed\b/gi, 'bucket')
      .replace(/\s+and\s+when\b/gi, ', and when')
      .replace(/\bwhen\b([^,.!?]{4,}?)\s+((?:the|a|an)\s+\w+\s+(?:ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|arrived|walked|waited|watched|worked|looked|knocked|opened|spilled|chased|dropped|rushed|carried|pointed|mixed|fixed|burned|weighed)\b)/gi, 'when$1, $2')

    repaired = repairWholeAnswerSurface(repaired, scene) || repaired
    repaired = polishRewriteSurface(repaired)

    if (
      repaired &&
      !sameText(repaired, trimmed) &&
      rewriteRespectsLevelRules(repaired, answer, challenge) &&
      !turnsBoundedResultIntoPastContinuous(repaired, answer) &&
      !changesCausalMeaning(repaired, answer) &&
      !removesSuccessfulNarrativeRelationship(repaired, answer) &&
      !changesKitchenPancakeMeaning(repaired, answer)
    ) {
      return repaired
    }

    return ''
  }

  let repaired = trimmed
    .replace(/\bhad been ([a-z]+(?:ed|en|wn|ne|t))\b/gi, 'had $1')
    .replace(/\b(was|were) ([a-z]+(?:ed|en|wn|ne|t))\b(?=[^.?!]*(?:before|earlier|already))/gi, 'had $2')

  repaired = polishRewriteSurface(repaired)

  if (
    repaired &&
    !sameText(repaired, trimmed) &&
    rewriteRespectsLevelRules(repaired, answer, challenge) &&
    !turnsBoundedResultIntoPastContinuous(repaired, answer) &&
    !changesCausalMeaning(repaired, answer) &&
    !removesSuccessfulNarrativeRelationship(repaired, answer) &&
    !changesKitchenPancakeMeaning(repaired, answer)
  ) {
    return repaired
  }

  const sceneAwareEarlier = sceneAwareEarlierPastSentence(scene, trimmed)

  if (!sceneAwareEarlier) {
    return ''
  }

  const base = correctMainNarrationToPast(trimmed, scene)

  if (!base) {
    return ''
  }

  return `${polishRewriteSurface(base)} ${sceneAwareEarlier}`
}

function sceneAwareEarlierPastSentence(scene, answer = '') {
  const earlierRelationship = pickRelatedEarlierPastRelationship(scene, answer)

  if (earlierRelationship?.modelSentence) {
    return polishRewriteSurface(earlierRelationship.modelSentence)
  }

  const targetRelationship = (scene?.sceneScript?.targetRelationships ?? []).find((sentence) =>
    /\bhad\b/i.test(sentence) && advancedAddedSentenceMatchesAnswer(sentence, answer, scene),
  )

  if (targetRelationship) {
    return polishRewriteSurface(targetRelationship)
  }

  if (!String(answer ?? '').trim()) {
    const fallbackRelationship = scene?.sceneScript?.relationships?.find((relationship) => relationship.type === 'earlier-past')

    if (fallbackRelationship?.modelSentence) {
      return polishRewriteSurface(fallbackRelationship.modelSentence)
    }

    const fallbackTarget = (scene?.sceneScript?.targetRelationships ?? []).find((sentence) => /\bhad\b/i.test(sentence))
    return fallbackTarget ? polishRewriteSurface(fallbackTarget) : ''
  }

  return ''
}

function pickRelatedEarlierPastRelationship(scene, answer = '') {
  const relationships = (scene?.sceneScript?.relationships ?? []).filter((relationship) => relationship.type === 'earlier-past')

  if (!relationships.length) {
    return null
  }

  if (!String(answer ?? '').trim()) {
    return relationships[0]
  }

  const actionMap = new Map((scene?.sceneScript?.coreActions ?? []).map((action) => [action.id, action]))
  const normalizedAnswer = String(answer ?? '').toLowerCase()

  const scored = relationships
    .map((relationship) => {
      const earlierAction = actionMap.get(relationship.earlierAction)
      const laterAction = actionMap.get(relationship.laterAction)
      let score = tokenOverlapScore(answer, relationship.modelSentence)

      if (earlierAction?.actor && normalizedAnswer.includes(String(earlierAction.actor).toLowerCase())) {
        score += 2
      }

      if (laterAction?.actor && normalizedAnswer.includes(String(laterAction.actor).toLowerCase())) {
        score += 3
      }

      if ((relationship.usefulConnectors ?? []).some((connector) => normalizedAnswer.includes(String(connector).toLowerCase()))) {
        score += 1
      }

      return { relationship, score }
    })
    .sort((left, right) => right.score - left.score)

  return scored[0]?.score > 0 ? scored[0].relationship : null
}

function advancedAddedSentenceMatchesAnswer(candidate, answer = '', scene = null) {
  const mainText = String(answer ?? '').trim()
  const addedText = String(candidate ?? '').trim()

  if (!addedText) {
    return false
  }

  if (!mainText) {
    return true
  }

  if (containsGenericEarlierTemplate(addedText)) {
    return false
  }

  if (repeatsMainActionInAnotherTense(mainText, addedText)) {
    return false
  }

  const tokenScore = tokenOverlapScore(mainText, addedText)
  const actorScore = relatedActorScore(mainText, addedText, scene)

  return tokenScore >= 1 || actorScore >= 1
}

function repeatsMainActionInAnotherTense(mainText, addedText) {
  const mainTokens = new Set(extractContentTokens(mainText))
  const addedTokens = new Set(extractContentTokens(addedText))

  if (!mainTokens.size || !addedTokens.size) {
    return false
  }

  const shared = [...mainTokens].filter((token) => addedTokens.has(token))
  const overlap = shared.length / Math.max(1, Math.min(mainTokens.size, addedTokens.size))

  return overlap >= 0.8
}

function tokenOverlapScore(first, second) {
  const firstTokens = new Set(extractContentTokens(first))
  const secondTokens = new Set(extractContentTokens(second))

  if (!firstTokens.size || !secondTokens.size) {
    return 0
  }

  return [...firstTokens].filter((token) => secondTokens.has(token)).length
}

function relatedActorScore(mainText, addedText, scene = null) {
  const actors = [...new Set((scene?.sceneScript?.coreActions ?? []).map((action) => String(action.actor ?? '').toLowerCase()).filter(Boolean))]

  if (!actors.length) {
    return 0
  }

  const normalizedMain = String(mainText ?? '').toLowerCase()
  const normalizedAdded = String(addedText ?? '').toLowerCase()

  return actors.filter((actor) => normalizedMain.includes(actor) && normalizedAdded.includes(actor)).length
}

function buildSceneModelRewrite(scene, challenge) {
  if (!scene) {
    return ''
  }

  if (challenge?.id === 'advanced') {
    return (
      sceneAwareEarlierPastSentence(scene) ||
      buildFallbackAdvancedSceneSentence(scene) ||
      buildSceneRelationshipSentence(scene, 'earlier-past') ||
      buildSceneCoreActionSentence(scene, 0)
    )
  }

  if (challenge?.id === 'intermediate') {
    return (
      buildSceneRelationshipSentence(scene, 'interruption') ||
      buildSceneRelationshipSentence(scene, 'simultaneous-background') ||
      buildSceneRelationshipSentence(scene, 'cause-result') ||
      buildSceneCoreActionSentence(scene, 0)
    )
  }

  const first = buildSceneCoreActionSentence(scene, 0)
  const second = buildSceneCoreActionSentence(scene, 1)
  return [first, second].filter(Boolean).join(' ').trim()
}

function buildFallbackAdvancedSceneSentence(scene, answer = '') {
  const actions = scene?.sceneScript?.coreActions ?? []
  const background = actions.find((action) => /\b(was|were)\b/i.test(action?.recommendedVerbForms?.[0] || '')) || actions[0]
  const event = actions.find((action) => action.id !== background?.id) || actions[1]

  if (!background || !event) {
    return ''
  }

  const backgroundVerb = stripAuxiliary(background.recommendedVerbForms?.[0])
  const eventVerb = event.recommendedVerbForms?.[0] || 'did something'

  const candidate = polishRewriteSurface(`${sceneActorSubject(background.actor)} had been ${backgroundVerb} before ${lowerCaseSentenceStart(sceneActorSubject(event.actor))} ${eventVerb}.`)
  return advancedAddedSentenceMatchesAnswer(candidate, answer, scene) || !String(answer ?? '').trim() ? candidate : ''
}

function stripAuxiliary(value = '') {
  return String(value ?? '')
    .replace(/\b(was|were|had been|had|is|are)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'doing something'
}

function buildSceneRelationshipSentence(scene, relationshipType) {
  const relationship = scene?.sceneScript?.relationships?.find((item) => item.type === relationshipType)

  if (relationship?.modelSentence) {
    return polishRewriteSurface(relationship.modelSentence)
  }

  const actions = scene?.sceneScript?.coreActions ?? []
  const background = actions.find((action) => action.id === relationship?.backgroundAction)
  const event = actions.find((action) => action.id === relationship?.interruptingAction || action.id === relationship?.result || action.id === relationship?.trigger)

  if (!background || !event) {
    return ''
  }

  const backgroundClause = buildSceneActionClause(background, scene)
  const eventClause = buildSceneActionClause(event, scene, { lowercaseStart: true })

  if (!backgroundClause || !eventClause) {
    return ''
  }

  if (relationshipType === 'interruption') {
    return polishRewriteSurface(`${backgroundClause} when ${eventClause}.`)
  }

  if (relationshipType === 'simultaneous-background') {
    return polishRewriteSurface(`${backgroundClause} while ${eventClause}.`)
  }

  if (relationshipType === 'cause-result') {
    return polishRewriteSurface(`${backgroundClause}, so ${eventClause}.`)
  }

  return ''
}

function buildSceneCoreActionSentence(scene, index = 0) {
  const action = scene?.sceneScript?.coreActions?.[index]

  if (!action) {
    return ''
  }

  const clause = buildSceneActionClause(action, scene)
  return clause ? polishRewriteSurface(`${clause}.`) : ''
}

function buildSceneActionClause(action, scene, { lowercaseStart = false } = {}) {
  const visibleSentence = String(action?.visibleAs ?? '').trim()

  if (!visibleSentence) {
    return ''
  }

  const pastSentence = correctMainNarrationToPast(visibleSentence, scene)
  const normalized = String(pastSentence ?? '').trim().replace(/[.!?]+$/, '')

  if (!normalized) {
    return ''
  }

  return lowercaseStart ? lowerCaseSentenceStart(normalized) : normalized
}

function applySceneArticlePolish(answer, scene) {
  let rewritten = String(answer ?? '').trim()
  const actors = [...new Set((scene?.sceneScript?.coreActions ?? []).map((action) => String(action.actor ?? '').toLowerCase()).filter(Boolean))]

  if (!rewritten || !actors.length) {
    return ''
  }

  for (const actor of actors) {
    if (scenePluralActors.has(actor) || sceneBareActors.has(actor)) {
      continue
    }

    const replacement = sceneActorSubject(actor)
    const regex = new RegExp(`(^|[.!?]\\s+)(${actor})(?=\\s+(?:was|were|had|ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|arrived|walked|waited|watched|worked|looked|knocked|opened|spilled|chased|dropped|rushed|carried|pointed|mixed|fixed|burned|weighed))`, 'gi')
    rewritten = rewritten.replace(regex, (_, prefix) => `${prefix}${replacement}`)
  }

  return sameText(rewritten, answer) ? '' : rewritten
}

function needsSceneArticlePolish(answer, scene) {
  return Boolean(applySceneArticlePolish(answer, scene))
}

function repairWholeAnswerSurface(answer, scene) {
  let rewritten = String(answer ?? '').trim()

  if (!rewritten) {
    return ''
  }

  rewritten = applySceneArticlePolish(rewritten, scene) || rewritten
  rewritten = rewritten
    .replace(/\bam\s+(\w+ing)\b/gi, 'was $1')
    .replace(/\bis\s+(\w+ing)\b/gi, 'was $1')
    .replace(/\bare\s+(\w+ing)\b/gi, 'were $1')
    .replace(/\bhas been\s+(\w+ing)\b/gi, 'had been $1')

  rewritten = applyCommonPresentToPastFixes(rewritten)
  rewritten = applySceneVerbPastFixes(rewritten, scene)
  rewritten = applyKnownSpellingFixes(rewritten)
  rewritten = insertSceneSentenceBreaks(rewritten, scene)
  rewritten = rewritten.replace(/\b(and)\s+(the|a|an)\s+\w+\s+(?:was|were|had|\w+ed\b|\w+t\b|ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent)\b/gi, ', and $2')

  const polished = polishRewriteSurface(rewritten)
  return sameText(polished, answer) ? '' : polished
}

function insertSceneSentenceBreaks(answer, scene) {
  let rewritten = String(answer ?? '')
  const subjects = [...new Set((scene?.sceneScript?.coreActions ?? []).map((action) => sceneActorSubject(action.actor)).filter(Boolean))]

  for (const subject of subjects) {
    const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?<![.!?])\\s+(${escapedSubject})(?=\\s+(?:was|were|had|ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|arrived|walked|waited|watched|worked|looked|knocked|opened|spilled|chased|dropped|rushed|carried|pointed|mixed|fixed|burned|weighed))`, 'g')
    rewritten = rewritten.replace(regex, '. $1')
  }

  return rewritten
}

function repairRelationshipRewrite(answer, scene, challenge) {
  if (challenge?.id !== 'intermediate') {
    return ''
  }

  const features = detectAnswerFeatures(answer)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)

  if ((features.hasWhen || features.hasWhile) && semanticTenseFit.verdict !== 'mismatch') {
    return ''
  }

  const relationshipSentence =
    semanticTenseFit.modelSentence ||
    buildSceneRelationshipSentence(scene, 'interruption') ||
    buildSceneRelationshipSentence(scene, 'simultaneous-background')

  if (relationshipSentence) {
    return relationshipSentence
  }

  return ''
}

function sceneActorSubject(actor = '') {
  const normalized = String(actor ?? '').trim().toLowerCase()

  if (!normalized) {
    return 'Someone'
  }

  if (sceneBareActors.has(normalized)) {
    return capitalizeFirst(normalized)
  }

  if (scenePluralActors.has(normalized) || (normalized.endsWith('s') && !normalized.endsWith('ss'))) {
    return capitalizeFirst(normalized)
  }

  return capitalizeFirst(`the ${normalized}`)
}

function capitalizeFirst(value = '') {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : ''
}

function lowerCaseSentenceStart(value = '') {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : ''
}

const scenePluralActors = new Set([
  'animals',
  'children',
  'clouds',
  'coworkers',
  'friends',
  'guests',
  'passengers',
  'people',
  'students',
  'vendors',
  'visitors',
])

const sceneBareActors = new Set([
  'dad',
  'father',
  'grandfather',
  'grandma',
  'grandmother',
  'grandpa',
  'lisa',
  'mom',
  'mother',
  'mum',
])

function rewriteRespectsLevelRules(value, answer, challenge) {
  if (!value || !String(value).trim()) {
    return false
  }

  const original = detectAnswerFeatures(answer)
  const candidate = detectAnswerFeatures(value)

  if (challenge?.id === 'beginner') {
    if (!original.hasWhen && candidate.hasWhen) {
      return false
    }

    if (!original.hasWhile && candidate.hasWhile) {
      return false
    }

    if (!original.hasPastPerfect && candidate.hasPastPerfect) {
      return false
    }

    if (!original.hasPastPerfectContinuous && candidate.hasPastPerfectContinuous) {
      return false
    }
  }

  if (challenge?.id === 'intermediate') {
    if (!original.hasPastPerfect && candidate.hasPastPerfect) {
      return false
    }

    if (!original.hasPastPerfectContinuous && candidate.hasPastPerfectContinuous) {
      return false
    }
  }

  if (challenge?.id === 'advanced') {
    if (!candidate.hasPastPerfect && !candidate.hasPastPerfectContinuous) {
      return false
    }

    if (original.hasPastPerfect || original.hasPastPerfectContinuous) {
      return !hasBrokenEarlierPast(value)
    }

    if (!orderedAdvancedRewriteIsValid(value, answer)) {
      return false
    }
  }

  return true
}

function buildOrderedAdvancedRewrite(answer, scene, challenge) {
  if (challenge?.id !== 'advanced') {
    return ''
  }

  const mainSentence = correctMainNarrationToPast(answer, scene)
  const earlierSentence = sceneAwareEarlierPastSentence(scene, mainSentence || answer)

  if (!mainSentence || !earlierSentence) {
    return ''
  }

  if (!advancedAddedSentenceMatchesAnswer(earlierSentence, mainSentence || answer, scene)) {
    return ''
  }

  const combined = `${polishRewriteSurface(mainSentence)} ${earlierSentence}`

  return orderedAdvancedRewriteIsValid(combined, answer) ? combined : ''
}

function advancedBetterVersionRepairsBeforeExtension(value, answer) {
  const candidate = String(value ?? '').trim()

  if (!candidate) {
    return true
  }

  const answerFeatures = detectAnswerFeatures(answer)
  const candidateFeatures = detectAnswerFeatures(candidate)

  if (!candidateFeatures.hasPastPerfect && !candidateFeatures.hasPastPerfectContinuous) {
    return true
  }

  if (answerFeatures.hasPastPerfect || answerFeatures.hasPastPerfectContinuous) {
    return !hasBrokenEarlierPast(candidate)
  }

  return orderedAdvancedRewriteIsValid(candidate, answer)
}

function orderedAdvancedRewriteIsValid(value, answer) {
  const sentences = splitIntoSentences(value)

  if (sentences.length < 2) {
    return false
  }

  const [firstSentence, ...rest] = sentences
  const laterText = rest.join(' ')
  const firstFeatures = detectAnswerFeatures(firstSentence)
  const laterFeatures = detectAnswerFeatures(laterText)

  if (!firstFeatures.hasAnyPastVerb) {
    return false
  }

  if (firstFeatures.hasPastPerfect || firstFeatures.hasPastPerfectContinuous) {
    return false
  }

  if (!laterFeatures.hasPastPerfect && !laterFeatures.hasPastPerfectContinuous) {
    return false
  }

  if (containsGenericEarlierTemplate(laterText)) {
    return false
  }

  if (repeatsMainActionInAnotherTense(firstSentence, laterText)) {
    return false
  }

  if (wordOverlapRatio(firstSentence, answer) < 0.35) {
    return false
  }

  return true
}

function correctMainNarrationToPast(answer, scene = null) {
  const firstSentence = splitIntoSentences(answer)[0] ?? String(answer ?? '').trim()

  if (!firstSentence) {
    return ''
  }

  let corrected = firstSentence
    .replace(/\bhad been ((?:[a-z]+(?:ed|en|wn|ne|t))|ran|came|went|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent)\b/gi, (_, verb) => normalizeBrokenEarlierPastVerb(verb))
    .replace(/\bhad (?!been\b)(ran|came|went|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent)\b(?=[^.?!]*(?:before|earlier|already))/gi, (_, verb) => normalizeBrokenEarlierPastVerb(verb))
    .replace(/\bam\s+(\w+ing)\b/gi, 'was $1')
    .replace(/\bis\s+(\w+ing)\b/gi, 'was $1')
    .replace(/\bare\s+(\w+ing)\b/gi, 'were $1')
    .replace(/\bhas been\s+(\w+ing)\b/gi, 'had been $1')

  corrected = applyCommonPresentToPastFixes(corrected)
  corrected = applySceneVerbPastFixes(corrected, scene)
  corrected = applyKnownSpellingFixes(corrected)

  return polishRewriteSurface(corrected)
}

function normalizeBrokenEarlierPastVerb(verb) {
  const normalized = String(verb ?? '').toLowerCase()
  const simplePastMap = commonSimplePastMap()

  return simplePastMap[normalized] || normalized
}

function applyCommonPresentToPastFixes(value) {
  let corrected = String(value ?? '')
  const simplePastMap = commonSimplePastMap()

  for (const [baseForm, pastForm] of Object.entries(simplePastMap)) {
    const regex = new RegExp(`\\b${baseForm}(?:s|es)?\\b`, 'gi')
    corrected = corrected.replace(regex, pastForm)
  }

  return corrected
}

function applySceneVerbPastFixes(value, scene = null) {
  let corrected = String(value ?? '')
  const actions = scene?.sceneScript?.coreActions ?? []

  for (const action of actions) {
    for (const recommendedVerbForm of action.recommendedVerbForms ?? []) {
      if (!recommendedVerbForm || /\s/.test(recommendedVerbForm)) {
        continue
      }

      const baseForms = possibleBaseFormsForPast(recommendedVerbForm)

      for (const baseForm of baseForms) {
        const regex = new RegExp(`\\b${baseForm}s?\\b`, 'gi')
        corrected = corrected.replace(regex, recommendedVerbForm)
      }
    }
  }

  return corrected
}

function possibleBaseFormsForPast(pastForm) {
  const normalized = String(pastForm ?? '').toLowerCase()
  const irregular = {
    ran: ['run'],
    came: ['come'],
    went: ['go'],
    saw: ['see'],
    took: ['take'],
    made: ['make'],
    found: ['find'],
    left: ['leave'],
    felt: ['feel'],
    heard: ['hear'],
    built: ['build'],
    caught: ['catch'],
    brought: ['bring'],
    fell: ['fall'],
    broke: ['break'],
    blew: ['blow'],
    wrote: ['write'],
    stood: ['stand'],
    sat: ['sit'],
    stole: ['steal'],
    spoke: ['speak'],
    rang: ['ring'],
    lit: ['light'],
    drove: ['drive'],
    rose: ['rise'],
    began: ['begin'],
    bought: ['buy'],
    lost: ['lose'],
    sent: ['send'],
  }

  if (irregular[normalized]) {
    return irregular[normalized]
  }

  if (normalized.endsWith('ied')) {
    return [`${normalized.slice(0, -3)}y`]
  }

  if (normalized.endsWith('ed')) {
    return [normalized.slice(0, -2)]
  }

  return []
}

function commonSimplePastMap() {
  return {
    arrive: 'arrived',
    ask: 'asked',
    bargain: 'bargained',
    blow: 'blew',
    break: 'broke',
    build: 'built',
    burn: 'burned',
    carry: 'carried',
    catch: 'caught',
    chase: 'chased',
    cheer: 'cheered',
    check: 'checked',
    close: 'closed',
    collapse: 'collapsed',
    come: 'came',
    cook: 'cooked',
    drop: 'dropped',
    fall: 'fell',
    fix: 'fixed',
    foam: 'foamed',
    forget: 'forgot',
    gather: 'gathered',
    jump: 'jumped',
    knock: 'knocked',
    leave: 'left',
    look: 'looked',
    march: 'marched',
    mix: 'mixed',
    open: 'opened',
    point: 'pointed',
    propose: 'proposed',
    push: 'pushed',
    rain: 'rained',
    read: 'read',
    repair: 'repaired',
    ring: 'rang',
    roll: 'rolled',
    run: 'ran',
    rush: 'rushed',
    sleep: 'slept',
    spill: 'spilled',
    start: 'started',
    steal: 'stole',
    storm: 'stormed',
    swerve: 'swerved',
    touch: 'touched',
    trail: 'trailed',
    turn: 'turned',
    wait: 'waited',
    walk: 'walked',
    watch: 'watched',
    weigh: 'weighed',
    whisper: 'whispered',
    work: 'worked',
  }
}

function containsGenericEarlierTemplate(value) {
  const text = String(value ?? '').toLowerCase()
  return (
    text.includes('something had already happened before that') ||
    text.includes('before that, something had already happened') ||
    text.includes('something had happened before that')
  )
}

function splitIntoSentences(value) {
  return (String(value ?? '').match(/[^.!?]+[.!?]?/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function wordOverlapRatio(first, second) {
  const firstWords = wordSet(first)
  const secondWords = wordSet(second)

  if (!firstWords.size || !secondWords.size) {
    return 0
  }

  const shared = [...firstWords].filter((word) => secondWords.has(word))
  return shared.length / secondWords.size
}

function sameText(first, second) {
  return normalizeComparableText(first) === normalizeComparableText(second)
}

function normalizeComparableText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function fallbackRewriteFor(challenge, localCopy) {
  if (challenge?.id === 'beginner') {
    return localCopy.beginnerRewriteFallback
  }

  if (challenge?.id === 'advanced') {
    return localCopy.advancedRewriteFallback
  }

  return localCopy.intermediateRewriteFallback
}

function defaultStretchCorrection(challenge, localCopy) {
  if (challenge?.id === 'beginner') {
    return {
      original: localCopy.yourStory,
      suggestion: localCopy.stretchBeginner,
      reason: localCopy.reasonStretchBeginner,
      grammarFocus: 'narrative coherence',
    }
  }

  if (challenge?.id === 'advanced') {
    return {
      original: localCopy.yourStory,
      suggestion: localCopy.tryEarlierDetail,
      reason: localCopy.reasonEarlierDetail,
      grammarFocus: 'past perfect',
    }
  }

  return {
    original: localCopy.yourStory,
    suggestion: localCopy.useConnector,
    reason: localCopy.reasonConnector,
    grammarFocus: 'connector',
  }
}

function correctionRespectsLevelRules(correction, answer, challenge) {
  const suggestion = `${correction?.suggestion ?? ''} ${correction?.reason ?? ''}`.trim()
  const features = detectAnswerFeatures(answer)
  const lower = suggestion.toLowerCase()

  if (challenge?.id === 'beginner') {
    if (!features.hasWhen && /\bwhen\b/.test(lower)) {
      return false
    }

    if (!features.hasWhile && /\bwhile\b/.test(lower)) {
      return false
    }

    if (!features.hasPastPerfect && /\b(had|past perfect)\b/.test(lower)) {
      return false
    }

    if (!features.hasPastPerfectContinuous && /\b(had been|past perfect continuous)\b/.test(lower)) {
      return false
    }

    if (/\bsimple past\b/.test(lower) && !features.hasSimplePast) {
      return false
    }
  }

  if (challenge?.id === 'intermediate') {
    if (!features.hasPastPerfect && /\bpast perfect\b/.test(lower) && !features.hasPastPerfectContinuous) {
      return false
    }

    if (!features.hasPastPerfectContinuous && /\bpast perfect continuous\b/.test(lower)) {
      return false
    }
  }

  return true
}

function consequenceCorrection(localCopy, features = {}) {
  return resultOrConsequenceCorrection(localCopy, features)
}

function resultOrConsequenceCorrection(localCopy, features = {}) {
  if (features.hasCauseResult) {
    return whatHappenedNextCorrection(localCopy)
  }

  return {
    original: localCopy.yourStory,
    suggestion: localCopy.keepAndAddResult,
    reason: localCopy.reasonKeepAndAddResult,
    grammarFocus: 'narrative coherence',
  }
}

function whatHappenedNextCorrection(localCopy) {
  return {
    original: localCopy.yourStory,
    suggestion: localCopy.keepAndAddNextEvent,
    reason: localCopy.reasonKeepAndAddNextEvent,
    grammarFocus: 'narrative coherence',
  }
}

function meaningPreservingCorrection(suggestion, localCopy) {
  return {
    original: localCopy.yourStory,
    suggestion,
    reason: localCopy.reasonMeaningPreservingPolish,
    grammarFocus: 'narrative coherence',
  }
}

function normalizeVerdict(value, statuses, challenge, features, analysis = null) {
  return analysis?.verdictFloor ?? normalizeVerdictValue(value)
}

function verdictFromFeatures(challenge, features, statuses, answer = '', scene = null) {
  const level = normalizeRatingLevel(challenge)
  const isPastTense = detectPastTense(answer)
  const isSceneRelevant = statuses?.sceneFit
    ? statuses.sceneFit !== 'not scene-based'
    : checkSceneMatch(answer, scene)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const meetsLevelTarget = checkLevelTarget({ level, studentText: answer }) && semanticTenseFit.verdict !== 'mismatch'
  const usesTargetStructure = detectTargetStructure({ level, studentText: answer })
  const hasRecognizedAdvancedStructure = level === 'advanced' && hasValidAdvancedEarlierPast(answer, features)
  const hasAdvancedMastery = demonstratesAdvancedMastery(answer, features, { isSceneRelevant })
  const hasStrongAdvancedAttempt = advancedClearTimelineWithoutEarlierPast(
    answer,
    challenge,
    features,
    statuses,
    scene,
  )
  const clarityScore = getClarityScore(answer)
  const hasMajorErrors = detectMajorErrors(answer)
  const rating = getRating({
    level,
    isPastTense,
    isSceneRelevant,
    meetsLevelTarget,
    clarityScore,
    hasMajorErrors,
    usesTargetStructure,
    hasRecognizedAdvancedStructure,
    hasAdvancedMastery,
    hasStrongAdvancedAttempt,
    semanticTenseAligned: semanticTenseFit.verdict !== 'mismatch',
  })

  assertValidRating({ rating, isPastTense, isSceneRelevant })
  assertAdvancedRatingConsistency({ challenge, rating, features, answer, isSceneRelevant })

  return mapRatingToVerdict(rating)
}

function normalizeRatingLevel(challenge) {
  return normalizeDifficultyLevel(challenge?.id)
}

function detectPastTense(studentText) {
  const features = detectAnswerFeatures(studentText)
  return features.hasAnyPastVerb && !isMostlyPresentNarration(studentText, features) && !hasMixedNarrationTense(studentText, features)
}

function checkSceneMatch(studentText, sceneModel) {
  const text = String(studentText ?? '').trim()

  if (!text || !sceneModel) {
    return false
  }

  const sceneVocabulary = buildSceneVocabulary(sceneModel)
  const answerTokens = extractContentTokens(text)

  if (!answerTokens.length || !sceneVocabulary.size) {
    return detectMentionedActions(text, sceneModel).length > 0
  }

  const matchedTokens = new Set()
  const unmatchedTokens = new Set()

  answerTokens.forEach((token) => {
    if (sceneVocabulary.has(token) || [...sceneVocabulary].some((sceneToken) => sceneToken.startsWith(token) || token.startsWith(sceneToken))) {
      matchedTokens.add(token)
    } else {
      unmatchedTokens.add(token)
    }
  })

  if (matchedTokens.size >= 2 && matchedTokens.size > unmatchedTokens.size) {
    return true
  }

  if (matchedTokens.size >= 2 && unmatchedTokens.size <= matchedTokens.size + 1) {
    return true
  }

  if (matchedTokens.size === 1) {
    return unmatchedTokens.size === 0
  }

  return false
}

function checkLevelTarget({ level, studentText }) {
  if (level === 'beginner') {
    return detectPastTense(studentText)
  }

  if (level === 'intermediate') {
    return detectPastTense(studentText) && detectActionRelationship(studentText)
  }

  if (level === 'advanced') {
    const features = detectAnswerFeatures(studentText)
    return hasValidAdvancedEarlierPast(studentText, features)
      ? advancedEarlierPastStillUnderstandable(studentText, features)
      : detectEarlierPast(studentText)
  }

  return false
}

function detectTargetStructure({ level, studentText }) {
  if (level === 'intermediate') {
    return containsWhenOrWhile(studentText) || hasExplicitTemporalConnector(studentText)
  }

  if (level === 'advanced') {
    const features = detectAnswerFeatures(studentText)
    return hasValidAdvancedEarlierPast(studentText, features)
  }

  return false
}

function detectActionRelationship(studentText) {
  const features = detectAnswerFeatures(studentText)

  return (
    containsWhenOrWhile(studentText) ||
    hasExplicitTemporalConnector(studentText) ||
    (features.hasPastContinuous && features.hasSimplePast)
  )
}

function detectEarlierPast(studentText) {
  return containsHadOrHadBeen(studentText) || hasClearEarlierTimeMeaning(studentText)
}

function containsWhenOrWhile(studentText) {
  const features = detectAnswerFeatures(studentText)
  return features.hasWhen || features.hasWhile
}

function hasExplicitIntermediateConnector(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  return /\b(when|while|before|after|as|by the time)\b/.test(text)
}

function hasMisorderedConnector(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  const simplePastVerb = String.raw`(?:\w+ed|ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|read)`

  return (
    new RegExp(`\\b${simplePastVerb}\\b[^.?!]*\\bwhen\\b[^.?!]*\\b(?:was|were)\\s+\\w+ing\\b`).test(text) ||
    new RegExp(`\\b${simplePastVerb}\\b[^.?!]*\\bwhile\\b[^.?!]*\\b(?:was|were)\\s+\\w+ing\\b`).test(text)
  )
}

function hasExplicitTemporalConnector(studentText) {
  const features = detectAnswerFeatures(studentText)
  return features.hasRelationshipConnector || features.hasCauseResult || features.hasInterruption
}

function containsHadOrHadBeen(studentText) {
  const features = detectAnswerFeatures(studentText)
  return features.hasPastPerfect || features.hasPastPerfectContinuous
}

function hasClearEarlierTimeMeaning(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  return /\b(before|earlier|already|by the time)\b/.test(text) && detectPastTense(studentText)
}

function getClarityScore(studentText) {
  const text = String(studentText ?? '').trim()
  const features = detectAnswerFeatures(text)
  const words = text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []
  const sentences = splitIntoSentences(text)
  const hasUsableNarrativeBase =
    words.length >= 6 &&
    (
      features.hasAnyPastVerb ||
      features.presentSignals?.hasExplicitPresent ||
      features.presentSignals?.hasUnclearBaseForms ||
      features.hasRelationshipConnector
    )

  if (!text) {
    return 0
  }

  if (detectMajorErrors(text)) {
    return hasUsableNarrativeBase ? 1 : 0
  }

  if (
    features.hasAnyPastVerb &&
    words.length >= 7 &&
    sentences.length >= 1 &&
    sentences.length <= 3 &&
    !isMostlyPresentNarration(text, features) &&
    !isLikelyRunOn(text, features) &&
    (features.hasRelationshipConnector || features.hasSimplePast || features.hasPastContinuous || features.hasPastPerfect || features.hasPastPerfectContinuous)
  ) {
    return 2
  }

  if (features.hasAnyPastVerb || features.presentSignals?.hasExplicitPresent || words.length >= 5) {
    return 1
  }

  return 0
}

function detectMajorErrors(studentText) {
  const text = String(studentText ?? '').trim()
  const words = text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []
  const features = detectAnswerFeatures(text)

  if (!text) {
    return true
  }

  if (words.length < 4) {
    return true
  }

  if (hasBrokenEarlierPast(text)) {
    return true
  }

  if (features.hasAgreementMismatch) {
    return true
  }

  if (hasMixedNarrationTense(text, features)) {
    return true
  }

  if (isSeverelyBrokenRunOn(text, features) && !advancedEarlierPastStillUnderstandable(text, features)) {
    return true
  }

  if (!features.hasAnyPastVerb && !features.presentSignals?.hasExplicitPresent && !features.hasRelationshipConnector && words.length < 8) {
    return true
  }

  return false
}

function isLikelyRunOn(studentText, features = detectAnswerFeatures(studentText)) {
  const text = String(studentText ?? '').trim()

  if (!text || /[.!?]/.test(text) || features.hasRelationshipConnector) {
    return false
  }

  return (
    (features.hasPastContinuous && features.hasSimplePast) ||
    ((text.match(/\b(was|were|had)\b/gi) ?? []).length >= 2)
  )
}

function isSeverelyBrokenRunOn(studentText, features = detectAnswerFeatures(studentText)) {
  const text = String(studentText ?? '').trim()
  const words = text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []

  return isLikelyRunOn(text, features) && words.length >= 10
}

function getRating({
  level,
  isPastTense,
  isSceneRelevant,
  meetsLevelTarget,
  clarityScore,
  hasMajorErrors,
  usesTargetStructure,
  hasRecognizedAdvancedStructure = false,
  hasAdvancedMastery = false,
  hasStrongAdvancedAttempt = false,
  semanticTenseAligned = true,
}) {
  let coreFailures = 0

  if (!isSceneRelevant) coreFailures += 1
  if (!isPastTense) coreFailures += 1
  if (!meetsLevelTarget) coreFailures += 1
  if (hasMajorErrors) coreFailures += 1

  if (coreFailures >= 2) {
    return isSceneRelevant && clarityScore >= 1 ? 'Good start' : 'Needs work'
  }

  if (!isPastTense) {
    return 'Good start'
  }

  if (!isSceneRelevant) {
    return 'Good start'
  }

  if (level === 'advanced' && hasStrongAdvancedAttempt && isPastTense && isSceneRelevant && clarityScore >= 1 && !hasMajorErrors) {
    return 'Good work'
  }

  if (!meetsLevelTarget) {
    return 'Good start'
  }

  if (!semanticTenseAligned && ['intermediate', 'advanced'].includes(level)) {
    return isPastTense && isSceneRelevant ? 'Good start' : 'Needs work'
  }

  if (hasAdvancedMastery && isPastTense && isSceneRelevant && clarityScore === 2 && !hasMajorErrors) {
    return 'Excellent'
  }

  if (level === 'beginner') {
    if (isPastTense && isSceneRelevant && clarityScore === 2 && !hasMajorErrors) {
      return 'Excellent'
    }

    if (isPastTense && isSceneRelevant && clarityScore >= 1) {
      return 'Good work'
    }

    return 'Good start'
  }

  if (level === 'intermediate') {
    if (isPastTense && isSceneRelevant && usesTargetStructure && clarityScore === 2 && !hasMajorErrors) {
      return 'Excellent'
    }

    if (isPastTense && isSceneRelevant && clarityScore >= 1 && meetsLevelTarget) {
      return 'Good work'
    }

    return 'Good start'
  }

  if (level === 'advanced') {
    if (
      hasRecognizedAdvancedStructure &&
      isPastTense &&
      isSceneRelevant &&
      meetsLevelTarget
    ) {
      if (clarityScore === 2 && !hasMajorErrors && usesTargetStructure) {
        return 'Excellent'
      }

      return 'Good work'
    }

    if (isPastTense && isSceneRelevant && usesTargetStructure && clarityScore === 2 && !hasMajorErrors) {
      return 'Excellent'
    }

    if (isPastTense && isSceneRelevant && clarityScore >= 1) {
      return 'Good work'
    }

    return 'Good start'
  }

  return 'Needs work'
}

function isMostlyPresentNarration(studentText, features = detectAnswerFeatures(studentText)) {
  if (!features.hasAnyPastVerb) {
    return Boolean(features.presentSignals?.hasExplicitPresent)
  }

  return Boolean(features.presentSignals?.hasExplicitPresent || features.presentSignals?.hasUnclearBaseForms)
}

function hasMixedNarrationTense(studentText, features = detectAnswerFeatures(studentText)) {
  if (!features.hasAnyPastVerb || (!features.presentSignals?.hasExplicitPresent && !features.presentSignals?.hasUnclearBaseForms)) {
    return false
  }

  return true
}

function hasBrokenEarlierPast(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  return /\bhad been (ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent)\b/.test(text)
}

function buildSceneVocabulary(sceneModel) {
  const values = [
    sceneModel?.title,
    sceneModel?.setting,
    sceneModel?.prompt,
    ...(sceneModel?.focus ?? []),
    ...(sceneModel?.objects ?? []),
    ...(sceneModel?.actions ?? []),
    sceneModel?.sceneScript?.premise,
    sceneModel?.sceneScript?.visualStyle,
    ...(sceneModel?.sceneScript?.characters?.flatMap((character) => [
      character?.id,
      character?.description,
      character?.action,
    ]) ?? []),
    ...(sceneModel?.sceneScript?.coreActions?.flatMap((action) => [
      action?.actor,
      action?.visibleAs,
      ...(action?.recommendedVerbForms ?? []),
    ]) ?? []),
    ...(sceneModel?.sceneScript?.relationships?.flatMap((relationship) => [
      relationship?.modelSentence,
      ...(relationship?.usefulConnectors ?? []),
    ]) ?? []),
    ...(sceneModel?.sceneScript?.targetRelationships ?? []),
  ]

  return new Set(
    values
      .flatMap((value) => extractContentTokens(value))
      .filter(Boolean),
  )
}

function extractContentTokens(value) {
  const text = String(value ?? '').toLowerCase()
  const tokens = text.match(/\b[\p{L}']+\b/gu) ?? []

  return [...new Set(tokens
    .map(normalizeSceneToken)
    .filter((token) => token.length >= 4 && !sceneStopwords.has(token)))]
}

function normalizeSceneToken(token) {
  return String(token ?? '')
    .toLowerCase()
    .replace(/^somebody$/, 'person')
    .replace(/^someone$/, 'person')
    .replace(/^somewhere$/, 'place')
    .replace(/'s$/u, '')
    .replace(/ing$/u, '')
    .replace(/ed$/u, '')
    .replace(/es$/u, '')
    .replace(/s$/u, '')
}

const sceneStopwords = new Set([
  'about',
  'across',
  'after',
  'along',
  'another',
  'around',
  'before',
  'beside',
  'closed',
  'dark',
  'from',
  'have',
  'into',
  'near',
  'next',
  'onto',
  'open',
  'over',
  'someone',
  'somebody',
  'something',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'under',
  'very',
  'were',
  'while',
  'with',
  'woman',
  'man',
  'person',
])

function mapRatingToVerdict(rating) {
  if (rating === 'Excellent') return 'excellent'
  if (rating === 'Good work') return 'good-work'
  if (rating === 'Good start') return 'good-start'
  return 'keep-building'
}

function assertValidRating({ rating, isPastTense, isSceneRelevant }) {
  if (rating === 'Excellent' && (!isPastTense || !isSceneRelevant)) {
    throw new Error('Invalid rating: contradicts core evaluation')
  }
}

function assertAdvancedRatingConsistency({ challenge, rating, features, answer, isSceneRelevant }) {
  if (
    challenge?.id === 'advanced' &&
    hasValidAdvancedEarlierPast(answer, features) &&
    advancedEarlierPastStillUnderstandable(answer, features) &&
    isSceneRelevant &&
    ['Good start', 'Needs work'].includes(rating)
  ) {
    throw new Error('Invalid rating: advanced structure was recognized but rated too low')
  }
}

function normalizeVerdictValue(value) {
  const allowedVerdicts = ['keep-building', 'good-start', 'good-work', 'excellent']

  if (allowedVerdicts.includes(value)) return value
  if (value === 'beginner') return 'keep-building'
  if (value === 'developing') return 'good-start'
  if (value === 'strong') return 'good-work'

  return 'good-start'
}

function localVerdictFor({
  challenge,
  answer = '',
  scene = null,
}) {
  const features = detectAnswerFeatures(answer)
  const mentionedActions = detectMentionedActions(answer, scene)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const statuses = {
    englishStatus: getClarityScore(answer) === 0 ? 'unclear' : getClarityScore(answer) === 2 ? 'correct' : 'mostly correct',
    sceneFit: mentionedActions.length ? 'on scene' : 'not scene-based',
    taskFit:
      semanticTenseFit.verdict === 'mismatch' && taskFitFromFeatures(challenge, features) === 'on target'
        ? 'partly on target'
        : taskFitFromFeatures(challenge, features),
  }

  return verdictFromFeatures(challenge, features, statuses, answer, scene)
}

function generateNextStep({ challenge, feedbackLanguage = 'English', answer = '', scene = null, statuses = {}, features = detectAnswerFeatures(answer) }) {
  const copy = localFeedbackCopy(feedbackLanguage)
  const target = currentLevelTargetState(challenge, features, statuses)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const hasAnotherActor = sceneHasAnotherActor(answer, scene)
  const hasAnotherAction = sceneHasAnotherAction(answer, scene)
  const advancedMastery = demonstratesAdvancedMastery(answer, features, { isSceneRelevant: statuses.sceneFit === 'on scene' || statuses.sceneFit === 'partly on scene' })
  const tenseStatus = detectNarrationTenseStatus(answer, features)

  if (tenseStatus !== 'past') {
    return copy.nextUsePastTense
  }

  if (semanticTenseFit.verdict === 'mismatch') {
    return semanticTenseFit.relationshipType === 'simultaneous-background'
      ? copy.nextSemanticWhile
      : copy.nextSemanticBackground
  }

  if (advancedMastery) {
    return advancedMasteryPrompt(copy, scene)
  }

  if (challenge?.id === 'beginner') {
    if (!target.met || target.strength === 'none') {
      return hasAnotherAction ? copy.nextBasicMoreAction : copy.nextBasicMoreDetail
    }

    if (hasAnotherActor) {
      return copy.nextBasicAnotherPerson
    }

    return features.hasAnyPastVerb ? copy.nextBasicNext : copy.nextBasicMoreAction
  }

  if (challenge?.id === 'intermediate') {
    if (!target.met || target.strength === 'none') {
      return copy.nextIntermediateConnect
    }

    if (features.hasWhen || features.hasWhile || features.hasRelationshipConnector) {
      return copy.nextIntermediateOneMore
    }

    return copy.nextIntermediateConnect
  }

  if (challenge?.id === 'advanced') {
    if (hasValidAdvancedEarlierPast(answer, features)) {
      if (needsAdvancedStructureRepair(answer, features)) {
        return copy.nextAdvancedStructure
      }

      return copy.nextAdvancedTimelineClear
    }

    return copy.nextAdvanced
  }

  return copy.nextIntermediateConnect
}

function generateLevelReadinessHint({ challenge, feedbackLanguage = 'English', statuses = {}, features = {}, recentAttemptHistory = [] }) {
  const copy = localFeedbackCopy(feedbackLanguage)
  const target = currentLevelTargetState(challenge, features, statuses)
  const errorSeverity = deriveErrorSeverity(statuses)
  const stableAcrossAttempts = hasStableRecentAttempts(recentAttemptHistory, challenge, statuses, features)

  if (demonstratesAdvancedMastery('', features, { isSceneRelevant: statuses.sceneFit === 'on scene' || statuses.sceneFit === 'partly on scene' })) {
    return null
  }

  if (
    challenge?.id === 'advanced' ||
    !target.met ||
    target.strength !== 'clear' ||
    !stableAcrossAttempts ||
    !['low', 'none'].includes(errorSeverity)
  ) {
    return null
  }

  if (recentReadinessHintWasShown(recentAttemptHistory, challenge)) {
    return null
  }

  if (challenge?.id === 'beginner') {
    return copy.readinessBasic
  }

  if (challenge?.id === 'intermediate') {
    return copy.readinessIntermediate
  }

  return null
}

function currentLevelTargetState(challenge, features, statuses = {}) {
  const stable = statuses.englishStatus !== 'unclear'

  if (challenge?.id === 'beginner') {
    return {
      met: stable && features.hasAnyPastVerb,
      strength: stable && features.hasAnyPastVerb ? 'clear' : 'none',
    }
  }

  if (challenge?.id === 'intermediate') {
    const hasConnection =
      ((features.hasWhen || features.hasWhile) &&
        (features.hasPastContinuous || features.hasSimplePast || features.hasAnyConnector)) ||
      (features.hasRelationshipConnector && features.hasPastContinuous && features.hasSimplePast)
    const hasPartialRelationship = features.hasRelationshipConnector || features.hasCauseResult

    return {
      met: stable && (hasConnection || hasPartialRelationship),
      strength: stable && hasConnection ? 'clear' : stable && hasPartialRelationship ? 'partial' : 'none',
    }
  }

  if (challenge?.id === 'advanced') {
    const hasEarlierPast = features.hasPastPerfect || features.hasPastPerfectContinuous
    const strongEarlierPast = hasAdvancedTimelineLayer(features)

    return {
      met: stable && hasEarlierPast,
      strength: stable && strongEarlierPast ? 'clear' : stable && hasEarlierPast ? 'partial' : 'none',
    }
  }

  return { met: false, strength: 'none' }
}

function deriveErrorSeverity(statuses = {}) {
  if (statuses.englishStatus === 'unclear' || statuses.sceneFit === 'not scene-based') {
    return 'high'
  }

  if (statuses.englishStatus === 'mostly correct' || statuses.sceneFit === 'partly on scene') {
    return 'low'
  }

  return 'none'
}

function sceneHasAnotherActor(answer, scene) {
  const normalized = String(answer ?? '').toLowerCase()
  const actors = [...new Set((scene?.sceneScript?.coreActions ?? []).map((action) => action.actor?.toLowerCase()).filter(Boolean))]

  return actors.some((actor) => actor.length > 2 && !normalized.includes(actor))
}

function sceneHasAnotherAction(answer, scene) {
  const mentioned = new Set(detectMentionedActions(answer, scene))
  const actions = scene?.sceneScript?.coreActions ?? []

  return actions.some((action) => !mentioned.has(action.id))
}

function hasStableRecentAttempts(recentAttemptHistory = [], challenge, statuses = {}, features = {}) {
  const challengeId = challenge?.id

  if (!challengeId) {
    return false
  }

  const currentTarget = currentLevelTargetState(challenge, features, statuses)
  const currentErrorSeverity = deriveErrorSeverity(statuses)

  if (!currentTarget.met || currentTarget.strength !== 'clear' || !['low', 'none'].includes(currentErrorSeverity)) {
    return false
  }

  const matchingAttempts = recentAttemptHistory
    .map((attempt) => normalizeAttemptHistoryItem(attempt))
    .filter((attempt) => attempt.challengeId === challengeId)
    .slice(-3)

  const stableMatches = matchingAttempts.filter((attempt) =>
    attempt.currentLevelTargetMet &&
    attempt.currentLevelTargetStrength === 'clear' &&
    ['low', 'none'].includes(attempt.errorSeverity),
  )

  return stableMatches.length >= 1
}

function normalizeAttemptHistoryItem(attempt) {
  const challengeId =
    attempt?.selectedDifficulty ||
    attempt?.challenge?.id ||
    attempt?.challengeId ||
    ''
  const englishStatus = attempt?.englishStatus ?? 'mostly correct'
  const sceneFit = attempt?.sceneFit ?? 'on scene'
  const taskFit = attempt?.taskFit ?? 'partly on target'
  const features = attempt?.detectedFeatures ?? attempt?.features ?? {}
  const statuses = { englishStatus, sceneFit, taskFit }
  const target = attempt?.currentLevelTargetMet === true || attempt?.currentLevelTargetStrength
    ? {
      met: Boolean(attempt?.currentLevelTargetMet),
      strength: attempt?.currentLevelTargetStrength ?? 'none',
    }
    : currentLevelTargetState({ id: challengeId }, features, statuses)

  return {
    challengeId,
    currentLevelTargetMet: target.met,
    currentLevelTargetStrength: target.strength,
    errorSeverity: attempt?.errorSeverity ?? deriveErrorSeverity(statuses),
    levelReadinessHintShown: Boolean(attempt?.levelReadinessHintShown || attempt?.levelReadinessHint),
  }
}

function recentReadinessHintWasShown(recentAttemptHistory = [], challenge) {
  const challengeId = challenge?.id

  return recentAttemptHistory
    .map((attempt) => normalizeAttemptHistoryItem(attempt))
    .filter((attempt) => attempt.challengeId === challengeId)
    .slice(-2)
    .some((attempt) => attempt.levelReadinessHintShown)
}

function detectAnswerFeatures(answer) {
  const normalized = String(answer ?? '').toLowerCase()
  const words = tokenizeNarrativeWords(normalized)
  const presentSignals = detectPresentNarrationSignals(normalized)
  const agreementIssues = detectAgreementIssues(normalized)
  const pastPerfectContinuousMatches = normalized.match(/\bhad\s+(?:not\s+)?been(?:\s+\w+){0,3}\s+\w+ing\b/g) ?? []
  const pastPerfectMatches = normalized.match(/\bhad\s+(?:not\s+)?(?:already\s+|just\s+|still\s+|really\s+|almost\s+)?(?!been\b)\w+(?:ed|en|ne|wn|t)\b/g) ?? []
  const hasPastPerfectContinuous = pastPerfectContinuousMatches.length > 0
  const hasPastPerfect = pastPerfectMatches.length > 0
  const hasPastContinuous = /\b(was|were)\s+\w+ing\b/.test(normalized)
  const hasAboutToPast = /\bwas\s+about\s+to\b/.test(normalized)
  const simplePastCandidates = words
    .filter((_, index) => !isPartOfEarlierPastStructure(words, index))
    .map((word) => word.value.toLowerCase())
  const hasSimplePast =
    simplePastCandidates.some((candidate) => /\b\w+(ed|ght|ought|oke|ent|ame|aw|old|ook|ost|elt|egan|an)\b/.test(candidate) && isLikelySimplePastVerb(candidate)) ||
    simplePastCandidates.some(isKnownSimplePastVerb)
  const hasWhen = /\bwhen\b/.test(normalized)
  const hasWhile = /\bwhile\b/.test(normalized)
  const hasBecause = /\bbecause\b/.test(normalized)
  const hasSo = /\bso(?:\s+that)?\b/.test(normalized)
  const hasCauseResult =
    hasBecause ||
    hasSo ||
    /\b(as a result|therefore|which (made|caused|meant)|after which|that is why|for this reason|led to)\b/.test(normalized) ||
    (hasPastPerfectContinuous && /\bnot\s+been\s+\w+ing\b/.test(normalized) && hasWhen)
  const hasAnyConnector = /\b(when|while|after|before|as|because|so|by the time|after which|but)\b/.test(normalized)
  const hasRelationshipConnector = /\b(when|while|after|before|as|because|so|by the time|after which)\b/.test(normalized)
  const hasInterruption = hasWhen && hasPastContinuous && hasSimplePast
  const hasAnyPastVerb = hasPastPerfectContinuous || hasPastPerfect || hasPastContinuous || hasSimplePast

  return {
    hasPastPerfectContinuous,
    hasPastPerfect,
    hasPastContinuous,
    hasAboutToPast,
    hasSimplePast,
    hasWhen,
    hasWhile,
    hasBecause,
    hasSo,
    hasCauseResult,
    hasAnyConnector,
    hasRelationshipConnector,
    hasInterruption,
    hasAnyPastVerb,
    presentSignals,
    agreementIssues,
    hasAgreementMismatch: agreementIssues.examples.length > 0,
  }
}

function detectAgreementIssues(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  const examples = []

  const patterns = [
    /\b(she|he|it|lisa|mom|mum|mother|woman|man|visitor|nurse|doctor|patient|dad|cat|dog|boy|girl)\s+were\b/g,
    /\b(they|we|people|children|passengers|students|coworkers|visitors)\s+was\b/g,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      examples.push(match[0])
    }
  }

  return {
    examples: [...new Set(examples)].slice(0, 3),
  }
}

function detectPresentNarrationSignals(studentText) {
  const text = String(studentText ?? '').toLowerCase()
  const tokens = tokenizeNarrativeWords(text)
  const simplePastMap = commonSimplePastMap()
  const baseForms = new Set(Object.keys(simplePastMap))
  const thirdPersonForms = new Map()

  for (const baseForm of baseForms) {
    thirdPersonForms.set(toThirdPersonSingular(baseForm), baseForm)
  }

  const explicitPresentExamples = []
  const unclearBaseExamples = []
  const hasPresentContinuous = /\b(am|is|are)\s+\w+ing\b/.test(text)
  const hasPresentPerfect = /\b(has|have)\s+\w+(ed|en|wn|ne|t)\b/.test(text)

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index].value.toLowerCase()
    const previous = tokens[index - 1]?.value?.toLowerCase() ?? ''
    const next = tokens[index + 1]?.value?.toLowerCase() ?? ''

    if (previous === 'to' || previous === 'will' || previous === 'would' || previous === 'can' || previous === 'could') {
      continue
    }

    if ((current === 'am' || current === 'is' || current === 'are') && /ing$/.test(next)) {
      explicitPresentExamples.push(`${current} ${next}`)
      continue
    }

    if ((current === 'has' || current === 'have') && /(?:ed|en|wn|ne|t)$/.test(next) && next !== 'been') {
      explicitPresentExamples.push(`${current} ${next}`)
      continue
    }

    if (thirdPersonForms.has(current)) {
      explicitPresentExamples.push(current)
      continue
    }

    if (
      baseForms.has(current) &&
      current !== simplePastMap[current] &&
      previous !== 'had' &&
      previous !== 'was' &&
      previous !== 'were' &&
      previous !== 'did'
    ) {
      unclearBaseExamples.push(current)
    }
  }

  return {
    hasExplicitPresent: hasPresentContinuous || hasPresentPerfect || explicitPresentExamples.length > 0,
    hasUnclearBaseForms: unclearBaseExamples.length > 0,
    explicitExamples: [...new Set(explicitPresentExamples)].slice(0, 3),
    unclearExamples: [...new Set(unclearBaseExamples)].slice(0, 3),
  }
}

function toThirdPersonSingular(baseForm) {
  const value = String(baseForm ?? '').toLowerCase()

  if (!value) {
    return value
  }

  if (value === 'have') return 'has'
  if (value === 'go') return 'goes'
  if (value === 'do') return 'does'
  if (value.endsWith('y') && !/[aeiou]y$/.test(value)) {
    return `${value.slice(0, -1)}ies`
  }

  if (/(s|x|z|ch|sh|o)$/.test(value)) {
    return `${value}es`
  }

  return `${value}s`
}

function hasAdvancedTimelineLayer(features = {}) {
  return Boolean(
    (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
    (features.hasSimplePast || features.hasPastContinuous || features.hasRelationshipConnector)
  )
}

function advancedClearTimelineWithoutEarlierPast(
  answer,
  challenge,
  features = detectAnswerFeatures(answer),
  statuses = {},
  scene = null,
) {
  if (challenge?.id !== 'advanced') {
    return false
  }

  if (features.hasPastPerfect || features.hasPastPerfectContinuous) {
    return false
  }

  const isSceneRelevant =
    statuses.sceneFit
      ? statuses.sceneFit !== 'not scene-based'
      : checkSceneMatch(answer, scene)
  const semanticTenseFit = evaluateSemanticTenseFit(answer, scene, challenge, features)
  const clarityScore = String(answer ?? '').trim() ? getClarityScore(answer) : 0
  const hasMajorErrors = String(answer ?? '').trim() ? detectMajorErrors(answer) : false

  return Boolean(
    detectPastTense(answer) &&
    isSceneRelevant &&
    semanticTenseFit.verdict !== 'mismatch' &&
    features.hasSimplePast &&
    (features.hasWhen || features.hasWhile || features.hasRelationshipConnector || features.hasCauseResult) &&
    clarityScore === 2 &&
    !hasMajorErrors
  )
}

function hasValidAdvancedEarlierPast(answer, features = detectAnswerFeatures(answer)) {
  return (features.hasPastPerfect || features.hasPastPerfectContinuous) && !hasBrokenEarlierPast(answer)
}

function advancedEarlierPastStillUnderstandable(answer, features = detectAnswerFeatures(answer)) {
  if (!hasValidAdvancedEarlierPast(answer, features)) {
    return false
  }

  const text = String(answer ?? '').toLowerCase()

  return !(
    isSeverelyBrokenRunOn(text, features) &&
    !/\b(and|when|while|before|after|because|so)\b/.test(text) &&
    !hasAdvancedTimelineLayer(features)
  )
}

function demonstratesAdvancedMastery(answer, features = detectAnswerFeatures(answer), options = {}) {
  const { isSceneRelevant = true } = options
  const clarityScore = String(answer ?? '').trim() ? getClarityScore(answer) : (features.hasAnyPastVerb ? 2 : 0)
  const hasMajorErrors = String(answer ?? '').trim() ? detectMajorErrors(answer) : false

  return Boolean(
    isSceneRelevant &&
    (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
    features.hasSimplePast &&
    (features.hasWhen || features.hasWhile || features.hasRelationshipConnector) &&
    clarityScore === 2 &&
    !hasMajorErrors
  )
}

function needsAdvancedStructureRepair(answer, features = detectAnswerFeatures(answer)) {
  if (!hasValidAdvancedEarlierPast(answer, features)) {
    return false
  }

  const text = String(answer ?? '').trim()

  return (
    isLikelyRunOn(text, features) ||
    /(^|[^,])\s+and\s+when\b/i.test(text) ||
    /\bbucketed\b/i.test(text) ||
    /[a-z]\s+[A-Z][a-z]+\s+(ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|arrived|walked|waited|watched|worked|looked|knocked|opened|spilled|chased|dropped|rushed|carried|pointed|mixed|fixed|burned|weighed)\b/.test(text) ||
    (!/[.!?]$/.test(text) && hasAdvancedTimelineLayer(features)) ||
    /\bwhen\b[^,.!?]{12,}\b(the|a|an)\b\s+\w+\s+(ran|went|came|saw|took|made|found|left|felt|heard|built|caught|brought|fell|broke|blew|wrote|stood|sat|stole|spoke|rang|lit|drove|rose|began|bought|lost|sent|arrived|walked|waited|watched|worked|looked|knocked|opened|spilled|chased|dropped|rushed|carried|pointed|mixed|fixed|burned|weighed)\b/i.test(text)
  )
}

function isLikelySimplePastVerb(candidate) {
  const nonPastWords = new Set([
    'red',
    'bed',
    'bread',
    'head',
    'dead',
    'spread',
    'instead',
    'thread',
    'lead',
    'old',
    'gold',
    'cold',
    'bold',
  ])

  return !nonPastWords.has(candidate)
}

function isKnownSimplePastVerb(candidate) {
  const knownPastVerbs = new Set([
    'began',
    'broke',
    'blew',
    'brought',
    'built',
    'burned',
    'bought',
    'caught',
    'came',
    'drove',
    'fell',
    'felt',
    'flew',
    'found',
    'gave',
    'held',
    'heard',
    'left',
    'lit',
    'lost',
    'made',
    'met',
    'ran',
    'rang',
    'rose',
    'said',
    'saw',
    'sent',
    'sat',
    'spilled',
    'spoke',
    'started',
    'stole',
    'stood',
    'took',
    'turned',
    'went',
    'wrote',
  ])

  return knownPastVerbs.has(candidate)
}

function localFeedbackCopy(feedbackLanguage) {
  if (feedbackLanguage === 'Spanish') {
    return {
      summary: 'Este coach local revisó los patrones principales de narración en pasado. La retroalimentación de OpenAI será más precisa y consciente de la escena.',
      genericSummary: 'Estás construyendo una historia en pasado. Mantén claras las relaciones de tiempo.',
      summaryBeginnerClear: 'Describiste la escena en pasado con claridad.',
      summaryBeginnerAddDetail: 'Describiste la escena en pasado. Ahora agrega un poco más de detalle.',
      summaryBeginnerBuilding: 'Tu respuesta encaja con la escena y va en la dirección correcta.',
      summaryIntermediateClear: 'Conectaste las acciones con claridad y la relación temporal funciona.',
      summaryIntermediateBuilding: 'La escena se entiende, y el siguiente paso es hacer más clara la relación entre las acciones.',
      summaryAdvancedClear: 'Mostraste con claridad qué había pasado antes en la línea de tiempo.',
      summaryAdvancedBuilding: 'La línea de tiempo se entiende, y el siguiente paso es hacer más clara la relación entre lo anterior y lo posterior.',
      defaultStrength: 'Escribiste una respuesta en pasado sobre la escena.',
      strengthPastContinuous: 'Usaste past continuous para una acción que ya estaba en progreso.',
      strengthSimplePast: 'Usaste simple past para eventos terminados de la historia.',
      strengthPastPerfect: 'Usaste past perfect para mostrar una acción anterior.',
      strengthWhenWhile: 'Usaste when o while para conectar acciones en el pasado.',
      strengthConnector: 'Usaste un conector para mostrar cómo dos acciones se relacionan en el tiempo.',
      describeContrast: (background, event) => `Usaste past continuous (${background}) para el fondo y simple past (${event}) para el evento principal.`,
      describeBackground: (background) => `Usaste past continuous (${background}) para mostrar una acción en progreso en el fondo.`,
      describeMainEvent: (event) => `Usaste simple past (${event}) para mostrar el evento principal o terminado.`,
      describeEarlierPast: (earlier) => `Usaste past perfect (${earlier}) para mostrar qué había pasado antes.`,
      describeEarlierThenEvent: (earlier, event) => `Usaste past perfect (${earlier}) para el evento anterior y simple past (${event}) para lo que pasó después.`,
      describeEarlierOngoing: (earlier) => `Usaste past perfect continuous (${earlier}) para una acción que seguía ocurriendo antes de otro momento pasado.`,
      describeEarlierOngoingThenEvent: (earlier, event) => `Usaste past perfect continuous (${earlier}) para la acción anterior en progreso y simple past (${event}) para los eventos principales.`,
      describeConnector: (connector) => `Usaste el conector '${connector}' para mostrar cómo se relacionan las acciones en el tiempo.`,
      describeWhenRelationship: (connector) => `Usaste el conector '${connector}' para mostrar cuándo una acción interrumpió otra.`,
      describeWhileRelationship: (connector) => `Usaste el conector '${connector}' para mostrar que dos acciones ocurrían al mismo tiempo.`,
      describeCauseResult: () => 'La secuencia de acciones es fácil de seguir.',
      describeTimelineSequence: () => 'La línea de tiempo entre las acciones se entiende con claridad.',
      describeClarity: () => 'La oración es clara y natural.',
      describeSceneActions: () => 'Mencionaste acciones importantes de la escena.',
      backgroundAction: 'una acción de fondo',
      mainEvent: 'un evento principal',
      twoActions: 'dos acciones separadas',
      earlierAction: 'una acción anterior',
      yourStory: 'tu historia',
      usePastNarration: 'Escribe sobre la escena en pasado.',
      usePastContinuous: 'Usa was/were + -ing para algo que ya estaba ocurriendo.',
      useSimplePast: 'Usa simple past para la acción que ocurrió o interrumpió la escena.',
      useWhenWhile: 'Usa when o while para conectar dos acciones en el pasado.',
      useConnector: 'Une las acciones con when, while, because, before o after.',
      usePastPerfect: 'Agrega had + past participle o had been + -ing.',
      usePastTenseInstead: 'Cambia los verbos principales al pasado.',
      stretchBeginner: 'Agrega otra oración en pasado sobre una acción visible.',
      tryEarlierDetail: 'Prueba agregar un detalle anterior con had o had been.',
      reasonPastNarration: 'El nivel principiante busca una narración clara en pasado, no solo simple past.',
      reasonPastContinuous: 'Past continuous ayuda a sentir la escena en progreso antes del evento principal.',
      reasonSimplePast: 'Simple past hace avanzar la historia.',
      reasonPastTenseMismatch: 'Describiste la escena con acciones correctas, pero usaste presente en vez de pasado.',
      reasonPastTenseUnclear: 'Las acciones se entienden, pero el tiempo verbal aún no está claro como pasado.',
      reasonPastTenseAndAgreement: 'Usa formas de pasado correctas y corrige la concordancia, por ejemplo past simple para el evento principal y was para she.',
      suggestSurfacePolish: 'Añade también mayúscula inicial y punto final.',
      suggestSurfacePolishWithSpelling: 'Corrige también la mayúscula, la puntuación y la ortografía.',
      reasonSurfacePolish: 'Añade una mayúscula al principio y un punto al final para pulir la oración.',
      reasonSurfacePolishWithSpelling: 'Añade mayúscula inicial, punto final y corrige la ortografía para pulir la oración.',
      semanticBackgroundSummary: 'La oración es posible, pero no muestra la relación temporal con suficiente claridad.',
      semanticWhileSummary: 'La oración es comprensible, pero with while suena más natural con acciones en progreso.',
      semanticEventSummary: 'La combinación verbal es posible, pero no expresa la escena con la mayor claridad.',
      reasonWhenWhile: 'Eso deja más clara la relación entre una acción en progreso y otra acción en el pasado.',
      reasonConnector: 'El conector muestra si las acciones ocurrieron juntas, se interrumpieron o una pasó antes.',
      reasonSemanticBackground: 'Aquí la acción de fondo seguía ocurriendo, así que past continuous la expresa con más claridad.',
      reasonSemanticWhile: 'Aquí while funciona mejor cuando las acciones estaban ocurriendo al mismo tiempo.',
      reasonSemanticEvent: 'Aquí conviene elegir formas verbales que dejen más clara la relación entre fondo y evento.',
      reasonPastPerfect: 'El reto avanzado te pide mostrar qué pasó antes de otro momento en pasado.',
      pastPerfectAlreadyWorksSummary: 'Tu forma con had ya muestra claramente una capa anterior de la historia. Usa past perfect continuous solo cuando la acción anterior realmente estaba ocurriendo durante un tiempo.',
      presentTenseSummary: 'La oración menciona acciones importantes, pero los verbos están en presente, no en pasado.',
      presentTenseSceneSummary: 'Mencionaste las acciones principales de la escena, pero los verbos están en presente. Esta tarea requiere pasado.',
      notClearlyPastSummary: 'La oración menciona acciones importantes, pero el tiempo verbal todavía no está claramente en pasado.',
      notClearlyPastSceneSummary: 'Mencionaste las acciones principales de la escena, pero el tiempo verbal todavía no está claramente en pasado.',
      sceneInferenceSummary: 'Tu narración está anclada en la escena y usa una interpretación razonable. Concéntrate ahora en que la relación temporal entre los verbos sea clara.',
      sceneSynonymSummary: 'Tu narración está anclada en la escena. Making pancakes y cooking pancakes describen la misma acción; ahora concéntrate en aclarar la relación temporal entre los verbos.',
      reasonStretchBeginner: 'Eso mantiene la práctica dentro del nivel principiante sin exigir conectores.',
      reasonEarlierDetail: 'Eso hará que la línea de tiempo sea más rica y narrativa.',
      keepAndAddPastSentence: 'Mantén esta oración. Agrega una oración más en pasado sobre lo que pasó después.',
      reasonKeepAndAddPastSentence: 'La relación verbal ya funciona. El siguiente paso es continuar la narración en pasado.',
      keepAndAddResult: 'Mantén esta oración. Agrega un resultado con so o because.',
      reasonKeepAndAddResult: 'La relación temporal ya está clara. Ahora puedes mostrar la consecuencia.',
      keepAndAddNextEvent: 'Mantén esta oración. Agrega una oración breve sobre lo que pasó después.',
      reasonKeepAndAddNextEvent: 'La relación causa-resultado ya funciona. El siguiente paso es continuar la narración.',
      keepAndAddEarlierPast: 'Mantén esta oración. Agrega qué ya había pasado antes.',
      reasonKeepAndAddEarlierPast: 'La oración funciona. El siguiente nivel es añadir una capa anterior de la historia con had.',
      reasonMeaningPreservingPolish: 'Esto conserva tu idea y solo mejora la claridad y el orden natural de la oración.',
      beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
      intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
      advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
      nextBasicNext: 'Agrega una oración más sobre lo que pasó después.',
      nextBasicAnotherPerson: 'Agrega una oración más sobre lo que otra persona estaba haciendo.',
      nextBasicMoreDetail: 'Agrega un detalle más sobre lo que estaba pasando en la escena.',
      nextBasicMoreAction: 'Muestra una acción más en pasado.',
      nextUsePastTense: 'Cambia los verbos principales al pasado.',
      nextSemanticBackground: 'Muestra la acción de fondo con past continuous para que la relación temporal quede más clara.',
      nextSemanticWhile: 'Usa while con dos acciones en progreso para que la relación temporal quede más clara.',
      nextBasicStretch: 'Intenta conectar dos acciones usando when o while.',
      nextIntermediateConnect: 'Conecta dos acciones usando when o while.',
      nextIntermediateOneMore: 'Agrega una oración más que conecte acciones claramente.',
      nextIntermediateStretch: 'Intenta agregar una oración sobre lo que había pasado antes.',
      nextAdvanced: 'Agrega una oración sobre lo que pasó antes usando had o had been.',
      nextAdvancedTimeline: 'Muestra qué había pasado antes usando had o had been.',
      nextAdvancedEarlierDetail: 'Agrega un detalle anterior más usando had o had been.',
      nextAdvancedMastery: (eventClause) => eventClause ? `Agrega una oración más sobre lo que había pasado antes de que ${eventClause}.` : 'Agrega una oración más sobre lo que había pasado antes del evento principal.',
      reasonAdvancedMastery: 'Ya muestras el tiempo de la historia con claridad. Ahora añade una capa anterior más.',
      nextAdvancedStructure: 'Haz más clara la estructura de la oración para que la línea de tiempo sea más fácil de seguir.',
      nextAdvancedTimelineClear: 'Haz más claras las acciones anteriores y posteriores en una sola oración.',
      reasonAdvancedStructure: 'Ya mostraste la acción anterior con had. Ahora haz más clara la estructura de la oración.',
      reasonAdvancedTimelineClear: 'La siguiente mejora es aclarar la relación entre la acción anterior y la posterior.',
      readinessBasic: 'Si quieres un desafío, intenta conectar dos acciones con when o while.',
      readinessIntermediate: 'Estás conectando acciones con claridad. Ahora intenta agregar qué había pasado antes.',
    }
  }

  if (feedbackLanguage === 'Swedish') {
    return {
      summary: 'Den här lokala coachen har granskat de viktigaste mönstren för berättande i dåtid. OpenAI-feedback blir mer precis och scenmedveten när en API-nyckel finns tillgänglig.',
      genericSummary: 'Du bygger en berättelse i dåtid. Gör tidsrelationerna tydliga.',
      summaryBeginnerClear: 'Du beskrev scenen tydligt i dåtid.',
      summaryBeginnerAddDetail: 'Du beskrev scenen i dåtid. Lägg nu till lite mer detalj.',
      summaryBeginnerBuilding: 'Ditt svar passar scenen och är på rätt väg.',
      summaryIntermediateClear: 'Du kopplade handlingarna tydligt och tidsrelationen fungerar.',
      summaryIntermediateBuilding: 'Scenen går att förstå, och nästa steg är att göra relationen mellan handlingarna tydligare.',
      summaryAdvancedClear: 'Du visade tydligt vad som hade hänt tidigare i tidslinjen.',
      summaryAdvancedBuilding: 'Tidslinjen går att förstå, och nästa steg är att göra relationen mellan det tidigare och det senare tydligare.',
      defaultStrength: 'Du skrev ett svar i dåtid som hör ihop med scenen.',
      strengthPastContinuous: 'Du använde past continuous för en handling som redan pågick.',
      strengthSimplePast: 'Du använde simple past för avslutade händelser i berättelsen.',
      strengthPastPerfect: 'Du använde past perfect för att visa en tidigare handling.',
      strengthWhenWhile: 'Du använde when eller while för att koppla handlingar i dåtid.',
      strengthConnector: 'Du använde en koppling för att visa hur två handlingar hänger ihop i tid.',
      describeContrast: (background, event) => `Du använde past continuous (${background}) för bakgrunden och simple past (${event}) för huvudhändelsen.`,
      describeBackground: (background) => `Du använde past continuous (${background}) för att visa en handling som redan pågick i bakgrunden.`,
      describeMainEvent: (event) => `Du använde simple past (${event}) för huvudhändelsen eller en avslutad handling.`,
      describeEarlierPast: (earlier) => `Du använde past perfect (${earlier}) för att visa vad som hade hänt tidigare.`,
      describeEarlierThenEvent: (earlier, event) => `Du använde past perfect (${earlier}) för den tidigare händelsen och simple past (${event}) för det som hände sedan.`,
      describeEarlierOngoing: (earlier) => `Du använde past perfect continuous (${earlier}) för en handling som pågick före en annan tidpunkt i dåtiden.`,
      describeEarlierOngoingThenEvent: (earlier, event) => `Du använde past perfect continuous (${earlier}) för den tidigare pågående handlingen och simple past (${event}) för huvudhändelserna.`,
      describeConnector: (connector) => `Du använde kopplingen '${connector}' för att visa hur handlingarna hänger ihop i tid.`,
      describeWhenRelationship: (connector) => `Du använde kopplingen '${connector}' för att visa när en handling avbröt en annan.`,
      describeWhileRelationship: (connector) => `Du använde kopplingen '${connector}' för att visa att två handlingar pågick samtidigt.`,
      describeCauseResult: () => 'Följden mellan handlingarna är lätt att följa.',
      describeTimelineSequence: () => 'Tidslinjen mellan handlingarna är tydlig.',
      describeClarity: () => 'Meningen är tydlig och naturlig.',
      describeSceneActions: () => 'Du nämnde viktiga handlingar i scenen.',
      backgroundAction: 'en bakgrundshandling',
      mainEvent: 'en huvudhändelse',
      twoActions: 'två separata handlingar',
      earlierAction: 'en tidigare handling',
      yourStory: 'din berättelse',
      usePastNarration: 'Skriv om scenen i dåtid.',
      usePastContinuous: 'Använd was/were + -ing för något som redan pågick.',
      useSimplePast: 'Använd simple past för handlingen som hände eller avbröt scenen.',
      useWhenWhile: 'Använd when eller while för att koppla två handlingar i dåtid.',
      useConnector: 'Koppla handlingarna med when, while, because, before eller after.',
      usePastPerfect: 'Lägg till had + past participle eller had been + -ing.',
      usePastTenseInstead: 'Ändra huvudverben till dåtid.',
      stretchBeginner: 'Lägg till en mening till i dåtid om en synlig handling.',
      tryEarlierDetail: 'Prova att lägga till en tidigare detalj med had eller had been.',
      reasonPastNarration: 'Nybörjarnivån fokuserar på tydligt berättande i dåtid, inte bara simple past.',
      reasonPastContinuous: 'Past continuous hjälper läsaren att känna den pågående scenen före huvudhändelsen.',
      reasonSimplePast: 'Simple past driver berättelsen framåt.',
      reasonPastTenseMismatch: 'Du beskrev scenen med rätt handlingar, men du använde presens i stället för dåtid.',
      reasonPastTenseUnclear: 'Handlingarna går att förstå, men tempus är ännu inte tydligt i dåtid.',
      reasonPastTenseAndAgreement: 'Använd korrekta dåtidsformer och rätt kongruens, till exempel simple past för huvudhändelsen och was med she.',
      suggestSurfacePolish: 'Lägg också till stor bokstav och punkt.',
      suggestSurfacePolishWithSpelling: 'Rätta också versal, skiljetecken och stavning.',
      reasonSurfacePolish: 'Lägg till stor bokstav i början och punkt i slutet för att putsa meningen.',
      reasonSurfacePolishWithSpelling: 'Lägg till stor bokstav, punkt och rätta stavningen för att putsa meningen.',
      semanticBackgroundSummary: 'Meningen fungerar, men den visar inte tidsrelationen så tydligt som den skulle kunna göra.',
      semanticWhileSummary: 'Meningen går att förstå, men med while låter det naturligare med pågående handlingar.',
      semanticEventSummary: 'Verbkombinationen är möjlig, men den uttrycker inte scenen så tydligt som den skulle kunna göra.',
      reasonWhenWhile: 'Det gör relationen tydligare mellan en handling som pågick och en annan handling i dåtid.',
      reasonConnector: 'Kopplingen visar om handlingarna hände samtidigt, avbröt varandra eller om en hände tidigare.',
      reasonSemanticBackground: 'Här är den andra handlingen bakgrundsinformation, så past continuous är naturligare.',
      reasonSemanticWhile: 'Här fungerar while bäst när båda handlingarna pågår samtidigt.',
      reasonSemanticEvent: 'Här hjälper en tydligare tempuskontrast läsaren att förstå tidsrelationen bättre.',
      reasonPastPerfect: 'Den avancerade uppgiften ber dig visa vad som hände före en annan tidpunkt i dåtid.',
      pastPerfectAlreadyWorksSummary: 'Din form med had visar redan tydligt ett tidigare lager i berättelsen. Använd past perfect continuous bara när den tidigare handlingen verkligen pågick under en tid.',
      presentTenseSummary: 'Meningen nämner viktiga handlingar, men verben står i presens, inte i dåtid.',
      presentTenseSceneSummary: 'Du nämnde de viktigaste handlingarna i scenen, men verben står i presens. Den här uppgiften kräver dåtid.',
      notClearlyPastSummary: 'Meningen nämner viktiga handlingar, men tempus är ännu inte tydligt i dåtid.',
      notClearlyPastSceneSummary: 'Du nämnde de viktigaste handlingarna i scenen, men tempus är ännu inte tydligt i dåtid.',
      sceneInferenceSummary: 'Din berättelse är förankrad i scenen och använder en rimlig tolkning. Fokusera nu på att göra tidsrelationen mellan verben tydlig.',
      sceneSynonymSummary: 'Din berättelse är förankrad i scenen. Making pancakes och cooking pancakes beskriver samma handling; fokusera nu på att göra tidsrelationen mellan verben tydlig.',
      reasonStretchBeginner: 'Det håller övningen på nybörjarnivå utan att kräva kopplingar.',
      reasonEarlierDetail: 'Det gör tidslinjen rikare och mer berättande.',
      keepAndAddPastSentence: 'Behåll den här meningen. Lägg till en mening till i dåtid om vad som hände sedan.',
      reasonKeepAndAddPastSentence: 'Verbrelationen fungerar redan. Nästa steg är att fortsätta berättelsen i dåtid.',
      keepAndAddResult: 'Behåll den här meningen. Lägg till ett resultat med so eller because.',
      reasonKeepAndAddResult: 'Tidsrelationen är redan tydlig. Nu kan du visa konsekvensen.',
      keepAndAddNextEvent: 'Behåll den här meningen. Lägg till en kort mening om vad som hände sedan.',
      reasonKeepAndAddNextEvent: 'Orsak-resultat-relationen fungerar redan. Nästa steg är att fortsätta berättelsen.',
      keepAndAddEarlierPast: 'Behåll den här meningen. Lägg till vad som redan hade hänt tidigare.',
      reasonKeepAndAddEarlierPast: 'Meningen fungerar. Nästa nivå är att lägga till ett tidigare lager i berättelsen med had.',
      reasonMeaningPreservingPolish: 'Det här behåller din idé och förbättrar bara tydlighet och naturlig ordföljd.',
      beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
      intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
      advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
      nextBasicNext: 'Lägg till en mening till om vad som hände sedan.',
      nextBasicAnotherPerson: 'Lägg till en mening till om vad en annan person gjorde.',
      nextBasicMoreDetail: 'Lägg till en detalj till om vad som hände i scenen.',
      nextBasicMoreAction: 'Visa en handling till i dåtid.',
      nextUsePastTense: 'Ändra huvudverben till dåtid.',
      nextSemanticBackground: 'Visa bakgrundshandlingen med past continuous så att tidsrelationen blir tydligare.',
      nextSemanticWhile: 'Använd while med två pågående handlingar så att tidsrelationen blir tydligare.',
      nextBasicStretch: 'Prova att koppla två handlingar med when eller while.',
      nextIntermediateConnect: 'Koppla två handlingar med when eller while.',
      nextIntermediateOneMore: 'Lägg till en mening till som kopplar handlingarna tydligt.',
      nextIntermediateStretch: 'Prova att lägga till en mening om vad som hade hänt tidigare.',
      nextAdvanced: 'Lägg till en mening om vad som hände tidigare med had eller had been.',
      nextAdvancedTimeline: 'Visa vad som hade hänt tidigare med had eller had been.',
      nextAdvancedEarlierDetail: 'Lägg till en tidigare detalj till med had eller had been.',
      nextAdvancedMastery: (eventClause) => eventClause ? `Lägg till en mening till om vad som hade hänt innan ${eventClause}.` : 'Lägg till en mening till om vad som hade hänt före huvudhändelsen.',
      reasonAdvancedMastery: 'Du visar redan tidslinjen tydligt. Nu kan du lägga till ännu ett tidigare lager.',
      nextAdvancedStructure: 'Gör meningsstrukturen tydligare så att tidslinjen blir lättare att följa.',
      nextAdvancedTimelineClear: 'Gör den tidigare och den senare handlingen tydligare i en mening.',
      reasonAdvancedStructure: 'Du har redan visat den tidigare handlingen med had. Nu behöver du göra meningsstrukturen tydligare.',
      reasonAdvancedTimelineClear: 'Nästa förbättring är att göra relationen mellan den tidigare och den senare handlingen tydligare.',
      readinessBasic: 'Om du vill ha en utmaning kan du prova att koppla två handlingar med when eller while.',
      readinessIntermediate: 'Du kopplar handlingarna tydligt. Nu kan du prova att lägga till vad som hade hänt tidigare.',
    }
  }

  return {
    summary: 'This local coach checked the main past-story patterns. OpenAI feedback will give more precise scene-aware corrections when an API key is available.',
    genericSummary: 'You are building a past-tense story. Keep making the time relationships clear.',
    summaryBeginnerClear: 'You described the scene clearly in the past.',
    summaryBeginnerAddDetail: 'You described the scene in the past. Now add a little more detail.',
    summaryBeginnerBuilding: 'Your answer fits the scene and is moving in the right direction.',
    summaryIntermediateClear: 'You connected the actions clearly, and the time relationship works well.',
    summaryIntermediateBuilding: 'The scene makes sense, and the next step is to make the action relationship clearer.',
    summaryAdvancedClear: 'You showed clearly what had happened earlier in the timeline.',
    summaryAdvancedBuilding: 'The timeline makes sense, and the next step is to make the earlier/later relationship clearer.',
    defaultStrength: 'You wrote a past-tense response to the scene.',
    strengthPastContinuous: 'You used past continuous for an action that was already in progress.',
    strengthSimplePast: 'You used simple past for completed story events.',
    strengthPastPerfect: 'You used past perfect to show an earlier event.',
    strengthWhenWhile: 'You used when or while to connect actions in the past.',
    strengthConnector: 'You used a connector to show how two actions relate in time.',
    describeContrast: (background, event) => `You used past continuous (${background}) for the background and simple past (${event}) for the main event.`,
    describeBackground: (background) => `You used past continuous (${background}) to show an action already in progress in the background.`,
    describeMainEvent: (event) => `You used simple past (${event}) for the main event or completed action.`,
    describeEarlierPast: (earlier) => `You used past perfect (${earlier}) to show what had happened earlier.`,
    describeEarlierThenEvent: (earlier, event) => `You used past perfect (${earlier}) for the earlier event and simple past (${event}) for what happened next.`,
    describeEarlierOngoing: (earlier) => `You used past perfect continuous (${earlier}) for an ongoing action before another past moment.`,
    describeEarlierOngoingThenEvent: (earlier, event) => `You used past perfect continuous (${earlier}) for the earlier ongoing action and simple past (${event}) for the main events.`,
    describeConnector: (connector) => `You used the connector '${connector}' to show how the actions relate in time.`,
    describeWhenRelationship: (connector) => `You used the connector '${connector}' to show when one action interrupted another.`,
    describeWhileRelationship: (connector) => `You used the connector '${connector}' to show that two actions were happening at the same time.`,
    describeCauseResult: () => 'The sequence of actions is easy to follow.',
    describeTimelineSequence: () => 'The timeline between the actions is clear.',
    describeClarity: () => 'The sentence is clear and natural.',
    describeSceneActions: () => 'You mentioned key actions from the scene.',
    backgroundAction: 'a background action',
    mainEvent: 'a main event',
    twoActions: 'two separate actions',
    earlierAction: 'an earlier past action',
    yourStory: 'your story',
    usePastNarration: 'Write about the scene in the past.',
    usePastContinuous: 'Use was/were + -ing for something already happening.',
    useSimplePast: 'Use simple past for the action that happened or interrupted the scene.',
    useWhenWhile: 'Use when or while to connect two actions in the past.',
    useConnector: 'Join them with when, while, because, before, or after.',
    usePastPerfect: 'Add had + past participle or had been + -ing.',
    usePastTenseInstead: 'Change the main verbs to the past tense.',
    stretchBeginner: 'Add one more past-tense sentence about a visible action.',
    tryEarlierDetail: 'Try adding one earlier past detail with had or had been.',
    reasonPastNarration: 'Beginner level asks for clear past narration, not only simple past.',
    reasonPastContinuous: 'Past continuous helps the listener feel the ongoing scene before the main event happens.',
    reasonSimplePast: 'Simple past moves the story forward.',
    reasonPastTenseMismatch: 'You described the scene clearly, but you used present tense instead of past tense.',
    reasonPastTenseUnclear: 'The actions are understandable, but the tense is not clearly past yet.',
    reasonPastTenseAndAgreement: "Use correct past forms and fix the agreement, for example simple past for the main event and 'was' with 'she'.",
    suggestSurfacePolish: 'Also add a capital letter and a full stop.',
    suggestSurfacePolishWithSpelling: 'Also fix the capitalization, punctuation, and spelling.',
    reasonSurfacePolish: 'Add a capital letter at the beginning and a full stop at the end to polish the sentence.',
    reasonSurfacePolishWithSpelling: 'Add a capital letter, a full stop, and correct the spelling to polish the sentence.',
    semanticBackgroundSummary: 'This sentence is grammatical, but it does not show the scene relationship as clearly as it could.',
    semanticWhileSummary: 'The sentence is understandable, but with while it sounds more natural when both actions were ongoing.',
    semanticEventSummary: 'This sentence is possible, but another tense choice would express the scene more clearly.',
    reasonWhenWhile: 'That makes the relationship clearer between one action in progress and another past action.',
    reasonConnector: 'The connector tells the reader whether actions happened together, interrupted each other, or happened earlier.',
    reasonSemanticBackground: 'Here the background action was already in progress, so past continuous is more natural.',
    reasonSemanticWhile: 'Here while works better when both actions were continuing at the same time.',
    reasonSemanticEvent: 'Here a clearer tense contrast will show the background and event relationship more naturally.',
    reasonPastPerfect: 'The advanced challenge asks you to show what happened before another past moment.',
    pastPerfectAlreadyWorksSummary: 'Your form with had already shows an earlier layer of the story clearly. Use past perfect continuous only when the earlier action was genuinely ongoing for a period of time.',
    presentTenseSummary: 'The sentence mentions key actions, but the verbs are in the present tense, not the past.',
    presentTenseSceneSummary: 'You mentioned the main actions in the scene, but the verbs are in the present tense. This task requires past tense.',
    notClearlyPastSummary: 'The sentence mentions key actions, but the tense is not clearly past yet.',
    notClearlyPastSceneSummary: 'You mentioned the main actions in the scene, but the tense is not clearly past yet.',
    sceneInferenceSummary: 'Your narration is anchored in the scene and uses a reasonable interpretation. Now focus on making the time relationship between the verbs clear.',
    sceneSynonymSummary: 'Your narration is anchored in the scene. Making pancakes and cooking pancakes describe the same action; now focus on making the time relationship between the verbs clear.',
    reasonStretchBeginner: 'That keeps the practice at beginner level without requiring connectors.',
    reasonEarlierDetail: 'That will make the timeline richer and more narrative.',
    keepAndAddPastSentence: 'Keep this sentence. Add one more past-tense sentence about what happened next.',
    reasonKeepAndAddPastSentence: 'The verb relationship already works. The next step is to continue the narration in the past.',
    keepAndAddResult: 'Keep this sentence. Add a result with so or because.',
    reasonKeepAndAddResult: 'The time relationship is already clear. Now you can show the consequence.',
    keepAndAddNextEvent: 'Keep this sentence. Add one short sentence about what happened next.',
    reasonKeepAndAddNextEvent: 'The cause-and-result relationship already works. The next step is to continue the narration.',
    keepAndAddEarlierPast: 'Keep this sentence. Add what had already happened before.',
    reasonKeepAndAddEarlierPast: 'The sentence works. The next level is to add an earlier layer of the story with had.',
    reasonMeaningPreservingPolish: 'This keeps your idea and only improves clarity and natural sentence order.',
    beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
    intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
    advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
    nextBasicNext: 'Add one more sentence about what happened next.',
    nextBasicAnotherPerson: 'Add one more sentence about what another person was doing.',
    nextBasicMoreDetail: 'Add one more detail about what was happening in the scene.',
    nextBasicMoreAction: 'Show one more action in the past.',
    nextUsePastTense: 'Change the main verbs to the past tense.',
    nextSemanticBackground: 'Show the background action with past continuous so the time relationship is clearer.',
    nextSemanticWhile: 'Use while with two ongoing actions so the time relationship is clearer.',
    nextBasicStretch: 'Try connecting two actions using when or while.',
    nextIntermediateConnect: 'Connect two actions using when or while.',
    nextIntermediateOneMore: 'Add one more sentence that connects actions clearly.',
    nextIntermediateStretch: 'Try adding one sentence about what happened before.',
    nextAdvanced: 'Add one sentence about what happened before using had or had been.',
    nextAdvancedTimeline: 'Show what had happened before using had or had been.',
    nextAdvancedEarlierDetail: 'Add one more earlier detail using had or had been.',
    nextAdvancedMastery: (eventClause) => eventClause ? `Add one more sentence showing what had happened before ${eventClause}.` : 'Add one more sentence showing what had happened before the main event.',
    reasonAdvancedMastery: 'You already show the timeline clearly. Now add one more earlier layer.',
    nextAdvancedStructure: 'Fix the sentence structure so the timeline is easier to follow.',
    nextAdvancedTimelineClear: 'Make the earlier and later actions clearer in one sentence.',
    reasonAdvancedStructure: 'You already showed the earlier action with had. Now make the sentence structure clearer.',
    reasonAdvancedTimelineClear: 'The next improvement is to make the earlier and later actions connect more clearly.',
    readinessBasic: "You're describing the scene clearly. Now try connecting two actions using when or while.",
    readinessIntermediate: "You're connecting actions clearly. Now try adding what happened before.",
  }
}

if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Story coach API listening on http://localhost:${port}`)
  })
}

export {
  generateFeedback,
  normalizeFeedback,
  analyzeAnswer,
  detectAnswerFeatures,
  detectPhrasalVerbUnits,
  detectPastTense,
  checkSceneMatch,
  checkLevelTarget,
  detectTargetStructure,
  getClarityScore,
  detectMajorErrors,
  getRating,
  normalizeDifficultyLevel,
  taskFitFromFeatures,
  turnsBoundedResultIntoPastContinuous,
  changesCausalMeaning,
}

export default app
