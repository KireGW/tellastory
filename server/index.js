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
  const { answer, scene, challenge, feedbackLanguage = 'English' } = request.body ?? {}

  if (!answer || !scene?.title) {
    response.status(400).json({ error: 'Missing answer or scene.' })
    return
  }

  try {
    if (!openai) {
      response.json(localFeedback(answer, scene, challenge, feedbackLanguage))
      return
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
            challenge,
            feedbackLanguage,
            studentAnswer: answer,
            task:
              `Evaluate the student answer as a past-tense narration. Write all coaching, explanations, and next-step text in ${feedbackLanguage}. Keep corrected English example sentences, verb-form names, and quoted student text in English. Use a qualitative coaching verdict. Do not return or mention numeric ratings.`,
          }),
        },
      ],
    })

    response.json(normalizeFeedback(JSON.parse(completion.choices[0].message.content), scene, challenge, feedbackLanguage, answer))
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'Could not generate feedback.' })
  }
})

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
Treat past perfect and past perfect continuous as related but different tools. Do not require past perfect continuous when plain past perfect is more natural.
Use past perfect continuous only for earlier actions that were genuinely ongoing for a period of time, such as "had been waiting", "had been cooking", or "had been looking". Do not suggest unnatural forms such as "had been forgetting", "had been leaving a suitcase", "had been dropping", "had been noticing", or "had been arriving" when a completed earlier event or resulting state is meant.
Do not say that "had forgotten" is only an attempt, unclear, or less correct because forgetting can be momentary. "Had forgotten", "had left", "had missed", and similar forms are normal past perfect forms for completed earlier events or resulting earlier states.
If the English is correct but the answer does not describe the scene, do not call the English wrong. Say that the English is correct, but the answer is not clearly anchored in the picture. Use a lower coaching verdict because the image task was not completed, then suggest using the same grammar pattern with visible actions from the scene.
Do not lower the verdict for a plausible inference about something that is present in the scene. If sceneFit is "not scene-based", the verdict should usually be "keep-building" or "good-start" even when the English is correct. If sceneFit is "partly on scene", the verdict can be encouraging when the grammar relationship is useful.
Do not mark sceneFit as "partly on scene" only because the learner assigns a plausible cause to visible evidence. If the objects/people/animals are present and the event is reasonable, sceneFit should be "on scene".

Set the verdict relative to the selected difficulty:
- Beginner: clear simple past sentences about visible actions can receive "excellent". Do not require connectors, past continuous, or past perfect.
- Intermediate: reward clear relationships between actions. Accept natural relationships expressed with when, while, as, because, so, after, before, in order to, or other clear wording. Do not require only "when" or "while".
- Advanced: reward layered narration with background action, main event, earlier past, consequence, and natural connectors. A good past perfect phrase with had + past participle can fully satisfy the earlier-past part of the task; do not penalize it just because it is not past perfect continuous.
For advanced answers, if the learner uses past continuous for background and had + past participle for an earlier event, the task can be on target even without any past perfect continuous.

Be generous with valid partial narration. Do not penalize omitted visual details unless the answer is too thin for the selected task.
Focus on one useful next improvement. Do not overwhelm the learner.
Preserve the student's intended meaning.
Explain grammar in terms of narrative time, not abstract labels only.
In the summary, strengths, corrections, and rewrite, focus on the student's verb forms and time relationships. Do not mention whether a plausible scene event is directly visible unless there is a clear scene mismatch.
Never use the word "prompt" in user-facing feedback. If you mean the selected exercise instruction, say "task". If you mean the picture, say "scene".
Write user-facing coaching text in the requested feedbackLanguage. Keep English examples, corrected sentences, verb-form names, and quoted student phrases in English.

