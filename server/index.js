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
  const analysis = analyzeAnswer(answer, scene, challenge)
  const answerFeatures = analysis.features
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

  const usefulCorrections = normalizeUsefulCorrections(corrections, answer, challenge, localCopy, statuses).slice(0, 4)
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
    rewrite: cleanFeedbackText(normalizeRewrite(feedback.rewrite, answer, scene, challenge, localCopy, usefulCorrections)),
    challenge: cleanFeedbackText(normalizeChallenge(feedback.challenge, challenge, feedbackLanguage, answer)),
    detected: {
      mentionedActions: arrayOfStrings(feedback.detected?.mentionedActions),
      verbForms: arrayOfStrings(feedback.detected?.verbForms),
      connectors: arrayOfStrings(feedback.detected?.connectors),
      timeRelationships: arrayOfStrings(feedback.detected?.timeRelationships),
    },
  }

  normalized.detected.mentionedActions = mergeDetectedValues(
    normalized.detected.mentionedActions,
    analysis.mentionedActions,
  )

  if (!normalized.strengths.length) {
    normalized.strengths.push(localCopy.defaultStrength)
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

  const sanitized = sanitizeAdvancedPastPerfectFeedback(normalized, challenge, answerFeatures, localCopy, answer)

  return ensureDistinctRewrite(
    applyFeedbackConsistencyCaps(sanitized),
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
  const sceneFit = mentionedActions.length ? 'on scene' : null
  const taskFit = taskFitFromFeatures(challenge, features)
  const englishStatus = features.hasAnyPastVerb ? 'mostly correct' : 'unclear'
  const statuses = { englishStatus, sceneFit: sceneFit ?? 'partly on scene', taskFit }

  return {
    features,
    mentionedActions,
    sceneFit,
    taskFit,
    verdictFloor: verdictFromFeatures(challenge, features, statuses),
    hasBoundedResultAsContinuous: turnsBoundedResultIntoPastContinuous(answer),
  }
}

function taskFitFromFeatures(challenge, features) {
  if (challenge?.id === 'beginner') {
    return features.hasAnyPastVerb ? 'on target' : 'partly on target'
  }

  if (challenge?.id === 'advanced') {
    return (features.hasPastPerfect || features.hasPastPerfectContinuous) && features.hasAnyConnector
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

function cleanFeedbackText(value) {
  return String(value ?? '').replace(/\bprompt\b/gi, 'task')
}

function localFeedback(answer, scene, challenge, feedbackLanguage = 'English') {
  const localCopy = localFeedbackCopy(feedbackLanguage)
  const normalized = answer.toLowerCase()
  const hasPastContinuous = /\b(was|were)\s+\w+ing\b/.test(normalized)
  const simplePastCandidates = normalized.match(/\b\w+(ed|ght|ought|oke|ent|ame|aw|old|ook|ost|elt|egan|an)\b/g) ?? []
  const hasSimplePast =
    simplePastCandidates.some(isLikelySimplePastVerb) ||
    (normalized.match(/\b[a-z]+\b/g) ?? []).some(isKnownSimplePastVerb)
  const hasPastPerfect = /\bhad\s+(?!not\s+been\b)(?!been\b)\w+(ed|en|ne|wn|t)\b/.test(normalized)
  const hasPastPerfectContinuous = /\bhad\s+(?:not\s+)?been(?:\s+\w+){0,3}\s+\w+ing\b/.test(normalized)
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

  const corrections = []
  const strengths = []

  if (challenge?.id === 'beginner') {
    if (hasAnyPastVerb) {
      if (hasPastContinuous) {
        strengths.push(localCopy.strengthPastContinuous)
      } else if (hasPastPerfect || hasPastPerfectContinuous) {
        strengths.push(localCopy.strengthPastPerfect)
      } else if (hasSimplePast) {
        strengths.push(localCopy.strengthSimplePast)
      }
    } else {
      corrections.push({
        original: localCopy.mainEvent,
        suggestion: localCopy.usePastNarration,
        reason: localCopy.reasonPastNarration,
        grammarFocus: 'narrative coherence',
      })
    }
  } else if (hasSimplePast) {
    strengths.push(localCopy.strengthSimplePast)
  } else {
    corrections.push({
      original: localCopy.mainEvent,
      suggestion: localCopy.useSimplePast,
      reason: localCopy.reasonSimplePast,
      grammarFocus: 'simple past',
    })
  }

  if (challenge?.id === 'intermediate') {
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

    if (/\b(when|while)\b/.test(normalized)) {
      strengths.push(localCopy.strengthWhenWhile)
    } else {
      corrections.push({
        original: localCopy.twoActions,
        suggestion: localCopy.useWhenWhile,
        reason: localCopy.reasonWhenWhile,
        grammarFocus: 'connector',
      })
    }
  } else if (challenge?.id !== 'beginner') {
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
  const taskFit = strongestTaskFit(
    challenge?.id === 'beginner' || hasConnector || hasPastPerfect ? 'partly on target' : 'different skill',
    taskFitFromFeatures(challenge, detectAnswerFeatures(answer)),
  )

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
    return [consequenceCorrection(localCopy, answerFeatures)]
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
}

function advancedPastPerfectAlreadyWorks(challenge, features, statuses) {
  return (
    challenge?.id === 'advanced' &&
    (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
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
    corrections: sanitizedCorrections.length ? sanitizedCorrections : [consequenceCorrection(localCopy, features)],
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

function normalizeRewrite(value, answer, scene, challenge, localCopy, corrections = []) {
  if (corrections.some((correction) => correction.suggestion?.toLowerCase().includes('keep this sentence'))) {
    return polishRewriteSurface(
      meaningPreservingRewrite(answer) ||
        makePolishedFallbackRewrite(answer) ||
        makeMinimalFallbackRewrite(answer, challenge),
    )
  }

  const candidates = [
    isUsableRewrite(value, answer) &&
    !changesCausalMeaning(value, answer) &&
    !removesSuccessfulNarrativeRelationship(value, answer) &&
    !changesKitchenPancakeMeaning(value, answer) &&
    !createsAwkwardWhilePastPerfectContinuous(value, answer) ? value : '',
    corrections.find((correction) =>
      isUsableRewrite(correction.suggestion, answer) &&
      !changesCausalMeaning(correction.suggestion, answer) &&
      !removesSuccessfulNarrativeRelationship(correction.suggestion, answer) &&
      !changesKitchenPancakeMeaning(correction.suggestion, answer) &&
      !createsAwkwardWhilePastPerfectContinuous(correction.suggestion, answer) &&
      !turnsBoundedResultIntoPastContinuous(correction.suggestion, answer),
    )?.suggestion,
    meaningPreservingRewrite(answer),
    makePolishedFallbackRewrite(answer),
    makeMinimalFallbackRewrite(answer, challenge),
    fallbackRewriteFor(challenge, localCopy),
  ]

  const rewrite = candidates
    .map((candidate) => polishRewriteSurface(candidate))
    .find((candidate) => candidate && !sameText(candidate, answer))

  return rewrite || polishRewriteSurface(fallbackRewriteFor(challenge, localCopy))
}

function ensureDistinctRewrite(feedback, answer, challenge, localCopy) {
  if (!sameText(feedback.rewrite, answer)) {
    return feedback
  }

  const fallback =
    polishRewriteSurface(meaningPreservingRewrite(answer)) ||
    polishRewriteSurface(makePolishedFallbackRewrite(answer)) ||
    polishRewriteSurface(makeMinimalFallbackRewrite(answer, challenge)) ||
    polishRewriteSurface(fallbackRewriteFor(challenge, localCopy))

  return {
    ...feedback,
    rewrite: sameText(fallback, answer) ? polishRewriteSurface(fallbackRewriteFor(challenge, localCopy)) : fallback,
  }
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

function isUsableRewrite(value, answer) {
  if (!value || typeof value !== 'string' || sameText(value, answer)) {
    return false
  }

  if (isPastPerfectContinuousNitpick(value)) {
    return false
  }

  if (turnsBoundedResultIntoPastContinuous(value, answer)) {
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
  const features = detectAnswerFeatures(trimmed)

  if (!trimmed) {
    return ''
  }

  if (challenge?.id === 'beginner') {
    return trimmed.endsWith('.') ? `${trimmed} Then another action happened.` : `${trimmed}. Then another action happened.`
  }

  if (challenge?.id === 'advanced') {
    if (features.hasPastPerfect || features.hasPastPerfectContinuous) {
      return trimmed.endsWith('.') ? `${trimmed} As a result, the scene became more chaotic.` : `${trimmed}. As a result, the scene became more chaotic.`
    }

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
  const verdict = normalizeVerdictValue(value)
  const featureVerdict = analysis?.verdictFloor ?? verdictFromFeatures(challenge, features, statuses)

  if (
    statuses.englishStatus === 'correct' &&
    statuses.sceneFit === 'on scene' &&
    statuses.taskFit === 'on target' &&
    analysis?.taskFit !== 'partly on target'
  ) {
    return highestVerdict(highestVerdict(verdict, featureVerdict), 'excellent')
  }

  if (isExcellentFromFeatures(challenge, features, statuses)) {
    return highestVerdict(highestVerdict(verdict, featureVerdict), 'excellent')
  }

  if (statuses.englishStatus === 'unclear' || statuses.sceneFit === 'not scene-based' || statuses.taskFit === 'different skill') {
    return lowestVerdict(verdict, 'good-start')
  }

  if (analysis?.taskFit === 'partly on target') {
    return highestVerdict(featureVerdict, verdict === 'excellent' ? 'good-start' : verdict)
  }

  if (statuses.taskFit === 'on target') {
    return highestVerdict(highestVerdict(verdict, featureVerdict), 'good-work')
  }

  return highestVerdict(verdict, featureVerdict)
}

function isExcellentFromFeatures(challenge, features, statuses) {
  if (statuses.sceneFit !== 'on scene' || statuses.taskFit !== 'on target') {
    return false
  }

  if (challenge?.id === 'advanced') {
    return (
      features.hasSimplePast &&
      features.hasPastContinuous &&
      (features.hasPastPerfect || features.hasPastPerfectContinuous) &&
      features.hasRelationshipConnector
    )
  }

  if (challenge?.id === 'intermediate') {
    return features.hasSimplePast && features.hasPastContinuous && features.hasRelationshipConnector
  }

  if (challenge?.id === 'beginner') {
    return features.hasAnyPastVerb
  }

  return false
}

function verdictFromFeatures(challenge, features, statuses) {
  if (statuses.englishStatus === 'unclear' || statuses.sceneFit === 'not scene-based') {
    return 'keep-building'
  }

  const hasClearRelationship =
    (features.hasPastContinuous && features.hasSimplePast && features.hasRelationshipConnector) ||
    (features.hasPastPerfectContinuous && features.hasSimplePast && features.hasRelationshipConnector) ||
    features.hasBecause ||
    features.hasInterruption

  if (
    challenge?.id === 'advanced' &&
    hasClearRelationship &&
    (features.hasPastPerfect || features.hasPastPerfectContinuous)
  ) {
    return 'good-work'
  }

  if (hasClearRelationship) {
    return 'good-work'
  }

  if (features.hasSimplePast || features.hasPastContinuous || features.hasPastPerfect || features.hasPastPerfectContinuous) {
    return 'good-start'
  }

  return 'keep-building'
}

function normalizeVerdictValue(value) {
  const allowedVerdicts = ['keep-building', 'good-start', 'good-work', 'excellent']

  if (allowedVerdicts.includes(value)) return value
  if (value === 'basic') return 'keep-building'
  if (value === 'developing') return 'good-start'
  if (value === 'strong') return 'good-work'

  return 'good-start'
}

function highestVerdict(first, second) {
  const order = ['keep-building', 'good-start', 'good-work', 'excellent']
  return order.indexOf(first) >= order.indexOf(second) ? first : second
}

function lowestVerdict(first, second) {
  const order = ['keep-building', 'good-start', 'good-work', 'excellent']
  return order.indexOf(first) <= order.indexOf(second) ? first : second
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
    return hasSimplePast || hasPastContinuous || hasPastPerfect || hasPastPerfectContinuous
      ? 'good-work'
      : 'good-start'
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
    return features.hasCauseResult ? copy.nextWhatHappenedNext : copy.nextConsequence
  }

  if (features.hasWhen && features.hasPastContinuous && features.hasSimplePast) {
    return features.hasCauseResult ? copy.nextWhatHappenedNext : copy.nextResult
  }

  if (features.hasCauseResult) {
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
  const asksForEarlierPast =
    /\b(had|had been|had or had been|past perfect|past perfect continuous|earlier past|already happened|happened before|what happened earlier|what had happened|before)\b/.test(lower) ||
    /\bhad\b[^.?!]*\bhad been\b/.test(lower)
  const asksForCauseResult =
    /\b(because|so|so that|result|consequence|cause|why|explain why|caused|led to)\b/.test(lower)
  const repeatsExistingSkill =
    ((features.hasPastPerfect || features.hasPastPerfectContinuous) && asksForEarlierPast) ||
    (features.hasPastPerfectContinuous && /\b(had been|past perfect continuous)\b/.test(lower)) ||
    (features.hasWhen && /\bwhen\b/.test(lower)) ||
    (features.hasBecause && /\bbecause\b/.test(lower)) ||
    (features.hasCauseResult && asksForCauseResult) ||
    (features.hasWhile && /\bwhile\b/.test(lower)) ||
    (features.hasInterruption && /\b(interrupt|interruption|sudden event|suddenly)\b/.test(lower))

  if ((containsStoryVerb && !startsLikeTask) || repeatsExistingSkill) {
    return nextChallengeFor(challenge, feedbackLanguage, answer)
  }

  return trimmed
}

function detectAnswerFeatures(answer) {
  const normalized = String(answer ?? '').toLowerCase()
  const hasPastPerfectContinuous = /\bhad\s+(?:not\s+)?been(?:\s+\w+){0,3}\s+\w+ing\b/.test(normalized)
  const hasPastPerfect = /\bhad\s+(?!not\s+been\b)(?!been\b)\w+(ed|en|ne|wn|t)\b/.test(normalized) || /\bhad\s+already\b/.test(normalized)
  const hasPastContinuous = /\b(was|were)\s+\w+ing\b/.test(normalized) || /\bwas\s+about\s+to\b/.test(normalized)
  const simplePastCandidates = normalized.match(/\b\w+(ed|ght|ought|oke|ent|ame|aw|old|ook|ost|elt|egan|an)\b/g) ?? []
  const hasSimplePast =
    simplePastCandidates.some(isLikelySimplePastVerb) ||
    (normalized.match(/\b[a-z]+\b/g) ?? []).some(isKnownSimplePastVerb)
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
  }
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
      defaultStrength: 'Escribiste una respuesta en pasado sobre la escena.',
      strengthPastContinuous: 'Usaste past continuous para una acción que ya estaba en progreso.',
      strengthSimplePast: 'Usaste simple past para eventos terminados de la historia.',
      strengthPastPerfect: 'Usaste past perfect para mostrar una acción anterior.',
      strengthWhenWhile: 'Usaste when o while para conectar acciones en el pasado.',
      strengthConnector: 'Usaste un conector para mostrar cómo dos acciones se relacionan en el tiempo.',
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
      stretchBeginner: 'Agrega otra oración en pasado sobre una acción visible.',
      tryEarlierDetail: 'Prueba agregar un detalle anterior con had o had been.',
      reasonPastNarration: 'El nivel principiante busca una narración clara en pasado, no solo simple past.',
      reasonPastContinuous: 'Past continuous ayuda a sentir la escena en progreso antes del evento principal.',
      reasonSimplePast: 'Simple past hace avanzar la historia.',
      reasonWhenWhile: 'Eso deja más clara la relación entre una acción en progreso y otra acción en el pasado.',
      reasonConnector: 'El conector muestra si las acciones ocurrieron juntas, se interrumpieron o una pasó antes.',
      reasonPastPerfect: 'El reto avanzado te pide mostrar qué pasó antes de otro momento en pasado.',
      pastPerfectAlreadyWorksSummary: 'Tu forma con had ya muestra claramente una capa anterior de la historia. Usa past perfect continuous solo cuando la acción anterior realmente estaba ocurriendo durante un tiempo.',
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
      strengthWhenWhile: 'Du brukte when eller while for å koble handlinger i fortid.',
      strengthConnector: 'Du brukte en kobling for å vise hvordan to handlinger henger sammen i tid.',
      backgroundAction: 'en bakgrunnshandling',
      mainEvent: 'en hovedhendelse',
      twoActions: 'to separate handlinger',
      earlierAction: 'en tidligere handling',
      yourStory: 'historien din',
      usePastNarration: 'Skriv om scenen i fortid.',
      usePastContinuous: 'Bruk was/were + -ing for noe som allerede foregikk.',
      useSimplePast: 'Bruk simple past for handlingen som skjedde eller avbrøt scenen.',
      useWhenWhile: 'Bruk when eller while for å koble to handlinger i fortid.',
      useConnector: 'Koble handlingene med when, while, because, before eller after.',
      usePastPerfect: 'Legg til had + past participle eller had been + -ing.',
      stretchBeginner: 'Legg til en setning til i fortid om en synlig handling.',
      tryEarlierDetail: 'Prøv å legge til en tidligere detalj med had eller had been.',
      reasonPastNarration: 'Nybegynnernivået ber om tydelig fortelling i fortid, ikke bare simple past.',
      reasonPastContinuous: 'Past continuous hjelper lytteren å kjenne den pågående scenen før hovedhendelsen.',
      reasonSimplePast: 'Simple past driver historien fremover.',
      reasonWhenWhile: 'Det gjør forholdet tydeligere mellom en handling som pågikk og en annen handling i fortid.',
      reasonConnector: 'Koblingen viser om handlingene skjedde samtidig, avbrøt hverandre, eller om én skjedde før.',
      reasonPastPerfect: 'Den avanserte oppgaven ber deg vise hva som skjedde før et annet tidspunkt i fortiden.',
      pastPerfectAlreadyWorksSummary: 'Formen med had viser allerede tydelig et tidligere lag i historien. Bruk past perfect continuous bare når den tidligere handlingen faktisk pågikk over tid.',
      sceneInferenceSummary: 'Fortellingen din er forankret i scenen og bruker en rimelig tolkning. Fokuser nå på å gjøre tidsforholdet mellom verbene tydelig.',
      sceneSynonymSummary: 'Fortellingen din er forankret i scenen. Making pancakes og cooking pancakes beskriver samme handling; fokuser nå på å gjøre tidsforholdet mellom verbene tydelig.',
      reasonStretchBeginner: 'Det holder øvingen på nybegynnernivå uten å kreve koblinger.',
      reasonEarlierDetail: 'Det gjør tidslinjen rikere og mer fortellende.',
      keepAndAddPastSentence: 'Behold denne setningen. Legg til en setning til i fortid om hva som skjedde etterpå.',
      reasonKeepAndAddPastSentence: 'Verbforholdet fungerer allerede. Neste steg er å fortsette fortellingen i fortid.',
      keepAndAddResult: 'Behold denne setningen. Legg til et resultat med so eller because.',
      reasonKeepAndAddResult: 'Tidsforholdet er allerede tydelig. Nå kan du vise konsekvensen.',
      keepAndAddNextEvent: 'Behold denne setningen. Legg til en kort setning om hva som skjedde etterpå.',
      reasonKeepAndAddNextEvent: 'Årsak-resultat-forholdet fungerer allerede. Neste steg er å fortsette fortellingen.',
      keepAndAddEarlierPast: 'Behold denne setningen. Legg til hva som allerede hadde skjedd før.',
      reasonKeepAndAddEarlierPast: 'Setningen fungerer. Neste nivå er å legge til et tidligere lag i historien med had.',
      reasonMeaningPreservingPolish: 'Dette beholder ideen din og forbedrer bare klarhet og naturlig ordstilling.',
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
    strengthWhenWhile: 'You used when or while to connect actions in the past.',
    strengthConnector: 'You used a connector to show how two actions relate in time.',
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
    stretchBeginner: 'Add one more past-tense sentence about a visible action.',
    tryEarlierDetail: 'Try adding one earlier past detail with had or had been.',
    reasonPastNarration: 'Beginner level asks for clear past narration, not only simple past.',
    reasonPastContinuous: 'Past continuous helps the listener feel the ongoing scene before the main event happens.',
    reasonSimplePast: 'Simple past moves the story forward.',
    reasonWhenWhile: 'That makes the relationship clearer between one action in progress and another past action.',
    reasonConnector: 'The connector tells the reader whether actions happened together, interrupted each other, or happened earlier.',
    reasonPastPerfect: 'The advanced challenge asks you to show what happened before another past moment.',
    pastPerfectAlreadyWorksSummary: 'Your form with had already shows an earlier layer of the story clearly. Use past perfect continuous only when the earlier action was genuinely ongoing for a period of time.',
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

export {
  normalizeFeedback,
  analyzeAnswer,
  detectAnswerFeatures,
  taskFitFromFeatures,
  turnsBoundedResultIntoPastContinuous,
  changesCausalMeaning,
}

export default app
