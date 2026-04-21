import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.VERCEL = '1'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const outputDir = __dirname
const requestedMode = (process.argv[2] || 'deterministic_mode').toLowerCase()
const legacyPhase = requestedMode === 'before' || requestedMode === 'after' ? requestedMode : null
const mode = legacyPhase ? 'deterministic_mode' : requestedMode

if (!['deterministic_mode', 'live_model_mode'].includes(mode)) {
  throw new Error(`Unsupported QC mode: ${requestedMode}`)
}

if (mode === 'deterministic_mode') {
  process.env.OPENAI_API_KEY = ''
}

const outputConfig = legacyPhase
  ? {
    resultFile: `QC_RESULTS_${legacyPhase === 'after' ? 'AFTER' : 'BEFORE'}.json`,
    evalFile: `QC_EVAL_${legacyPhase === 'after' ? 'AFTER' : 'BEFORE'}.json`,
    label: legacyPhase === 'after' ? 'AFTER' : 'BEFORE',
  }
  : {
    resultFile: mode === 'live_model_mode' ? 'QC_RESULTS_LIVE.json' : 'QC_RESULTS_DETERMINISTIC.json',
    evalFile: mode === 'live_model_mode' ? 'QC_EVAL_LIVE.json' : 'QC_EVAL_DETERMINISTIC.json',
    label: mode === 'live_model_mode' ? 'LIVE' : 'DETERMINISTIC',
  }

const { scenes } = await import('../../src/data/scenes.js')
const { generateFeedback } = await import('../../server/index.js')

const qcCasesPath = path.join(outputDir, 'QC_CASES.json')
const deterministicResultsPath = path.join(outputDir, 'QC_RESULTS_DETERMINISTIC.json')
const liveResultsPath = path.join(outputDir, 'QC_RESULTS_LIVE.json')
const liveSubsetVariants = [
  'basic-clear-short',
  'intermediate-no-connector',
  'intermediate-correct-when',
  'advanced-no-earlier-event',
]

const englishUi = {
  challengePrompts: {
    basic: 'Write 2-3 sentences about the scene in the past.',
    intermediate: 'Use when or while to connect actions in the past.',
    advanced: 'Add what happened before using had or had been.',
  },
  hints: {
    beginner: {
      finishedAction: (verbForm) => `Look for one finished action. You could use: ${verbForm}.`,
      finishedActionFallback: 'Look for one finished action and describe it with simple past.',
      secondAction: (actor) => `Add a second finished action. Look at: ${actor}.`,
      secondActionFallback: 'Add a second simple past sentence with Then...',
      sceneAnchor: 'Name one visible person or thing in the scene and say what happened.',
    },
    intermediate: {
      backgroundAction: (verbForm) => `Start with the background action: ${verbForm}.`,
      backgroundActionFallback: 'Start with an action already in progress.',
      eventAction: (actor) => `Connect it to a sudden event with when. Look at: ${actor}.`,
      eventActionFallback: 'Connect the background action to a sudden event with when.',
      pattern: 'Use while for the background action and simple past for the sudden event.',
    },
    advanced: {
      earlierPast: 'Find a clue about what happened earlier. Use had or had been.',
      earlierPastFallback: 'Add an earlier past detail with had or had been.',
      connectors: 'Use before or by the time to make the earlier past relationship clear.',
      selectiveDetail: 'Do not describe every action. Choose the detail that changes the timeline.',
    },
  },
}

const difficultyMap = {
  basic: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
}

const difficultyBuckets = {
  basic: 'difficulty',
  intermediate: 'difficulty',
  advanced: 'difficulty',
}

const pluralActors = new Set([
  'children',
  'passengers',
  'friends',
  'visitors',
  'clouds',
  'coworkers',
  'campers',
  'guests',
  'students',
  'hikers',
  'doors',
  'lights',
  'pigeons',
  'sparks',
  'oranges',
  'animals',
  'people',
  'shoppers',
  'vendors',
])

function sceneSourceFile() {
  return '/Users/erikgw/Documents/tellastory/src/data/scenes.js'
}