The "corrections" field powers the UI section called "Try this". It must contain the next useful learning move, not merely a different possible sentence.
Use this hierarchy:
1. If there is a real grammar or clarity problem, give a minimal correction of the student's own text.
2. If the English is correct but the answer does not fit the selected task, suggest how to adapt the same sentence to the task.
3. If the English is correct and the task is on target, do not invent a correction. Say to keep the sentence and add a next-level extension.
Good extension examples: "Keep this sentence. Add what happened next.", "Keep this sentence. Add a result with so or because.", "Keep this sentence. Add what had already happened before."
Bad Try this examples when the student's sentence already works: replacing "when an owl landed" with "while an owl was watching", changing the narrative relationship without improving it, or describing a different part of the scene.
Another bad Try this example: changing "the cat spilled the milk" to "the milk spilled" only because the exact cause is not literally visible.
Another bad Try this example: changing "somebody had forgotten his suitcase" to "somebody had been forgetting his suitcase". That is not a natural improvement.
Another bad Try this example: changing "somebody had forgotten his suitcase" to "somebody had been leaving his suitcase". Use "had left" or keep "had forgotten" for a completed earlier event.

The "rewrite" field must be a minimally revised better version of the student's own text, not a new model answer.
Keep the same basic events, actors, and sentence scope whenever possible.
Choose only the most important improvement: fix the main verb form, add one useful connector, clarify one time relationship, or correct one unclear phrase.
Do not add several new actions or replace the student's story with a different scene description.
If the student's answer is already fully correct, the rewrite must still be different by making one gentle improvement: add a natural connector or clarify the time relationship without changing the story.
Never return the student's exact answer unchanged in the "rewrite" field.

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

function normalizeFeedback(feedback, scene, challenge, feedbackLanguage = 'English', answer = '') {
  const localCopy = localFeedbackCopy(feedbackLanguage)
  const corrections = normalizeCorrections(feedback.corrections)
  const answerFeatures = detectAnswerFeatures(answer)
  const statuses = {
    englishStatus: normalizeStatus(feedback.englishStatus, ['correct', 'mostly correct', 'unclear'], 'mostly correct'),
    sceneFit: normalizeStatus(feedback.sceneFit, ['on scene', 'partly on scene', 'not scene-based'], 'partly on scene'),
    taskFit: normalizeStatus(feedback.taskFit, ['on target', 'partly on target', 'different skill'], 'partly on target'),
  }

  if (advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)) {
    statuses.taskFit = 'on target'
  }

  const usefulCorrections = normalizeUsefulCorrections(corrections, answer, challenge, localCopy, statuses).slice(0, 4)
  const normalized = {
    verdict: normalizeVerdict(feedback.verdict, statuses),
    ...statuses,
    summary: cleanAdvancedPastPerfectNitpick(cleanFeedbackText(feedback.summary || localCopy.genericSummary), challenge, answerFeatures, localCopy),
    strengths: arrayOfStrings(feedback.strengths).map(cleanFeedbackText).slice(0, 3),
    corrections: usefulCorrections,
    rewrite: cleanFeedbackText(normalizeRewrite(feedback.rewrite, answer, scene, challenge, localCopy, usefulCorrections)),
    challenge: cleanFeedbackText(normalizeChallenge(feedback.challenge, challenge, feedbackLanguage, answer)),
    detected: {
      mentionedActions: arrayOfStrings(feedback.detected?.mentionedActions),
      verbForms: arrayOfStrings(feedback.detected?.verbForms),
      connectors: arrayOfStrings(feedback.detected?.connectors),
      timeRelationships: arrayOfStrings(feedback.detected?.timeRelationships),
    },
  }

  if (!normalized.strengths.length) {
    normalized.strengths.push(localCopy.defaultStrength)
  }

  if (!normalized.corrections.length) {
    normalized.corrections.push(
      advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)
        ? consequenceCorrection(localCopy)
        : defaultStretchCorrection(challenge, localCopy),
    )
  }

  return sanitizeAdvancedPastPerfectFeedback(normalized, challenge, answerFeatures, localCopy, answer)
}

function normalizeStatus(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback
}

function cleanFeedbackText(value) {
  return String(value ?? '').replace(/\bprompt\b/gi, 'task')
}

