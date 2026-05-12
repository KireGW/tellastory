import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.VERCEL = '1'
process.env.OPENAI_API_KEY = ''

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const casesPath = path.join(repoRoot, 'qc', 'feedback-engine', 'DEBUG_CASES.json')

const { scenes } = await import('../src/data/scenes.js')
const { generateFeedback, analyzeAnswer } = await import('../server/index.js')

const args = parseArgs(process.argv.slice(2))
const mode = args.audit ? 'audit' : 'inspect'
const allCases = await loadCases()

if (args.list) {
  printCaseList(allCases)
  process.exit(0)
}

const debugInput = await resolveInput(args, allCases)
const challenge = {
  id: debugInput.selectedDifficulty,
  label: sentenceCase(debugInput.selectedDifficulty),
}

const feedback = await generateFeedback({
  answer: debugInput.studentText,
  scene: pickScenePayload(debugInput.scene),
  challenge,
  feedbackLanguage: debugInput.feedbackLanguage ?? 'English',
  recentAttemptHistory: debugInput.recentAttemptHistory ?? [],
})

const analysis = analyzeAnswer(debugInput.studentText, debugInput.scene, challenge)
const diagnostics = buildDiagnostics(debugInput, feedback, analysis)

if (mode === 'inspect') {
  console.log(JSON.stringify(diagnostics, null, 2))
  process.exit(0)
}

const issues = auditCase(debugInput, feedback, diagnostics)
const result = {
  mode,
  caseId: debugInput.id ?? null,
  sceneId: debugInput.scene.id,
  selectedDifficulty: debugInput.selectedDifficulty,
  answer: debugInput.studentText,
  outcome: {
    verdict: feedback.verdict,
    sceneFit: feedback.sceneFit,
    taskFit: feedback.taskFit,
  },
  issueCount: issues.length,
  issues,
}

console.log(JSON.stringify(result, null, 2))

if (issues.length) {
  process.exitCode = 1
}

