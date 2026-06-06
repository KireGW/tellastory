import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.VERCEL = '1'
process.env.OPENAI_API_KEY = ''

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputDir = path.join(repoRoot, 'qc', 'feedback-engine')

const { scenes } = await import('../src/data/scenes.js')
const {
  generateFeedback,
  detectPastTense,
  checkSceneMatch,
  checkLevelTarget,
  detectTargetStructure,
  getClarityScore,
  detectMajorErrors,
} = await import('../server/index.js')

const levels = ['beginner', 'intermediate', 'advanced']
const resultFile = path.join(outputDir, 'QC_TYPICAL_STUDENT_ANSWERS.json')
const reportFile = path.join(outputDir, 'QC_TYPICAL_STUDENT_ANSWERS_REPORT.md')

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
  'sparks',
  'oranges',
  'animals',
  'people',
  'shoppers',
  'vendors',
])

const highRatings = new Set(['excellent', 'good-work'])
const irregularBaseToPast = new Map([
  ['begin', 'began'],
  ['break', 'broke'],
  ['catch', 'caught'],
  ['come', 'came'],
  ['fall', 'fell'],
  ['fly', 'flew'],
  ['go', 'went'],
  ['run', 'ran'],
  ['sing', 'sang'],
  ['steal', 'stole'],
  ['swim', 'swam'],
  ['turn', 'turned'],
])
const irregularPastToBase = new Map([...irregularBaseToPast].map(([base, past]) => [past, base]))

function normalizeText(value = '') {
  return String(value ?? '').trim()
}