function localFeedback(answer, scene, challenge, feedbackLanguage = 'English') {
  const localCopy = localFeedbackCopy(feedbackLanguage)
  const normalized = answer.toLowerCase()
  const hasPastContinuous = /\b(was|were)\s+\w+ing\b/.test(normalized)
  const hasSimplePast = /\b\w+(ed|ght|ought|oke|ent|ame|aw|old|ook|ost|elt|egan|an)\b/.test(normalized)
  const hasPastPerfect = /\bhad\s+\w+(ed|en|ne|wn|t)\b/.test(normalized)
  const hasPastPerfectContinuous = /\bhad\s+been\s+\w+ing\b/.test(normalized)
  const hasConnector = /\b(when|while|after|before|as|because)\b/.test(normalized)
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

  const corrections = []
  const strengths = []

  if (hasSimplePast) {
    strengths.push(localCopy.strengthSimplePast)
  } else {
    corrections.push({
      original: localCopy.mainEvent,
      suggestion: localCopy.useSimplePast,
      reason: localCopy.reasonSimplePast,
      grammarFocus: 'simple past',
    })
  }

  if (challenge?.id !== 'beginner') {
    if (hasPastContinuous) {
      strengths.push(localCopy.strengthPastContinuous)
    } else {
      corrections.push({
        original: localCopy.backgroundAction,
        suggestion: localCopy.usePastContinuous,
        reason: localCopy.reasonPastContinuous,
        grammarFocus: 'past continuous',
      })
    }

    if (hasConnector) {
      strengths.push(localCopy.strengthConnector)
    } else {
      corrections.push({
        original: localCopy.twoActions,
        suggestion: localCopy.useConnector,
        reason: localCopy.reasonConnector,
        grammarFocus: 'connector',
      })
    }
  }

  if (!hasPastPerfect && challenge?.id === 'advanced') {
    corrections.push({
      original: localCopy.earlierAction,
      suggestion: localCopy.usePastPerfect,
      reason: localCopy.reasonPastPerfect,
      grammarFocus: 'past perfect',
    })
  }

  const finalCorrections = corrections.length ? corrections.slice(0, 4) : [defaultStretchCorrection(challenge, localCopy)]
  const englishStatus = hasSimplePast || hasPastContinuous || hasPastPerfect ? 'mostly correct' : 'unclear'
  const sceneFit = mentionedActions.length ? 'on scene' : 'not scene-based'
  const taskFit = challenge?.id === 'beginner' || hasConnector || hasPastPerfect ? 'partly on target' : 'different skill'

  return {
    verdict: localVerdictFor({
      challenge,
      englishStatus,
      sceneFit,
      taskFit,
      hasPastContinuous,
      hasSimplePast,
      hasPastPerfect,
      hasPastPerfectContinuous,
      hasConnector,
    }),
    englishStatus,
    sceneFit,
    taskFit,
    summary: localCopy.summary,
    strengths: strengths.length ? strengths.slice(0, 3) : [localCopy.defaultStrength],
    corrections: finalCorrections,
    rewrite: normalizeRewrite(scene.sample, answer, scene, challenge, localCopy, finalCorrections),
    challenge: nextChallengeFor(challenge, feedbackLanguage, answer),
    detected: {
      mentionedActions,
      verbForms,
      connectors,
      timeRelationships,
    },
  }
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

function normalizeUsefulCorrections(corrections, answer, challenge, localCopy, statuses) {
  const answerFeatures = detectAnswerFeatures(answer)
  const answerWorks =
    statuses.englishStatus === 'correct' &&
    statuses.sceneFit === 'on scene' &&
    statuses.taskFit === 'on target'

  if (answerWorks && advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses)) {
    return [consequenceCorrection(localCopy)]
  }

  if (answerWorks) {
    return [nextLevelCorrection(challenge, localCopy)]
  }

  return corrections.filter((correction) => {
    if (!correction?.suggestion) {
      return false
    }

    if (sameText(correction.suggestion, answer)) {
      return false
    }

    if (
      advancedPastPerfectAlreadyWorks(challenge, answerFeatures, statuses) &&
      (isPastPerfectContinuousNitpick(correction.suggestion, correction.reason) ||
        mentionsPastPerfectContinuousForm(correction.suggestion, correction.reason))
    ) {
      return false
    }

    if (
      statuses.sceneFit !== 'not scene-based' &&
      isVisualNitpick(correction.suggestion, correction.reason)
    ) {
      return false
    }

    return true
  })
}