async function loadCases() {
  const raw = await fs.readFile(casesPath, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

async function resolveInput(args, allCases) {
  if (args.case) {
    const selected = allCases.find((entry) => entry.id === args.case)

    if (!selected) {
      throw new Error(`Unknown debug case: ${args.case}`)
    }

    return hydrateCase(selected)
  }

  if (!args.scene || !args.level || !args.answer) {
    throw new Error('Use --case <id> or provide --scene <scene-id-or-title> --level <beginner|intermediate|advanced> --answer "..."')
  }

  return hydrateCase({
    id: null,
    sceneId: args.scene,
    selectedDifficulty: args.level,
    studentText: args.answer,
    inputQuality: 'ad-hoc',
    feedbackLanguage: args.language ?? 'English',
    recentAttemptHistory: [],
    expect: {},
  })
}

function hydrateCase(entry) {
  const scene = findScene(entry.sceneId)

  if (!scene) {
    throw new Error(`Missing scene for case ${entry.id ?? '(ad-hoc)'}: ${entry.sceneId}`)
  }

  return {
    ...entry,
    selectedDifficulty: String(entry.selectedDifficulty ?? '').toLowerCase(),
    feedbackLanguage: entry.feedbackLanguage ?? 'English',
    recentAttemptHistory: entry.recentAttemptHistory ?? [],
    expect: entry.expect ?? {},
    scene,
  }
}

function findScene(sceneKey) {
  const normalized = String(sceneKey ?? '').trim().toLowerCase()
  return scenes.find((scene) =>
    scene.id.toLowerCase() === normalized ||
    scene.title.toLowerCase() === normalized
  )
}

function pickScenePayload(scene) {
  return {
    title: scene.title,
    setting: scene.setting,
    prompt: scene.prompt,
    focus: scene.focus,
    sample: scene.sample,
    sceneScript: scene.sceneScript,
  }
}

function buildDiagnostics(debugInput, feedback, analysis) {
  return {
    mode: 'inspect',
    caseId: debugInput.id ?? null,
    inputQuality: debugInput.inputQuality ?? 'ad-hoc',
    sceneId: debugInput.scene.id,
    sceneTitle: debugInput.scene.title,
    selectedDifficulty: debugInput.selectedDifficulty,
    answer: debugInput.studentText,
    expected: debugInput.expect,
    analysis: {
      sceneFit: analysis.sceneFit,
      taskFit: analysis.taskFit,
      semanticTenseFit: analysis.semanticTenseFit,
      sceneAnchoring: {
        isOnScene: analysis.sceneAnchoring?.isOnScene ?? false,
        highNonsense: analysis.sceneAnchoring?.highNonsense ?? false,
        matchedActionCount: analysis.mentionedActions?.length ?? 0,
        mentionedActions: analysis.mentionedActions ?? [],
      },
      features: summarizeFeatures(analysis.features),
    },
    feedback: {
      verdict: feedback.verdict,
      englishStatus: feedback.englishStatus,
      sceneFit: feedback.sceneFit,
      taskFit: feedback.taskFit,
      summary: feedback.summary,
      strengths: feedback.strengths ?? [],
      corrections: feedback.corrections ?? [],
      rewrite: feedback.rewrite ?? '',
      challenge: feedback.challenge ?? '',
      detected: feedback.detected ?? {},
    },
  }
}

function summarizeFeatures(features = {}) {
  const keys = [
    'hasSimplePast',
    'hasPastContinuous',
    'hasPastPerfect',
    'hasPastPerfectContinuous',
    'hasAnyPastVerb',
    'hasWhen',
    'hasWhile',
    'hasBecause',
    'hasRelationshipConnector',
    'hasPresentSignal',
  ]

  return Object.fromEntries(keys.map((key) => [key, Boolean(features[key])]))
}

function auditCase(debugInput, feedback, diagnostics) {
  const issues = []
  const expect = debugInput.expect ?? {}
  const combinedText = feedbackTextBlob(feedback)
  const corrections = Array.isArray(feedback.corrections) ? feedback.corrections : []

  maybePush(issues, compareExpectedStatus('verdict', expect.verdict, feedback.verdict))
  maybePush(issues, compareExpectedStatus('sceneFit', expect.sceneFit, feedback.sceneFit))
  maybePush(issues, compareExpectedStatus('taskFit', expect.taskFit, feedback.taskFit))

  if (Object.hasOwn(expect, 'rewriteShouldBeEmpty') && expect.rewriteShouldBeEmpty && String(feedback.rewrite || '').trim()) {
    issues.push(issue(
      'Better version shown unnecessarily',
      `Expected no Better version, but got: "${feedback.rewrite}".`,
      'Hide Better version when the student text is already usable or when the answer should be extended rather than rewritten.',
      'normalizeRewrite(...) / ensureDistinctRewrite(...) / normalizeFeedback(...)',
    ))
  }

  for (const snippet of arrayOfStrings(expect.mustContainText)) {
    if (!combinedText.toLowerCase().includes(snippet.toLowerCase())) {
      issues.push(issue(
        'Expected coaching signal missing',
        `Expected the feedback to mention: "${snippet}".`,
        'Tighten the matching rule or summary/correction selection so this teaching point reliably surfaces.',
        'normalizeFeedback(...) / buildNarrativeTeachingSummary(...) / generateNextStep(...)',
      ))
    }
  }

  for (const snippet of arrayOfStrings(expect.mustNotContainText)) {
    if (combinedText.toLowerCase().includes(snippet.toLowerCase())) {
      issues.push(issue(
        'Forbidden text surfaced',
        `The feedback contains text that should not appear: "${snippet}".`,
        'Add or tighten a guard so this phrase is blocked before summary, Try this, or Better version is shown.',
        'cleanFeedbackText(...) / normalizeUsefulCorrections(...) / normalizeRewrite(...)',
      ))
    }
  }

  if (expect.lastCorrectionShouldMention && corrections.length > 1) {
    const lastCorrectionBlob = `${corrections.at(-1)?.suggestion ?? ''} ${corrections.at(-1)?.reason ?? ''}`
    if (!lastCorrectionBlob.toLowerCase().includes(String(expect.lastCorrectionShouldMention).toLowerCase())) {
      issues.push(issue(
        'Surface-polish item not ordered last',
        `Expected the last Try this item to mention "${expect.lastCorrectionShouldMention}", but the last item was "${lastCorrectionBlob.trim()}".`,
        'Append capitalization/punctuation/spelling polish after the main content or grammar correction, not before it.',
        'appendOptionalCorrection(...) / normalizeUsefulCorrections(...)',
      ))
    }
  }

  const unsafeFragments = detectUnsafeOutput(feedback)
  for (const fragment of unsafeFragments) {
    issues.push(issue(
      'Unsafe learner-facing output',
      `Try this or Better version contains malformed English or punctuation: "${fragment}".`,
      'Strengthen the final safety gate so learner-facing suggestions are rejected or replaced before display.',
      'betterVersionHasGrammarErrors(...) / normalizeRewrite(...) / normalizeUsefulCorrections(...)',
    ))
  }

  if (
    /not clearly past yet|change the main verbs to the past tense/i.test(combinedText) &&
    (diagnostics.analysis.features.hasSimplePast || diagnostics.analysis.features.hasPastContinuous)
  ) {
    issues.push(issue(
      'Past-tense correction contradicts detected forms',
      'The feedback says the answer is not clearly in the past even though past forms were detected.',
      'Treat recognized simple past or past continuous as sufficient past evidence before tense-mismatch coaching is shown.',
      'buildTenseMismatchFeedback(...) / detectAnswerFeatures(...) / normalizeFeedback(...)',
    ))
  }

  if (
    diagnostics.analysis.sceneAnchoring.highNonsense &&
    String(feedback.rewrite || '').trim()
  ) {
    issues.push(issue(
      'Off-scene answer still got a Better version',
      'The answer looks strongly off-scene or nonsensical, but Better version is still shown.',
      'Hide Better version and redirect Try this back to visible scene elements when nonsense rate is high.',
      'assessSceneAnchoring(...) / normalizeFeedback(...) / normalizeRewrite(...)',
    ))
  }

  return issues
}

function compareExpectedStatus(label, expected, actual) {
  if (!expected || expected === actual) {
    return null
  }

  return issue(
    `Unexpected ${label}`,
    `Expected ${label} "${expected}" but got "${actual}".`,
    `Review the decision rule that assigns ${label} so this case lands in the expected bucket.`,
    likelyCodeAreaForStatus(label),
  )
}

function likelyCodeAreaForStatus(label) {
  if (label === 'verdict') {
    return 'normalizeVerdict(...) / verdictFromFeatures(...) / applyFeedbackConsistencyCaps(...)'
  }

  if (label === 'sceneFit') {
    return 'assessSceneAnchoring(...) / analyzeAnswer(...)'
  }

  return 'taskFitFromFeatures(...) / analyzeAnswer(...) / evaluateSemanticTenseFit(...)'
}

function detectUnsafeOutput(feedback) {
  const outputs = [
    ...(feedback.corrections ?? []).flatMap((item) => [item.suggestion, item.reason]),
    feedback.rewrite,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)

  const unsafe = new Set()

  for (const text of outputs) {
    if (/,\s*[.?!]/.test(text) || /[.?!]{2,}/.test(text)) {
      unsafe.add(text)
    }

    if (/\bis come\b/i.test(text) || /\bfun to watched\b/i.test(text)) {
      unsafe.add(text)
    }
  }

  return [...unsafe]
}

function feedbackTextBlob(feedback) {
  return [
    feedback.summary,
    ...(feedback.strengths ?? []),
    ...(feedback.corrections ?? []).flatMap((item) => [item.original, item.suggestion, item.reason, item.grammarFocus]),
    feedback.rewrite,
    feedback.challenge,
  ]
    .filter(Boolean)
    .join('\n')
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function sentenceCase(value = '') {
  const text = String(value).trim()
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

function issue(title, observed, suggestedFix, likelyCodeArea) {
  return {
    title,
    observed,
    suggestedFix,
    likelyCodeArea,
  }
}

function maybePush(items, value) {
  if (value) {
    items.push(value)
  }
}

function printCaseList(allCases) {
  console.log(JSON.stringify({
    casesPath,
    count: allCases.length,
    cases: allCases.map((entry) => ({
      id: entry.id,
      sceneId: entry.sceneId,
      selectedDifficulty: entry.selectedDifficulty,
      inputQuality: entry.inputQuality,
    })),
  }, null, 2))
}

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)

    if (['audit', 'inspect', 'list'].includes(key)) {
      parsed[key] = true
      continue
    }

    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      parsed[key] = next
      index += 1
      continue
    }

    parsed[key] = true
  }

  return parsed
}