function sentenceCase(value = '') {
  const text = String(value).trim()
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

function subjectForActor(actor = '') {
  const normalized = String(actor).toLowerCase()

  if (!normalized) return 'Someone'
  if (pluralActors.has(normalized) || (normalized.endsWith('s') && !normalized.endsWith('ss'))) {
    return sentenceCase(normalized)
  }

  if (['rain', 'smoke', 'milk', 'foam', 'coffee', 'wind', 'luggage'].includes(normalized)) {
    return sentenceCase(`the ${normalized}`)
  }

  return sentenceCase(`the ${normalized}`)
}

function actionSentence(action, verbOverride = '') {
  if (!action) return 'Something happened.'
  const verb = verbOverride || action.recommendedVerbForms?.[0] || 'did something'
  return `${subjectForActor(action.actor)} ${verb}.`
}

function lowercaseFirst(value = '') {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : ''
}

function presentizeVerb(verb = '') {
  const text = String(verb)
  return text
    .replace(/\bwas\b/gi, 'is')
    .replace(/\bwere\b/gi, 'are')
    .replace(/\bhad been\b/gi, 'has been')
    .replace(/\bhad\b/gi, 'has')
}

function findRelationship(scene, type) {
  return scene.sceneScript?.relationships?.find((relationship) => relationship.type === type)
}

function findAction(scene, actionId) {
  return scene.sceneScript?.coreActions?.find((action) => action.id === actionId)
}

function pickSceneParts(scene) {
  const interruption = findRelationship(scene, 'interruption')
  const causeResult = findRelationship(scene, 'cause-result') || findRelationship(scene, 'reaction')
  const earlierPast = findRelationship(scene, 'earlier-past')
  const simultaneous = findRelationship(scene, 'simultaneous-background')

  const backgroundAction =
    findAction(scene, interruption?.backgroundAction) ||
    scene.sceneScript?.coreActions?.find((action) => action.grammarTargets?.includes('past continuous')) ||
    scene.sceneScript?.coreActions?.[0]
  const eventAction =
    findAction(scene, interruption?.interruptingAction) ||
    scene.sceneScript?.coreActions?.find((action) => action.grammarTargets?.includes('simple past')) ||
    scene.sceneScript?.coreActions?.[1] ||
    backgroundAction
  const reactionAction =
    findAction(scene, causeResult?.result) ||
    scene.sceneScript?.coreActions?.find((action) => action.id !== backgroundAction?.id && action.id !== eventAction?.id) ||
    eventAction
  const earlierAction =
    findAction(scene, earlierPast?.earlierAction) ||
    scene.sceneScript?.coreActions?.find((action) => action.grammarTargets?.includes('past perfect') || action.grammarTargets?.includes('past perfect continuous')) ||
    reactionAction
  const simultaneousAction =
    scene.sceneScript?.coreActions?.find((action) => action.id !== backgroundAction?.id && action.id !== eventAction?.id && action.id !== reactionAction?.id) ||
    reactionAction

  return {
    interruption,
    causeResult,
    earlierPast,
    simultaneous,
    backgroundAction,
    eventAction,
    reactionAction,
    earlierAction,
    simultaneousAction,
  }
}

function buildQuickHints(scene, selectedDifficulty) {
  const challengeMode = difficultyMap[selectedDifficulty]
  const { interruption, causeResult, earlierPast, backgroundAction, eventAction, reactionAction } = pickSceneParts(scene)

  if (challengeMode === 'beginner') {
    return [
      eventAction
        ? englishUi.hints.beginner.finishedAction(eventAction.recommendedVerbForms?.[0] ?? 'simple past')
        : englishUi.hints.beginner.finishedActionFallback,
      reactionAction
        ? englishUi.hints.beginner.secondAction(reactionAction.actor)
        : englishUi.hints.beginner.secondActionFallback,
      englishUi.hints.beginner.sceneAnchor,
    ]
  }

  if (challengeMode === 'advanced') {
    return [
      earlierPast ? englishUi.hints.advanced.earlierPast : englishUi.hints.advanced.earlierPastFallback,
      englishUi.hints.advanced.connectors,
      englishUi.hints.advanced.selectiveDetail,
    ]
  }

  return [
    backgroundAction
      ? englishUi.hints.intermediate.backgroundAction(backgroundAction.recommendedVerbForms?.[0] ?? 'was/were + -ing')
      : englishUi.hints.intermediate.backgroundActionFallback,
    eventAction
      ? englishUi.hints.intermediate.eventAction(eventAction.actor)
      : englishUi.hints.intermediate.eventActionFallback,
    englishUi.hints.intermediate.pattern,
  ]
}

function createExpectedFeedbackBehavior(selectedDifficulty, variant) {
  const base = {
    whatWorkedShouldMention: ['verb form', 'meaning'],
    betterVersionShould: ['stay close to student wording', 'stay level-safe'],
    nextStepShould: ['one action only', 'current level'],
    readinessHintShouldBe: 'none',
  }

  if (selectedDifficulty === 'basic') {
    base.nextStepShould.push('one more past sentence or detail')
    if (variant === 'readiness-basic') {
      base.readinessHintShouldBe = 'yes'
    }
    return base
  }

  if (selectedDifficulty === 'intermediate') {
    base.whatWorkedShouldMention.push('relationship between actions')
    base.nextStepShould.push('when or while')
    if (variant === 'readiness-intermediate') {
      base.readinessHintShouldBe = 'yes'
    }
    return base
  }

  base.whatWorkedShouldMention.push('earlier past')
  base.nextStepShould.push('had or had been')
  return base
}

function stableHistory(selectedDifficulty) {
  return [
    {
      selectedDifficulty: difficultyMap[selectedDifficulty],
      currentLevelTargetMet: true,
      currentLevelTargetStrength: 'clear',
      errorSeverity: 'none',
      levelReadinessHintShown: false,
    },
    {
      selectedDifficulty: difficultyMap[selectedDifficulty],
      currentLevelTargetMet: true,
      currentLevelTargetStrength: 'clear',
      errorSeverity: 'low',
      levelReadinessHintShown: false,
    },
  ]
}

function buildCasesForScene(scene) {
  const parts = pickSceneParts(scene)
  const { backgroundAction, eventAction, reactionAction, earlierAction, interruption, simultaneous } = parts
  const whenSentence = interruption?.modelSentence || `${subjectForActor(backgroundAction.actor)} ${backgroundAction.recommendedVerbForms?.[0]} when ${lowercaseFirst(subjectForActor(eventAction.actor))} ${eventAction.recommendedVerbForms?.[0]}.`
  const whileSentence = simultaneous?.modelSentence || `${subjectForActor(backgroundAction.actor)} ${backgroundAction.recommendedVerbForms?.[0]} while ${lowercaseFirst(subjectForActor(reactionAction.actor))} ${reactionAction.recommendedVerbForms?.[0]}.`
  const earlierSentence = parts.earlierPast?.modelSentence || `${subjectForActor(earlierAction.actor)} ${earlierAction.recommendedVerbForms?.find((verb) => verb.includes('had')) || `had ${earlierAction.recommendedVerbForms?.[0] || 'done something'}`} before that.`
  const simpleNarration = `${actionSentence(backgroundAction)} ${actionSentence(eventAction)}`
  const secondNarration = `${actionSentence(backgroundAction)} ${actionSentence(reactionAction)}`
  const awkwardNarration = `${lowercaseFirst(subjectForActor(backgroundAction.actor))} ${backgroundAction.recommendedVerbForms?.[0]} and ${lowercaseFirst(subjectForActor(eventAction.actor))} ${eventAction.recommendedVerbForms?.[0]}`
  const punctuationNarration = `${lowercaseFirst(subjectForActor(backgroundAction.actor))} ${backgroundAction.recommendedVerbForms?.[0]} ${lowercaseFirst(subjectForActor(eventAction.actor))} ${eventAction.recommendedVerbForms?.[0]}`
  const mixedNarration = `${sentenceCase(eventAction.visibleAs)} ${actionSentence(backgroundAction, backgroundAction.recommendedVerbForms?.[0]).toLowerCase()}`
  const shortNarration = actionSentence(eventAction).trim()
  const relationshipUnclear = `${actionSentence(backgroundAction)} ${actionSentence(simultaneousActionOr(parts))}`
  const overcomplicated = `${whenSentence.replace(/\.$/, '')} because ${lowercaseFirst(subjectForActor(reactionAction.actor))} ${reactionAction.recommendedVerbForms?.[0]}.`
  const advancedAwkward = `${subjectForActor(backgroundAction.actor)} had been ${stripAuxiliary(backgroundAction.recommendedVerbForms?.[0])} when ${lowercaseFirst(subjectForActor(eventAction.actor))} ${eventAction.recommendedVerbForms?.[0]}.`
  const earlierButWrong = `${subjectForActor(earlierAction.actor)} was ${stripAuxiliary(earlierAction.recommendedVerbForms?.find((verb) => verb.includes('had been')) || earlierAction.recommendedVerbForms?.[0])} before that.`

  return [
    makeCase(scene, 'basic', 'basic-clear-short', simpleNarration, 'Describe the scene clearly in the past.', 'none'),
    makeCase(scene, 'basic', 'basic-clear-detail', secondNarration, 'Add one more clear past detail.', 'none'),
    makeCase(scene, 'basic', 'basic-awkward-understandable', awkwardNarration, 'Keep the answer basic but improve clarity.', 'none'),
    makeCase(scene, 'basic', 'basic-punctuation-caps', punctuationNarration, 'Stay basic and fix surface issues only.', 'none'),
    makeCase(scene, 'basic', 'basic-mixed-verb-choice', mixedNarration, 'Past choices are unstable and should not trigger readiness.', 'none'),
    makeCase(scene, 'basic', 'basic-underdeveloped', shortNarration, 'Relevant but underdeveloped answer.', 'none'),
    makeCase(scene, 'basic', 'basic-higher-grammar-connector', whenSentence, 'Accept correct higher-level grammar without forcing more.', 'none'),
    makeCase(scene, 'basic', 'basic-higher-grammar-earlier', earlierSentence, 'Accept correct had or had been without removing it.', 'none'),
    makeCase(scene, 'basic', 'readiness-basic', secondNarration, 'Clear basic narration with stable prior attempts may show a soft readiness hint.', 'yes', stableHistory('basic')),

    makeCase(scene, 'intermediate', 'intermediate-no-connector', simpleNarration, 'Should ask to connect actions.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-correct-when', whenSentence, 'Should reinforce action relationships.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-correct-while', whileSentence, 'Should reinforce overlap/relationship language.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-wrong-when', `${subjectForActor(eventAction.actor)} ${eventAction.recommendedVerbForms?.[0]} when ${lowercaseFirst(subjectForActor(backgroundAction.actor))} ${backgroundAction.recommendedVerbForms?.[0]}.`, 'Misused connector should not count as clear readiness.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-wrong-while', `${subjectForActor(eventAction.actor)} ${eventAction.recommendedVerbForms?.[0]} while ${lowercaseFirst(subjectForActor(backgroundAction.actor))} ${backgroundAction.recommendedVerbForms?.[0]}.`, 'Misused overlap language should stay inside intermediate.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-relationship-unclear', relationshipUnclear, 'Should focus on linking actions, not earlier past.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-already-had', `${whenSentence.replace(/\.$/, '')} ${earlierSentence}`, 'Should keep earlier past if student already used it.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-too-basic', shortNarration, 'Too basic for intermediate should still stay inside intermediate.', 'none'),
    makeCase(scene, 'intermediate', 'intermediate-overcomplicated', overcomplicated, 'Partly correct overcomplication should not jump straight to advanced.', 'none'),
    makeCase(scene, 'intermediate', 'readiness-intermediate', `${whenSentence} ${actionSentence(reactionAction)}`, 'Clear action-linking across attempts may show a soft readiness hint.', 'yes', stableHistory('intermediate')),

    makeCase(scene, 'advanced', 'advanced-no-earlier-event', whenSentence, 'Should ask for earlier past.', 'none'),
    makeCase(scene, 'advanced', 'advanced-correct-had', earlierSentence, 'Should reinforce earlier event meaning.', 'none'),
    makeCase(scene, 'advanced', 'advanced-correct-had-been', buildHadBeenSentence(scene, parts), 'Should reinforce earlier ongoing action meaning.', 'none'),
    makeCase(scene, 'advanced', 'advanced-wrong-had', `${subjectForActor(eventAction.actor)} had ${eventAction.recommendedVerbForms?.[0]} when ${lowercaseFirst(subjectForActor(backgroundAction.actor))} ${backgroundAction.recommendedVerbForms?.[0]}.`, 'Wrong had usage should be corrected without losing timeline focus.', 'none'),
    makeCase(scene, 'advanced', 'advanced-wrong-had-been', `${subjectForActor(eventAction.actor)} had been ${stripAuxiliary(eventAction.recommendedVerbForms?.[0])} before that.`, 'Wrong had been usage should be corrected.', 'none'),
    makeCase(scene, 'advanced', 'advanced-earlier-meaning-wrong-form', earlierButWrong, 'Earlier-time meaning with wrong form should target had/had been.', 'none'),
    makeCase(scene, 'advanced', 'advanced-awkward', advancedAwkward, 'Awkward advanced grammar should stay focused on earlier past.', 'none'),
    makeCase(scene, 'advanced', 'advanced-stronger-than-needed', `${earlierSentence} ${whenSentence}`, 'Stronger advanced answer should still keep timeline clarity.', 'none'),
    makeCase(scene, 'advanced', 'advanced-poor-timeline-clarity', `${subjectForActor(earlierAction.actor)} ${earlierAction.recommendedVerbForms?.find((verb) => verb.includes('had')) || `had ${stripAuxiliary(earlierAction.recommendedVerbForms?.[0])}`}. ${subjectForActor(eventAction.actor)} ${eventAction.recommendedVerbForms?.[0]}.`, 'Technically correct but weak timeline link.', 'none'),
  ]
}

function simultaneousActionOr(parts) {
  return parts.simultaneousAction || parts.reactionAction || parts.eventAction
}

function stripAuxiliary(verb = '') {
  return String(verb)
    .replace(/\b(was|were|had been|had|is|are)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'doing something'
}

function buildHadBeenSentence(scene, parts) {
  const action = parts.earlierAction || parts.backgroundAction
  const hadBeen = action?.recommendedVerbForms?.find((verb) => verb.includes('had been'))
  const fallback = hadBeen || `had been ${stripAuxiliary(action?.recommendedVerbForms?.[0])}`
  return `${subjectForActor(action.actor)} ${fallback} before ${lowercaseFirst(subjectForActor(parts.eventAction.actor))} ${parts.eventAction.recommendedVerbForms?.[0]}.`
}

function makeCase(scene, selectedDifficulty, variant, studentText, levelTarget, readinessHintShouldBe = 'none', recentAttemptHistory = []) {
  const expectedFeedbackBehavior = createExpectedFeedbackBehavior(selectedDifficulty, variant)
  expectedFeedbackBehavior.readinessHintShouldBe = readinessHintShouldBe

  return {
    caseId: `${scene.id}__${selectedDifficulty}__${variant}`,
    sceneId: scene.id,
    sceneTitle: scene.title,
    sceneDataSource: sceneSourceFile(),
    selectedDifficulty,
    studentText,
    recentAttemptHistory,
    expectedDifficultyBehavior: {
      shouldStayWithinLevelByDefault: true,
      shouldAcceptHigherLevelGrammarIfPresent: true,
      shouldAvoidAutomaticEscalation: true,
      levelTarget,
    },
    expectedFeedbackBehavior,
    notes: variant,
  }
}

function generateCases() {
  return scenes.flatMap((scene) => buildCasesForScene(scene))
}

async function loadOrCreateCases() {
  try {
    const existing = JSON.parse(await fs.readFile(qcCasesPath, 'utf8'))
    return Array.isArray(existing) && existing.length ? existing : []
  } catch {
    return []
  }
}

function selectCasesForMode(cases, currentMode) {
  if (currentMode !== 'live_model_mode') {
    return cases
  }

  const selected = []

  for (const scene of scenes) {
    for (const variant of liveSubsetVariants) {
      const match = cases.find((qcCase) => qcCase.sceneId === scene.id && qcCase.notes === variant)
      if (match) {
        selected.push(match)
      }
    }
  }

  return selected
}

async function runCase(qcCase) {
  const scene = scenes.find((item) => item.id === qcCase.sceneId)
  const json = await generateFeedback({
    answer: qcCase.studentText,
    scene: {
      title: scene.title,
      setting: scene.setting,
      prompt: scene.prompt,
      focus: scene.focus,
      sample: scene.sample,
      sceneScript: scene.sceneScript,
    },
    challenge: {
      id: difficultyMap[qcCase.selectedDifficulty],
      ...(scene.challengeModes?.[difficultyMap[qcCase.selectedDifficulty]] ?? {}),
    },
    feedbackLanguage: 'English',
    recentAttemptHistory: qcCase.recentAttemptHistory,
  })
  return {
    caseId: qcCase.caseId,
    sceneId: qcCase.sceneId,
    sceneTitle: qcCase.sceneTitle,
    selectedDifficulty: qcCase.selectedDifficulty,
    displayedInstructionText: englishUi.challengePrompts[qcCase.selectedDifficulty],
    quickHintText: buildQuickHints(scene, qcCase.selectedDifficulty),
    coachNote: json.summary,
    whatWorked: json.strengths ?? [],
    tryThis: json.corrections ?? [],
    betterVersion: json.rewrite,
    detectedFeatures: {
      verbForms: json.detected?.verbForms ?? [],
      connectors: json.detected?.connectors ?? [],
      timeRelationships: json.detected?.timeRelationships ?? [],
    },
    nextStep: json.challenge,
    readinessHint: json.levelReadinessHint ?? null,
    levelSuggestion: json.levelReadinessHint ?? null,
    autoLevelSwitchBehavior: false,
    rawFeedback: json,
  }
}

function containsAny(text, patterns) {
  const lower = String(text ?? '').toLowerCase()
  return patterns.some((pattern) => lower.includes(pattern))
}

function scoreLabel(pass, partial) {
  if (pass) return 'PASS'
  if (partial) return 'PARTIAL'
  return 'FAIL'
}

function evaluateCase(qcCase, result) {
  const combinedWorked = [result.coachNote, ...result.whatWorked].join(' ')
  const betterVersion = String(result.betterVersion ?? '')
  const nextStep = String(result.nextStep ?? '')
  const readinessHint = String(result.readinessHint ?? '')
  const student = String(qcCase.studentText ?? '')
  const features = result.detectedFeatures

  const summaryHasFormMeaning =
    containsAny(combinedWorked, ['simple past', 'past continuous', 'past perfect', 'past perfect continuous']) &&
    containsAny(combinedWorked, ['background', 'main event', 'completed action', 'earlier', 'ongoing', 'relate in time', 'before'])
  const summaryUsesStudentWords = /\([^()]+\)/.test(combinedWorked)

  const basicLeak =
    qcCase.selectedDifficulty === 'basic' &&
    !containsAny(student, [' when ', ' while ', 'had ', 'had been']) &&
    containsAny(`${betterVersion} ${nextStep}`, [' when ', ' while ', 'had ', 'had been'])
  const intermediateLeak =
    qcCase.selectedDifficulty === 'intermediate' &&
    !containsAny(student, ['had ', 'had been']) &&
    containsAny(betterVersion, ['had ', 'had been'])
  const advancedMiss =
    qcCase.selectedDifficulty === 'advanced' &&
    !containsAny(betterVersion, ['had ', 'had been']) &&
    !containsAny(nextStep, ['had ', 'had been'])

  const nextStepIsImperative =
    /^(add|try|connect|include|show)\b/i.test(nextStep.trim()) &&
    nextStep.split(/\s+/).filter(Boolean).length <= 18
  const nextStepLevelSafe =
    (qcCase.selectedDifficulty === 'basic' && !containsAny(nextStep, ['when', 'while', 'had ', 'had been'])) ||
    (qcCase.selectedDifficulty === 'intermediate' && !containsAny(nextStep, ['had been']) && !containsAny(nextStep, ['simple past'])) ||
    (qcCase.selectedDifficulty === 'advanced' && containsAny(nextStep, ['had', 'had been', 'before']))

  const readinessAllowed = qcCase.expectedFeedbackBehavior.readinessHintShouldBe === 'yes'
  const readinessSoft =
    !readinessHint ||
    (/^(you’re|you can|now try|if you want a challenge)/i.test(readinessHint) &&
      !containsAny(readinessHint, ['passed', 'level up', 'move up', 'switch to', 'you are now level']))
  const readinessScore = scoreLabel(
    (readinessAllowed && Boolean(readinessHint) && readinessSoft) || (!readinessAllowed && !readinessHint),
    readinessSoft,
  )

  const betterVersionOverlap = overlapRatio(student, betterVersion)
  const betterVersionQuality = scoreLabel(
    betterVersionOverlap >= 0.45 && !containsAny(betterVersion, ['this shows why the next action happened', 'before that, something had already happened']),
    betterVersionOverlap >= 0.3,
  )

  const difficultyFindings = []
  if (basicLeak) difficultyFindings.push('basic leaked higher-level grammar by default')
  if (intermediateLeak) difficultyFindings.push('intermediate betterVersion introduced advanced grammar by default')
  if (advancedMiss) difficultyFindings.push('advanced did not target earlier past clearly')
  if (!nextStepLevelSafe) difficultyFindings.push('nextStep crossed level boundary')
  if (readinessScore !== 'PASS') difficultyFindings.push('readiness hint discipline issue')

  const feedbackFindings = []
  if (!summaryHasFormMeaning) feedbackFindings.push('feedback did not connect form to meaning clearly')
  if (!summaryUsesStudentWords) feedbackFindings.push('feedback did not reference student wording')
  if (betterVersionQuality !== 'PASS') feedbackFindings.push('better version felt generic or artificial')
  if (!nextStepIsImperative) feedbackFindings.push('nextStep was not a short imperative prompt')
  if (result.rawFeedback.sceneFit === 'not scene-based') feedbackFindings.push('feedback lost scene grounding')

  return {
    caseId: qcCase.caseId,
    sceneId: qcCase.sceneId,
    selectedDifficulty: qcCase.selectedDifficulty,
    difficultySystem: {
      levelClarity: scoreLabel(!basicLeak && !intermediateLeak && !advancedMiss, nextStepLevelSafe),
      levelBoundarySafety: scoreLabel(!basicLeak && !intermediateLeak && !advancedMiss, !advancedMiss),
      levelProgression: scoreLabel(nextStepLevelSafe, true),
      toleranceOfStrongerStudents: scoreLabel(
        !(
          containsAny(student, [' when ', ' while ', 'had ', 'had been']) &&
          containsAny(`${betterVersion} ${nextStep}`, ['remove', 'instead of'])
        ),
        true,
      ),
      betterVersionLevelSafety: scoreLabel(!basicLeak && !intermediateLeak && !advancedMiss, betterVersionQuality !== 'FAIL'),
      nextStepLevelSafety: scoreLabel(nextStepLevelSafe, nextStepIsImperative),
      readinessHintDiscipline: readinessScore,
      findings: difficultyFindings,
    },
    feedbackEngine: {
      grammarFunctionLink: scoreLabel(summaryHasFormMeaning, containsAny(combinedWorked, ['simple past', 'past continuous', 'past perfect'])),
      specificity: scoreLabel(summaryUsesStudentWords, betterVersionOverlap >= 0.45),
      classroomUsefulness: scoreLabel(summaryHasFormMeaning && nextStepIsImperative, nextStepIsImperative),
      sceneRelevance: scoreLabel(result.rawFeedback.sceneFit !== 'not scene-based', result.rawFeedback.sceneFit === 'partly on scene'),
      betterVersionQuality,
      nextStepQuality: scoreLabel(nextStepIsImperative && nextStepLevelSafe, nextStepIsImperative),
      readinessHintQuality: readinessScore,
      findings: feedbackFindings,
    },
  }
}

function overlapRatio(first, second) {
  const a = new Set(String(first ?? '').toLowerCase().match(/[a-z']+/g) ?? [])
  const b = new Set(String(second ?? '').toLowerCase().match(/[a-z']+/g) ?? [])
  if (!a.size || !b.size) return 0
  const shared = [...a].filter((word) => b.has(word))
  return shared.length / a.size
}

function aggregateFailurePatterns(evaluations) {
  const patterns = new Map()

  const register = (failureId, bucket, description, representativeCase) => {
    const current = patterns.get(failureId) ?? {
      failureId,
      bucket,
      description,
      frequency: 0,
      severity: bucket === 'difficulty' ? 'high' : 'medium',
      pedagogicalImpact: bucket === 'difficulty'
        ? 'Weakens level boundaries and progression.'
        : 'Reduces the classroom value of the coaching.',
      representativeCaseIds: [],
    }
    current.frequency += 1
    if (current.representativeCaseIds.length < 5) {
      current.representativeCaseIds.push(representativeCase)
    }
    patterns.set(failureId, current)
  }

  for (const evaluation of evaluations) {
    for (const finding of evaluation.difficultySystem.findings) {
      register(slugify(finding), 'difficulty', finding, evaluation.caseId)
    }
    for (const finding of evaluation.feedbackEngine.findings) {
      register(slugify(finding), 'feedback', finding, evaluation.caseId)
    }
  }

  return [...patterns.values()].sort((left, right) => right.frequency - left.frequency)
}

function specificityScore(result) {
  const text = [result.coachNote, ...(result.whatWorked ?? [])].join(' ')
  let score = 0

  if (containsAny(text, ['simple past', 'past continuous', 'past perfect', 'past perfect continuous'])) score += 1
  if (/\([^()]+\)/.test(text)) score += 1
  if (containsAny(text, ['background', 'main event', 'completed action', 'earlier', 'ongoing', 'before'])) score += 1

  return score
}

function grammarExplanationScore(result) {
  const text = [result.coachNote, ...(result.whatWorked ?? [])].join(' ')
  let score = 0

  if (containsAny(text, ['simple past', 'past continuous', 'past perfect', 'past perfect continuous'])) score += 1
  if (containsAny(text, ['background', 'main event', 'earlier', 'ongoing action', 'completed action'])) score += 1
  if (containsAny(text, ['when', 'while', 'before']) && containsAny(text, ['relate', 'background', 'main event', 'earlier'])) score += 1

  return score
}

function modelUnexpectedBehavior(result, evaluation) {
  const issues = []

  if (evaluation.difficultySystem.nextStepLevelSafety !== 'PASS') {
    issues.push('nextStep crossed the selected level boundary')
  }

  if (evaluation.feedbackEngine.betterVersionQuality !== 'PASS') {
    issues.push('betterVersion became generic or artificial')
  }

  if (
    containsAny(result.betterVersion, [
      'before that, something had already happened',
      'this shows why the next action happened',
    ])
  ) {
    issues.push('betterVersion used generic filler language')
  }

  if (result.readinessHint && !/^(you’re|you can|now try|if you want a challenge)/i.test(result.readinessHint)) {
    issues.push('readiness hint used stronger-than-intended framing')
  }

  return issues
}

async function writeModelDiffReport() {
  try {
    const deterministic = JSON.parse(await fs.readFile(deterministicResultsPath, 'utf8'))
    const live = JSON.parse(await fs.readFile(liveResultsPath, 'utf8'))
    const liveEval = JSON.parse(await fs.readFile(path.join(outputDir, 'QC_EVAL_LIVE.json'), 'utf8'))
    const liveEvalMap = new Map(liveEval.evaluations.map((item) => [item.caseId, item]))
    const deterministicMap = new Map(deterministic.results.map((item) => [item.caseId, item]))

    const phrasingDiffs = []
    const specificityLosses = []
    const grammarLosses = []
    const unexpected = []

    for (const liveResult of live.results) {
      const deterministicResult = deterministicMap.get(liveResult.caseId)
      if (!deterministicResult) continue

      const phrasingChanged =
        deterministicResult.coachNote !== liveResult.coachNote ||
        deterministicResult.betterVersion !== liveResult.betterVersion ||
        deterministicResult.nextStep !== liveResult.nextStep

      if (phrasingChanged) {
        phrasingDiffs.push(liveResult.caseId)
      }

      if (specificityScore(liveResult) < specificityScore(deterministicResult)) {
        specificityLosses.push({
          caseId: liveResult.caseId,
          deterministic: deterministicResult.coachNote,
          live: liveResult.coachNote,
        })
      }

      if (grammarExplanationScore(liveResult) < grammarExplanationScore(deterministicResult)) {
        grammarLosses.push({
          caseId: liveResult.caseId,
          deterministic: deterministicResult.coachNote,
          live: liveResult.coachNote,
        })
      }

      const liveIssues = modelUnexpectedBehavior(liveResult, liveEvalMap.get(liveResult.caseId))
      if (liveIssues.length) {
        unexpected.push({
          caseId: liveResult.caseId,
          issues: liveIssues,
          betterVersion: liveResult.betterVersion,
          nextStep: liveResult.nextStep,
          readinessHint: liveResult.readinessHint,
        })
      }
    }

    const lines = [
      '# Model Diff',
      '',
      `- Deterministic cases: **${deterministic.results.length}**`,
      `- Live cases: **${live.results.length}**`,
      `- Overlapping cases compared: **${live.results.length}**`,
      '',
      '## Summary',
      '',
      `- Cases with phrasing differences: **${phrasingDiffs.length}**`,
      `- Cases with lower specificity in live output: **${specificityLosses.length}**`,
      `- Cases with degraded grammar explanation in live output: **${grammarLosses.length}**`,
      `- Cases with unexpected live-model behavior: **${unexpected.length}**`,
      '',
      '## Phrasing Differences',
      '',
      phrasingDiffs.length
        ? phrasingDiffs.slice(0, 20).map((caseId) => `- \`${caseId}\``).join('\n')
        : '- None observed.',
      '',
      '## Loss of Specificity',
      '',
      specificityLosses.length
        ? specificityLosses.slice(0, 8).map((item) => `### \`${item.caseId}\`\n- Deterministic: ${item.deterministic}\n- Live: ${item.live}`).join('\n\n')
        : '- None observed.',
      '',
      '## Degraded Grammar Explanations',
      '',
      grammarLosses.length
        ? grammarLosses.slice(0, 8).map((item) => `### \`${item.caseId}\`\n- Deterministic: ${item.deterministic}\n- Live: ${item.live}`).join('\n\n')
        : '- None observed.',
      '',
      '## Unexpected Model Behavior',
      '',
      unexpected.length
        ? unexpected.slice(0, 8).map((item) => `### \`${item.caseId}\`\n- Issues: ${item.issues.join('; ')}\n- Better version: ${item.betterVersion}\n- Next step: ${item.nextStep}${item.readinessHint ? `\n- Readiness hint: ${item.readinessHint}` : ''}`).join('\n\n')
        : '- None observed.',
    ]

    await fs.writeFile(path.join(outputDir, 'QC_DIFF_MODEL.md'), `${lines.join('\n')}\n`)
  } catch {
    // Report is written only when both deterministic and live outputs are available.
  }
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function sceneSourceDocument() {
  return `# QC Scene Source

- Scene source of truth: [src/data/scenes.js](${sceneSourceFile()})
- Scene count: ${scenes.length}
- QC uses direct scene-model access from the live app source.
- App scene loading: the app imports \`scenes\` from \`src/data/scenes.js\`, and the feedback request sends the selected scene's \`title\`, \`setting\`, \`prompt\`, \`focus\`, \`sample\`, and \`sceneScript\` to the feedback engine.
- Available top-level fields per scene:
  - \`id\`
  - \`title\`
  - \`setting\`
  - \`image\`
  - \`prompt\`
  - \`focus\`
  - \`sample\`
  - \`palette\`
  - \`objects\`
  - \`actions\`
  - \`sceneScript\`
  - \`challengeModes\`
- Available \`sceneScript\` fields:
  - \`premise\`
  - \`visualStyle\`
  - \`characters\`
  - \`coreActions\`
  - \`environmentActions\`
  - \`relationships\`
  - \`targetRelationships\`
- QC notes:
  - Scene IDs and scene semantics are loaded directly from the live scene model file.
  - Displayed instruction text and quick-hint strings are reproduced from the current English UI copy in [src/App.jsx](/Users/erikgw/Documents/tellastory/src/App.jsx) so the QC run reflects the actual lesson framing.
  - \`deterministic_mode\` runs the extracted backend function with the local/deterministic path and evaluates every case in \`QC_CASES.json\`.
  - \`live_model_mode\` runs the same feedback function through the real LLM path and uses a cost-controlled subset drawn from \`QC_CASES.json\` (${liveSubsetVariants.join(', ')} per scene when present).
`
}

async function writeJson(filename, data) {
  await fs.writeFile(path.join(outputDir, filename), JSON.stringify(data, null, 2))
}

async function main() {
  let cases = await loadOrCreateCases()
  if (!cases.length) {
    cases = generateCases()
    await writeJson('QC_CASES.json', cases)
  }

  const modeCases = selectCasesForMode(cases, mode)
  await fs.writeFile(path.join(outputDir, 'QC_SCENE_SOURCE.md'), sceneSourceDocument())

  const results = []
  for (const qcCase of modeCases) {
    results.push(await runCase(qcCase))
  }

  const evaluations = modeCases.map((qcCase) => evaluateCase(qcCase, results.find((result) => result.caseId === qcCase.caseId)))
  const failurePatterns = aggregateFailurePatterns(evaluations)

  await writeJson(outputConfig.resultFile, {
    generatedAt: new Date().toISOString(),
    mode,
    endpoint: mode === 'live_model_mode' ? 'generateFeedback:llm-path' : 'generateFeedback:deterministic-path',
    totalCases: modeCases.length,
    results,
  })
  await writeJson(outputConfig.evalFile, {
    generatedAt: new Date().toISOString(),
    mode,
    totalCases: modeCases.length,
    evaluations,
    failurePatterns,
  })

  await writeModelDiffReport()

  console.log(JSON.stringify({
    mode: outputConfig.label,
    totalScenes: scenes.length,
    totalCases: modeCases.length,
    topFailurePatterns: failurePatterns.slice(0, 10),
  }, null, 2))
}

await main()