function advancedPastPerfectAlreadyWorks(challenge, features, statuses) {
  return (
    challenge?.id === 'advanced' &&
    features.hasPastPerfect &&
    statuses.sceneFit === 'on scene' &&
    statuses.taskFit !== 'different skill'
  )
}

function sanitizeAdvancedPastPerfectFeedback(feedback, challenge, features, localCopy, answer) {
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
    corrections: sanitizedCorrections.length ? sanitizedCorrections : [consequenceCorrection(localCopy)],
    rewrite: mentionsPastPerfectContinuousForm(feedback.rewrite) || isPastPerfectContinuousNitpick(feedback.rewrite)
      ? makeMinimalFallbackRewrite(answer, challenge) || localCopy.advancedRewriteFallback
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
    features.hasPastPerfect &&
    (mentionsForcedPastPerfectContinuous(text) || criticizesNaturalPastPerfect(text))
  ) {
    return localCopy.pastPerfectAlreadyWorksSummary
  }

  return text
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

function mentionsPastPerfectContinuousForm(...values) {
  const text = values.join(' ').toLowerCase()

  return text.includes('past perfect continuous') || /\bhad been\s+\w+ing\b/.test(text)
}

function isVisualNitpick(...values) {
  const text = values.join(' ').toLowerCase()

  return (
    /not (clearly )?(visible|shown|seen)/.test(text) ||
    /does not (show|clearly show)/.test(text) ||
    /exact cause/.test(text) ||
    /who caused/.test(text)
  )
}