function sentenceCase(value = '') {
  const text = normalizeText(value)
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

function lowercaseFirst(value = '') {
  const text = normalizeText(value)
  return text ? `${text[0].toLowerCase()}${text.slice(1)}` : ''
}

function subjectForActor(actor = '') {
  const normalized = normalizeText(actor).toLowerCase()

  if (!normalized) return 'Someone'
  if (pluralActors.has(normalized) || (normalized.endsWith('s') && !normalized.endsWith('ss'))) {
    return sentenceCase(normalized)
  }

  if (['rain', 'smoke', 'milk', 'foam', 'coffee', 'wind', 'luggage'].includes(normalized)) {
    return sentenceCase(`the ${normalized}`)
  }

  return sentenceCase(`the ${normalized}`)
}

function stripLeadingArticle(value = '') {
  return normalizeText(value).replace(/^(the|a|an)\s+/i, '')
}

function stripAuxiliary(verb = '') {
  return normalizeText(verb)
    .replace(/\b(had been|was|were|had|is|are)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'doing something'
}

function firstVerb(value = '') {
  return normalizeText(value).toLowerCase().match(/[a-z]+/)?.[0] ?? ''
}

function simplePastFromBase(base = '') {
  const normalized = normalizeText(base).toLowerCase()

  if (!normalized) return ''
  if (irregularBaseToPast.has(normalized)) return irregularBaseToPast.get(normalized)
  if (normalized.endsWith('e')) return `${normalized}d`
  if (normalized.endsWith('y') && !/[aeiou]y$/.test(normalized)) return `${normalized.slice(0, -1)}ied`
  return `${normalized}ed`
}

function baseFromVerbPhrase(value = '') {
  const token = firstVerb(stripAuxiliary(value))

  if (!token) return ''
  if (irregularPastToBase.has(token)) return irregularPastToBase.get(token)
  if (token.endsWith('ied')) return `${token.slice(0, -3)}y`
  if (token.endsWith('ed')) {
    const withoutEd = token.replace(/ed$/, '')
    return /([bcdfghjklmnpqrstvwxyz])\1$/.test(withoutEd)
      ? withoutEd.slice(0, -1)
      : withoutEd
  }
  if (token.endsWith('ing')) return token.replace(/ing$/, '')
  return token
}

function generatedSimplePastVerb(action) {
  const direct = simplePastVerb(action)
  if (direct) return direct

  const base = baseFromVerbPhrase(action?.recommendedVerbForms?.[0])
  return simplePastFromBase(base) || 'acted'
}

function actionSentence(action, verbOverride = '') {
  if (!action) return 'Something happened.'
  const verb = verbOverride || generatedSimplePastVerb(action)
  return `${subjectForActor(action.actor)} ${verb}.`
}

function simplePastVerb(action) {
  return action?.recommendedVerbForms?.find((verb) => {
    const text = normalizeText(verb).toLowerCase()
    return text && !/\b(was|were|had|had been)\b/.test(text)
  })
}

function pastContinuousVerb(action) {
  return action?.recommendedVerbForms?.find((verb) => /\b(was|were)\b/i.test(verb))
}

function earlierPastVerb(action) {
  return action?.recommendedVerbForms?.find((verb) => /\bhad\b/i.test(verb))
}

function presentishVerb(action) {
  const base = baseFromVerbPhrase(action?.recommendedVerbForms?.[0]) || 'do'

  if (isPluralActor(action?.actor)) {
    return base
  }

  const needsEs = /(s|sh|ch|x|z|o)$/.test(base)
  const present = base.endsWith('y') && !/[aeiou]y$/.test(base)
    ? `${base.slice(0, -1)}ies`
    : needsEs
    ? `${base}es`
    : `${base}s`

  return present
}

function isPluralActor(actor = '') {
  const normalized = normalizeText(actor).toLowerCase()
  return pluralActors.has(normalized) || (normalized.endsWith('s') && !normalized.endsWith('ss'))
}

function hereClause(action) {
  return `${subjectForActor(action.actor)} ${isPluralActor(action.actor) ? 'are' : 'is'} here.`
}

function relation(scene, type) {
  return scene.sceneScript?.relationships?.find((item) => item.type === type)
}

function actionById(scene, actionId) {
  return scene.sceneScript?.coreActions?.find((action) => action.id === actionId)
}

function firstActionMatching(scene, predicate) {
  return scene.sceneScript?.coreActions?.find(predicate)
}

function pickParts(scene) {
  const interruption = relation(scene, 'interruption')
  const simultaneous = relation(scene, 'simultaneous-background')
  const earlierPast = relation(scene, 'earlier-past')
  const causeResult = relation(scene, 'cause-result') || relation(scene, 'reaction')
  const backgroundAction =
    actionById(scene, interruption?.backgroundAction) ||
    firstActionMatching(scene, (action) => action.grammarTargets?.includes('past continuous')) ||
    scene.sceneScript?.coreActions?.[0]
  const eventAction =
    actionById(scene, interruption?.interruptingAction) ||
    firstActionMatching(scene, (action) => action.grammarTargets?.includes('simple past')) ||
    scene.sceneScript?.coreActions?.[1] ||
    backgroundAction
  const reactionAction =
    actionById(scene, causeResult?.result) ||
    firstActionMatching(scene, (action) => action.id !== backgroundAction?.id && action.id !== eventAction?.id) ||
    eventAction
  const earlierAction =
    actionById(scene, earlierPast?.earlierAction) ||
    firstActionMatching(scene, (action) => action.grammarTargets?.includes('past perfect') || action.grammarTargets?.includes('past perfect continuous')) ||
    reactionAction
  const simultaneousAction =
    simultaneous?.actions
      ?.map((actionId) => actionById(scene, actionId))
      .find((action) => action?.id !== backgroundAction?.id) ||
    reactionAction

  return {
    interruption,
    simultaneous,
    earlierPast,
    backgroundAction,
    eventAction,
    reactionAction,
    earlierAction,
    simultaneousAction,
  }
}

function whenSentence(scene, parts) {
  return parts.interruption?.modelSentence ||
    `${subjectForActor(parts.backgroundAction.actor)} ${pastContinuousVerb(parts.backgroundAction) || parts.backgroundAction.recommendedVerbForms?.[0]} when ${lowercaseFirst(subjectForActor(parts.eventAction.actor))} ${simplePastVerb(parts.eventAction) || parts.eventAction.recommendedVerbForms?.[0]}.`
}

function whileSentence(scene, parts) {
  return parts.simultaneous?.modelSentence ||
    `${subjectForActor(parts.backgroundAction.actor)} ${pastContinuousVerb(parts.backgroundAction) || parts.backgroundAction.recommendedVerbForms?.[0]} while ${lowercaseFirst(subjectForActor(parts.simultaneousAction.actor))} ${pastContinuousVerb(parts.simultaneousAction) || parts.simultaneousAction.recommendedVerbForms?.[0]}.`
}

function earlierSentence(scene, parts) {
  return parts.earlierPast?.modelSentence ||
    `${subjectForActor(parts.earlierAction.actor)} ${earlierPastVerb(parts.earlierAction) || `had ${stripAuxiliary(parts.earlierAction.recommendedVerbForms?.[0])}`} before ${lowercaseFirst(subjectForActor(parts.eventAction.actor))} ${simplePastVerb(parts.eventAction) || parts.eventAction.recommendedVerbForms?.[0]}.`
}

function buildCasesForScene(scene) {
  const parts = pickParts(scene)
  const beginnerSecondAction = [parts.reactionAction, parts.backgroundAction, parts.simultaneousAction]
    .find((action) => action?.id && action.id !== parts.eventAction?.id) || parts.backgroundAction
  const goodBeginner = `${actionSentence(parts.eventAction)} ${actionSentence(beginnerSecondAction)}`
  const badBeginner = `${subjectForActor(parts.eventAction.actor)} ${presentishVerb(parts.eventAction)} now. ${hereClause(beginnerSecondAction)}`
  const goodIntermediate = whenSentence(scene, parts)
  const badIntermediate = `${actionSentence(parts.backgroundAction, generatedSimplePastVerb(parts.backgroundAction))} ${actionSentence(parts.eventAction)}`
  const goodAdvanced = earlierSentence(scene, parts)
  const badAdvanced = whileSentence(scene, parts)

  return [
    makeCase(scene, 'beginner', 'good', goodBeginner, 'Typical good beginner: short, relevant simple-past narration.'),
    makeCase(scene, 'beginner', 'bad', badBeginner, 'Typical weak beginner: present-ish fragments and thin scene narration.'),
    makeCase(scene, 'intermediate', 'good', goodIntermediate, 'Typical good intermediate: connects actions with when/while.'),
    makeCase(scene, 'intermediate', 'bad', badIntermediate, 'Typical weak intermediate: mentions actions but does not connect them clearly.'),
    makeCase(scene, 'advanced', 'good', goodAdvanced, 'Typical good advanced: shows an earlier past relationship.'),
    makeCase(scene, 'advanced', 'bad', badAdvanced, 'Typical weak advanced: uses past narration but misses the earlier-past target.'),
  ]
}

function makeCase(scene, level, quality, studentText, intent) {
  return {
    caseId: `${scene.id}__${level}__typical-${quality}`,
    sceneId: scene.id,
    sceneTitle: scene.title,
    level,
    quality,
    intent,
    studentText,
  }
}

function challengeFor(scene, level) {
  return {
    id: level,
    ...(scene.challengeModes?.[level] ?? {}),
  }
}

async function runCase(qcCase) {
  const scene = scenes.find((item) => item.id === qcCase.sceneId)
  const feedback = await generateFeedback({
    answer: qcCase.studentText,
    scene: {
      title: scene.title,
      setting: scene.setting,
      prompt: scene.prompt,
      focus: scene.focus,
      sample: scene.sample,
      sceneScript: scene.sceneScript,
    },
    challenge: challengeFor(scene, qcCase.level),
    feedbackLanguage: 'English',
  })
  const diagnostics = {
    isPastTense: detectPastTense(qcCase.studentText),
    isSceneRelevant: checkSceneMatch(qcCase.studentText, scene),
    meetsLevelTarget: checkLevelTarget({ level: qcCase.level, studentText: qcCase.studentText }),
    usesTargetStructure: detectTargetStructure({ level: qcCase.level, studentText: qcCase.studentText }),
    clarityScore: getClarityScore(qcCase.studentText),
    hasMajorErrors: detectMajorErrors(qcCase.studentText),
  }

  return {
    ...qcCase,
    feedback: {
      verdict: feedback.verdict,
      englishStatus: feedback.englishStatus,
      sceneFit: feedback.sceneFit,
      taskFit: feedback.taskFit,
      summary: feedback.summary,
      strengths: feedback.strengths ?? [],
      corrections: feedback.corrections ?? [],
      rewrite: feedback.rewrite ?? '',
      challenge: feedback.challenge,
      detected: feedback.detected ?? {},
      levelReadinessHint: feedback.levelReadinessHint ?? null,
    },
    diagnostics,
    findings: evaluateTypicalCase(qcCase, feedback, diagnostics),
  }
}

function includesAny(value, terms) {
  const lower = normalizeText(value).toLowerCase()
  return terms.some((term) => lower.includes(term))
}

function allFeedbackText(feedback) {
  return [
    feedback.summary,
    ...(feedback.strengths ?? []),
    ...(feedback.corrections ?? []).map((correction) => `${correction?.suggestion ?? ''} ${correction?.reason ?? ''}`),
    feedback.rewrite,
    feedback.challenge,
    feedback.levelReadinessHint,
  ].filter(Boolean).join(' ')
}

function evaluateTypicalCase(qcCase, feedback, diagnostics) {
  const findings = []
  const feedbackText = allFeedbackText(feedback)
  const isGood = qcCase.quality === 'good'
  const isBad = qcCase.quality === 'bad'
  const hasActionableCorrection = (feedback.corrections ?? []).some((correction) => normalizeText(correction?.suggestion))
  const correctionText = (feedback.corrections ?? []).map((correction) => `${correction?.suggestion ?? ''} ${correction?.reason ?? ''}`).join(' ')
  const correctionOnlySurface =
    hasActionableCorrection &&
    !includesAny(correctionText, ['past', 'when', 'while', 'had', 'before', 'scene', 'action', 'connect', 'relationship'])

  if (isGood && !highRatings.has(feedback.verdict)) {
    findings.push('good typical answer was not rewarded enough')
  }

  if (isGood && feedback.taskFit !== 'on target') {
    findings.push('good typical answer was not treated as on target')
  }

  if (isGood && feedback.sceneFit === 'not scene-based') {
    findings.push('good typical answer lost scene grounding')
  }

  if (isBad && feedback.verdict === 'excellent') {
    findings.push('weak typical answer was overpraised as excellent')
  }

  if (isBad && feedback.taskFit === 'on target' && !diagnostics.meetsLevelTarget) {
    findings.push('weak typical answer was marked on target despite missing the level goal')
  }

  if (isBad && !hasActionableCorrection) {
    findings.push('weak typical answer did not receive an actionable correction')
  }

  if (isBad && correctionOnlySurface && !diagnostics.meetsLevelTarget) {
    findings.push('weak typical answer got only surface feedback despite a level-target miss')
  }

  if (qcCase.level === 'beginner' && isBad && includesAny(feedbackText, ['had been', 'past perfect'])) {
    findings.push('beginner weak-answer feedback jumped to advanced grammar')
  }

  if (qcCase.level === 'beginner' && isGood && includesAny(`${feedback.rewrite} ${feedback.challenge}`, ['had ', 'had been'])) {
    findings.push('beginner good-answer next step leaked advanced grammar')
  }

  if (qcCase.level === 'intermediate' && isBad && includesAny(`${feedback.rewrite} ${feedback.challenge}`, ['had ', 'had been'])) {
    findings.push('intermediate weak-answer feedback jumped to advanced grammar')
  }

  if (qcCase.level === 'advanced' && isBad && !includesAny(`${feedback.summary} ${correctionText} ${feedback.challenge}`, ['had', 'had been', 'before', 'earlier'])) {
    findings.push('advanced weak-answer feedback did not clearly target earlier past')
  }

  if (isGood && feedback.rewrite && wordOverlap(qcCase.studentText, feedback.rewrite) < 0.35) {
    findings.push('good typical answer received a rewrite that drifted from student wording')
  }

  if (!includesAny(feedbackText, ['simple past', 'past continuous', 'past perfect', 'past perfect continuous'])) {
    findings.push('feedback did not name the relevant verb form')
  }

  if (!includesAny(feedbackText, ['completed', 'background', 'ongoing', 'earlier', 'before', 'connect', 'relationship', 'interrupted', 'sequence'])) {
    findings.push('feedback did not explain what the grammar does in the story')
  }

  return findings
}

function wordOverlap(first, second) {
  const firstWords = new Set(normalizeText(first).toLowerCase().match(/[a-z']+/g) ?? [])
  const secondWords = new Set(normalizeText(second).toLowerCase().match(/[a-z']+/g) ?? [])

  if (!firstWords.size || !secondWords.size) return 0

  return [...firstWords].filter((word) => secondWords.has(word)).length / firstWords.size
}

function aggregateFindings(results) {
  const byFinding = new Map()

  for (const result of results) {
    for (const finding of result.findings) {
      const current = byFinding.get(finding) ?? {
        finding,
        count: 0,
        examples: [],
      }
      current.count += 1
      if (current.examples.length < 6) {
        current.examples.push({
          caseId: result.caseId,
          studentText: result.studentText,
          verdict: result.feedback.verdict,
          taskFit: result.feedback.taskFit,
          summary: result.feedback.summary,
          tryThis: result.feedback.corrections?.[0]?.suggestion ?? '',
          nextStep: result.feedback.challenge,
        })
      }
      byFinding.set(finding, current)
    }
  }

  return [...byFinding.values()].sort((left, right) => right.count - left.count)
}

function aggregateByLevelAndQuality(results) {
  return levels.flatMap((level) => ['good', 'bad'].map((quality) => {
    const subset = results.filter((result) => result.level === level && result.quality === quality)
    const withFindings = subset.filter((result) => result.findings.length)

    return {
      level,
      quality,
      cases: subset.length,
      casesWithFindings: withFindings.length,
      excellent: subset.filter((result) => result.feedback.verdict === 'excellent').length,
      goodWork: subset.filter((result) => result.feedback.verdict === 'good-work').length,
      goodStart: subset.filter((result) => result.feedback.verdict === 'good-start').length,
      needsWork: subset.filter((result) => result.feedback.verdict === 'keep-building').length,
    }
  }))
}

function markdownEscape(value = '') {
  return normalizeText(value).replace(/\|/g, '\\|').replace(/\n+/g, ' ')
}

function buildReport(results, findingPatterns, breakdown) {
  const totalFindings = results.reduce((sum, result) => sum + result.findings.length, 0)
  const lines = [
    '# Typical Student Answer QC',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    `- Scenes: ${scenes.length}`,
    `- Levels: ${levels.join(', ')}`,
    `- Cases: ${results.length} (one typical good and one typical weak answer per scene and level)`,
    `- Feedback path: deterministic local \`generateFeedback\` with \`OPENAI_API_KEY\` cleared`,
    '',
    '## Verdict Breakdown',
    '',
    '| Level | Quality | Cases | Cases with findings | Excellent | Good work | Good start | Needs work |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...breakdown.map((row) => `| ${row.level} | ${row.quality} | ${row.cases} | ${row.casesWithFindings} | ${row.excellent} | ${row.goodWork} | ${row.goodStart} | ${row.needsWork} |`),
    '',
    '## Improvement Patterns',
    '',
    findingPatterns.length
      ? findingPatterns.map((pattern) => `- **${pattern.finding}**: ${pattern.count} case(s). Examples: ${pattern.examples.map((example) => `\`${example.caseId}\``).join(', ')}`).join('\n')
      : '- No improvement patterns were flagged by this sweep.',
    '',
    '## Representative Findings',
    '',
  ]

  for (const pattern of findingPatterns.slice(0, 10)) {
    lines.push(`### ${pattern.finding}`)
    lines.push('')
    for (const example of pattern.examples.slice(0, 3)) {
      lines.push(`- \`${example.caseId}\``)
      lines.push(`  - Student: ${markdownEscape(example.studentText)}`)
      lines.push(`  - Verdict/task: ${example.verdict} / ${example.taskFit}`)
      lines.push(`  - Coach note: ${markdownEscape(example.summary)}`)
      if (example.tryThis) lines.push(`  - Try this: ${markdownEscape(example.tryThis)}`)
      if (example.nextStep) lines.push(`  - Next step: ${markdownEscape(example.nextStep)}`)
    }
    lines.push('')
  }

  lines.push('## All Flagged Cases')
  lines.push('')
  lines.push('| Case | Findings | Student answer | Verdict | Task fit | First correction |')
  lines.push('| --- | --- | --- | --- | --- | --- |')

  for (const result of results.filter((item) => item.findings.length)) {
    lines.push(`| \`${result.caseId}\` | ${markdownEscape(result.findings.join('; '))} | ${markdownEscape(result.studentText)} | ${result.feedback.verdict} | ${result.feedback.taskFit} | ${markdownEscape(result.feedback.corrections?.[0]?.suggestion ?? '')} |`)
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true })
  const cases = scenes.flatMap((scene) => buildCasesForScene(scene))
  const results = []

  for (const qcCase of cases) {
    results.push(await runCase(qcCase))
  }

  const findingPatterns = aggregateFindings(results)
  const breakdown = aggregateByLevelAndQuality(results)
  const report = buildReport(results, findingPatterns, breakdown)

  await fs.writeFile(resultFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalScenes: scenes.length,
    totalCases: results.length,
    breakdown,
    findingPatterns,
    results,
  }, null, 2))
  await fs.writeFile(reportFile, report)

  console.log(JSON.stringify({
    totalScenes: scenes.length,
    totalCases: results.length,
    totalFlaggedCases: results.filter((result) => result.findings.length).length,
    topImprovementPatterns: findingPatterns.slice(0, 8),
    resultFile,
    reportFile,
  }, null, 2))
}

await main()