function nextLevelCorrection(challenge, localCopy) {
  if (challenge?.id === 'beginner') {
    return {
      original: localCopy.yourStory,
      suggestion: localCopy.keepAndAddSimplePast,
      reason: localCopy.reasonKeepAndAddSimplePast,
      grammarFocus: 'simple past',
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

function normalizeRewrite(value, answer, scene, challenge, localCopy, corrections = []) {
  if (corrections.some((correction) => correction.suggestion?.toLowerCase().includes('keep this sentence'))) {
    return makeMinimalFallbackRewrite(answer, challenge)
  }

  const candidates = [
    isUsableRewrite(value, answer) ? value : '',
    corrections.find((correction) => isUsableRewrite(correction.suggestion, answer))?.suggestion,
    makeMinimalFallbackRewrite(answer, challenge),
    fallbackRewriteFor(challenge, localCopy),
  ]

  const rewrite = candidates.find((candidate) => candidate && !sameText(candidate, answer))

  return rewrite || fallbackRewriteFor(challenge, localCopy)
}

function isUsableRewrite(value, answer) {
  if (!value || typeof value !== 'string' || sameText(value, answer)) {
    return false
  }

  if (isPastPerfectContinuousNitpick(value)) {
    return false
  }

  if (!answer.trim()) {
    return true
  }

  const answerWords = wordSet(answer)
  const rewriteWords = wordSet(value)

  if (!answerWords.size || !rewriteWords.size) {
    return true
  }

  const sharedWords = [...answerWords].filter((word) => rewriteWords.has(word))
  const overlap = sharedWords.length / answerWords.size

  return overlap >= 0.45
}

function wordSet(value) {
  return new Set(
    String(value ?? '')
      .toLowerCase()
      .match(/\p{L}{3,}|\p{N}+/gu) ?? [],
  )
}

function makeMinimalFallbackRewrite(answer, challenge) {
  const trimmed = String(answer ?? '').trim()

  if (!trimmed) {
    return ''
  }

  if (challenge?.id === 'beginner') {
    return trimmed.endsWith('.') ? `${trimmed} Then another action happened.` : `${trimmed}. Then another action happened.`
  }

  if (challenge?.id === 'advanced') {
    return trimmed.endsWith('.') ? `${trimmed} Before that, something had already happened.` : `${trimmed}. Before that, something had already happened.`
  }

  return trimmed.endsWith('.') ? `${trimmed} This shows why the next action happened.` : `${trimmed}. This shows why the next action happened.`
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
      grammarFocus: 'simple past',
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

function consequenceCorrection(localCopy) {
  return {
    original: localCopy.yourStory,
    suggestion: localCopy.keepAndAddResult,
    reason: localCopy.reasonKeepAndAddResult,
    grammarFocus: 'narrative coherence',
  }
}

function normalizeVerdict(value, statuses) {
  const allowedVerdicts = ['keep-building', 'good-start', 'good-work', 'excellent']

  if (allowedVerdicts.includes(value)) {
    return value
  }

  if (value === 'basic') return 'keep-building'
  if (value === 'developing') return 'good-start'
  if (value === 'strong') return 'good-work'

  if (statuses.englishStatus === 'correct' && statuses.sceneFit === 'on scene' && statuses.taskFit === 'on target') {
    return 'excellent'
  }

  if (statuses.englishStatus === 'unclear' || statuses.sceneFit === 'not scene-based' || statuses.taskFit === 'different skill') {
    return 'keep-building'
  }

  if (statuses.taskFit === 'on target') {
    return 'good-work'
  }

  return 'good-start'
}

function localVerdictFor({
  challenge,
  englishStatus,
  sceneFit,
  taskFit,
  hasPastContinuous,
  hasSimplePast,
  hasPastPerfect,
  hasPastPerfectContinuous,
  hasConnector,
}) {
  if (englishStatus === 'unclear' || sceneFit === 'not scene-based' || taskFit === 'different skill') {
    return 'keep-building'
  }

  if (challenge?.id === 'beginner') {
    return hasSimplePast ? 'good-work' : 'good-start'
  }

  if (challenge?.id === 'advanced') {
    return hasPastContinuous && hasConnector && (hasPastPerfect || hasPastPerfectContinuous)
      ? 'good-work'
      : 'good-start'
  }

  return hasPastContinuous && hasSimplePast && hasConnector ? 'good-work' : 'good-start'
}

function nextChallengeFor(challenge, feedbackLanguage = 'English', answer = '') {
  const copy = localFeedbackCopy(feedbackLanguage)
  const features = detectAnswerFeatures(answer)

  if (features.hasPastPerfect || features.hasPastPerfectContinuous) {
    return copy.nextConsequence
  }

  if (features.hasWhen && features.hasPastContinuous && features.hasSimplePast) {
    return copy.nextResult
  }

  if (features.hasBecause) {
    return copy.nextWhatHappenedNext
  }

  if (challenge?.id === 'beginner') {
    return copy.nextBeginner
  }

  if (challenge?.id === 'advanced') {
    return copy.nextAdvanced
  }

  return copy.nextIntermediate
}

function normalizeChallenge(value, challenge, feedbackLanguage = 'English', answer = '') {
  if (!value || typeof value !== 'string') {
    return nextChallengeFor(challenge, feedbackLanguage, answer)
  }

  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  const features = detectAnswerFeatures(answer)
  const startsLikeTask = /^(add|rewrite|try|use|describe|explain|connect|include|change|make|practice)\b/.test(lower)
  const containsStoryVerb = /\b(was|were|had|dropped|swerved|knocked|jumped|stole|slept|weighed|weighing|sleeping|falling|rolling)\b/.test(lower)
  const repeatsExistingSkill =
    ((features.hasPastPerfect || features.hasPastPerfectContinuous) && /\b(had|had been|past perfect|already happened|happened before|before)\b/.test(lower)) ||
    (features.hasPastPerfectContinuous && /\b(had been|past perfect continuous)\b/.test(lower)) ||
    (features.hasWhen && /\bwhen\b/.test(lower)) ||
    (features.hasBecause && /\bbecause\b/.test(lower)) ||
    (features.hasWhile && /\bwhile\b/.test(lower)) ||
    (features.hasInterruption && /\b(interrupt|interruption|sudden event|suddenly)\b/.test(lower))

  if ((containsStoryVerb && !startsLikeTask) || repeatsExistingSkill) {
    return nextChallengeFor(challenge, feedbackLanguage, answer)
  }

  return trimmed
}

function detectAnswerFeatures(answer) {
  const normalized = String(answer ?? '').toLowerCase()
  const hasPastPerfectContinuous = /\bhad\s+been\s+\w+ing\b/.test(normalized)
  const hasPastPerfect = /\bhad\s+(?!been\b)\w+(ed|en|ne|wn|t)\b/.test(normalized) || /\bhad\s+already\b/.test(normalized)
  const hasPastContinuous = /\b(was|were)\s+\w+ing\b/.test(normalized) || /\bwas\s+about\s+to\b/.test(normalized)
  const hasSimplePast = /\b\w+(ed|ght|ought|oke|ent|ame|aw|old|ook|ost|elt|egan|an)\b/.test(normalized)
  const hasWhen = /\bwhen\b/.test(normalized)
  const hasWhile = /\bwhile\b/.test(normalized)
  const hasBecause = /\bbecause\b/.test(normalized)
  const hasAnyConnector = /\b(when|while|after|before|as|because|so|by the time|after which|but)\b/.test(normalized)
  const hasInterruption = hasWhen && hasPastContinuous && hasSimplePast

  return {
    hasPastPerfectContinuous,
    hasPastPerfect,
    hasPastContinuous,
    hasSimplePast,
    hasWhen,
    hasWhile,
    hasBecause,
    hasAnyConnector,
    hasInterruption,
  }
}

function localFeedbackCopy(feedbackLanguage) {
  if (feedbackLanguage === 'Spanish') {
    return {
      summary: 'Este coach local revisó los patrones principales de narración en pasado. La retroalimentación de OpenAI será más precisa y consciente de la escena.',
      genericSummary: 'Estás construyendo una historia en pasado. Mantén claras las relaciones de tiempo.',
      defaultStrength: 'Escribiste una respuesta en pasado sobre la escena.',
      strengthPastContinuous: 'Usaste past continuous para una acción que ya estaba en progreso.',
      strengthSimplePast: 'Usaste simple past para eventos terminados de la historia.',
      strengthPastPerfect: 'Usaste past perfect para mostrar una acción anterior.',
      strengthConnector: 'Usaste un conector para mostrar cómo dos acciones se relacionan en el tiempo.',
      backgroundAction: 'una acción de fondo',
      mainEvent: 'un evento principal',
      twoActions: 'dos acciones separadas',
      earlierAction: 'una acción anterior',
      yourStory: 'tu historia',
      usePastContinuous: 'Usa was/were + -ing para algo que ya estaba ocurriendo.',
      useSimplePast: 'Usa simple past para la acción que ocurrió o interrumpió la escena.',
      useConnector: 'Une las acciones con when, while, because, before o after.',
      usePastPerfect: 'Agrega had + past participle o had been + -ing.',
      stretchBeginner: 'Agrega otra oración en simple past sobre una acción visible.',
      tryEarlierDetail: 'Prueba agregar un detalle anterior con had o had been.',
      reasonPastContinuous: 'Past continuous ayuda a sentir la escena en progreso antes del evento principal.',
      reasonSimplePast: 'Simple past hace avanzar la historia.',
      reasonConnector: 'El conector muestra si las acciones ocurrieron juntas, se interrumpieron o una pasó antes.',
      reasonPastPerfect: 'El reto avanzado te pide mostrar qué pasó antes de otro momento en pasado.',
      pastPerfectAlreadyWorksSummary: 'Tu past perfect con had + past participle ya muestra claramente una acción anterior. Usa past perfect continuous solo cuando la acción anterior realmente estaba ocurriendo durante un tiempo.',
      reasonStretchBeginner: 'Eso mantiene la práctica dentro del nivel principiante sin exigir conectores.',
      reasonEarlierDetail: 'Eso hará que la línea de tiempo sea más rica y narrativa.',
      keepAndAddSimplePast: 'Mantén esta oración. Agrega una oración más en simple past sobre lo que pasó después.',
      reasonKeepAndAddSimplePast: 'La relación verbal ya funciona. El siguiente paso es continuar la narración con otro evento pasado.',
      keepAndAddResult: 'Mantén esta oración. Agrega un resultado con so o because.',
      reasonKeepAndAddResult: 'La relación temporal ya está clara. Ahora puedes mostrar la consecuencia.',
      keepAndAddEarlierPast: 'Mantén esta oración. Agrega qué ya había pasado antes.',
      reasonKeepAndAddEarlierPast: 'La oración funciona. El siguiente nivel es añadir una capa anterior de la historia con had.',
      beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
      intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
      advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
      nextBeginner: 'Ahora conecta dos acciones con when o while.',
      nextAdvanced: 'Ahora agrega una oración que contraste una acción en progreso con un evento repentino.',
      nextIntermediate: 'Ahora agrega una oración con had o had been para mostrar qué pasó antes.',
      nextConsequence: 'Ahora agrega una oración que muestre la consecuencia o reacción.',
      nextResult: 'Ahora agrega una oración con so o because para mostrar el resultado.',
      nextWhatHappenedNext: 'Ahora agrega una oración sobre lo que pasó después.',
    }
  }

  if (feedbackLanguage === 'Norwegian') {
    return {
      summary: 'Denne lokale coachen sjekket hovedmønstrene for fortelling i fortid. OpenAI-tilbakemelding blir mer presis og scene-bevisst.',
      genericSummary: 'Du bygger en historie i fortid. Gjør tidsforholdene tydelige.',
      defaultStrength: 'Du skrev et svar i fortid basert på scenen.',
      strengthPastContinuous: 'Du brukte past continuous for en handling som allerede var i gang.',
      strengthSimplePast: 'Du brukte simple past for avsluttede hendelser i historien.',
      strengthPastPerfect: 'Du brukte past perfect for å vise en tidligere handling.',
      strengthConnector: 'Du brukte en kobling for å vise hvordan to handlinger henger sammen i tid.',
      backgroundAction: 'en bakgrunnshandling',
      mainEvent: 'en hovedhendelse',
      twoActions: 'to separate handlinger',
      earlierAction: 'en tidligere handling',
      yourStory: 'historien din',
      usePastContinuous: 'Bruk was/were + -ing for noe som allerede foregikk.',
      useSimplePast: 'Bruk simple past for handlingen som skjedde eller avbrøt scenen.',
      useConnector: 'Koble handlingene med when, while, because, before eller after.',
      usePastPerfect: 'Legg til had + past participle eller had been + -ing.',
      stretchBeginner: 'Legg til en setning til i simple past om en synlig handling.',
      tryEarlierDetail: 'Prøv å legge til en tidligere detalj med had eller had been.',
      reasonPastContinuous: 'Past continuous hjelper lytteren å kjenne den pågående scenen før hovedhendelsen.',
      reasonSimplePast: 'Simple past driver historien fremover.',
      reasonConnector: 'Koblingen viser om handlingene skjedde samtidig, avbrøt hverandre, eller om én skjedde før.',
      reasonPastPerfect: 'Den avanserte oppgaven ber deg vise hva som skjedde før et annet tidspunkt i fortiden.',
      pastPerfectAlreadyWorksSummary: 'Past perfect med had + past participle viser allerede tydelig en tidligere handling. Bruk past perfect continuous bare når den tidligere handlingen faktisk pågikk over tid.',
      reasonStretchBeginner: 'Det holder øvingen på nybegynnernivå uten å kreve koblinger.',
      reasonEarlierDetail: 'Det gjør tidslinjen rikere og mer fortellende.',
      keepAndAddSimplePast: 'Behold denne setningen. Legg til en setning til i simple past om hva som skjedde etterpå.',
      reasonKeepAndAddSimplePast: 'Verbforholdet fungerer allerede. Neste steg er å fortsette fortellingen med en ny hendelse i fortid.',
      keepAndAddResult: 'Behold denne setningen. Legg til et resultat med so eller because.',
      reasonKeepAndAddResult: 'Tidsforholdet er allerede tydelig. Nå kan du vise konsekvensen.',
      keepAndAddEarlierPast: 'Behold denne setningen. Legg til hva som allerede hadde skjedd før.',
      reasonKeepAndAddEarlierPast: 'Setningen fungerer. Neste nivå er å legge til et tidligere lag i historien med had.',
      beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
      intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
      advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
      nextBeginner: 'Koble nå to handlinger med when eller while.',
      nextAdvanced: 'Legg nå til en setning som kontrasterer en pågående handling med en plutselig hendelse.',
      nextIntermediate: 'Legg nå til en setning med had eller had been for å vise hva som skjedde før.',
      nextConsequence: 'Legg nå til en setning som viser konsekvensen eller reaksjonen.',
      nextResult: 'Legg nå til en setning med so eller because for å vise resultatet.',
      nextWhatHappenedNext: 'Legg nå til en setning om hva som skjedde etterpå.',
    }
  }

  return {
    summary: 'This local coach checked the main past-story patterns. OpenAI feedback will give more precise scene-aware corrections when an API key is available.',
    genericSummary: 'You are building a past-tense story. Keep making the time relationships clear.',
    defaultStrength: 'You wrote a past-tense response to the scene.',
    strengthPastContinuous: 'You used past continuous for an action that was already in progress.',
    strengthSimplePast: 'You used simple past for completed story events.',
    strengthPastPerfect: 'You used past perfect to show an earlier event.',
    strengthConnector: 'You used a connector to show how two actions relate in time.',
    backgroundAction: 'a background action',
    mainEvent: 'a main event',
    twoActions: 'two separate actions',
    earlierAction: 'an earlier past action',
    yourStory: 'your story',
    usePastContinuous: 'Use was/were + -ing for something already happening.',
    useSimplePast: 'Use simple past for the action that happened or interrupted the scene.',
    useConnector: 'Join them with when, while, because, before, or after.',
    usePastPerfect: 'Add had + past participle or had been + -ing.',
    stretchBeginner: 'Add one more simple past sentence about a visible action.',
    tryEarlierDetail: 'Try adding one earlier past detail with had or had been.',
    reasonPastContinuous: 'Past continuous helps the listener feel the ongoing scene before the main event happens.',
    reasonSimplePast: 'Simple past moves the story forward.',
    reasonConnector: 'The connector tells the reader whether actions happened together, interrupted each other, or happened earlier.',
    reasonPastPerfect: 'The advanced challenge asks you to show what happened before another past moment.',
    pastPerfectAlreadyWorksSummary: 'Your past perfect with had + past participle already shows an earlier action clearly. Use past perfect continuous only when the earlier action was genuinely ongoing for a period of time.',
    reasonStretchBeginner: 'That keeps the practice at beginner level without requiring connectors.',
    reasonEarlierDetail: 'That will make the timeline richer and more narrative.',
    keepAndAddSimplePast: 'Keep this sentence. Add one more simple past sentence about what happened next.',
    reasonKeepAndAddSimplePast: 'The verb relationship already works. The next step is to continue the narration with another past event.',
    keepAndAddResult: 'Keep this sentence. Add a result with so or because.',
    reasonKeepAndAddResult: 'The time relationship is already clear. Now you can show the consequence.',
    keepAndAddEarlierPast: 'Keep this sentence. Add what had already happened before.',
    reasonKeepAndAddEarlierPast: 'The sentence works. The next level is to add an earlier layer of the story with had.',
    beginnerRewriteFallback: 'A person did one clear action, and then another visible action happened.',
    intermediateRewriteFallback: 'One action was happening when another action suddenly changed the scene.',
    advancedRewriteFallback: 'One action had already happened before another past action changed the scene.',
    nextBeginner: 'Now connect two of your actions with when or while.',
    nextAdvanced: 'Now add one more sentence that contrasts an ongoing past action with a sudden event.',
    nextIntermediate: 'Now add one sentence with had or had been to show what happened earlier.',
    nextConsequence: 'Now add one sentence that shows the consequence or reaction.',
    nextResult: 'Now add one sentence with so or because to show the result.',
    nextWhatHappenedNext: 'Now add one sentence about what happened next.',
  }
}

if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Story coach API listening on http://localhost:${port}`)
  })
}

export default app
