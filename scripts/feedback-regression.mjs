import assert from 'node:assert/strict'
import {
  normalizeFeedback,
  turnsBoundedResultIntoPastContinuous,
} from '../server/index.js'

const english = 'English'

const scenes = {
  platform: {
    title: 'Platform 8',
    sceneScript: {
      coreActions: [
        {
          id: 'passengers-running',
          actor: 'passengers',
          visibleAs: 'Passengers are running and hurrying beside the train.',
        },
        {
          id: 'suitcase-open',
          actor: 'suitcase',
          visibleAs: 'An open suitcase is lying on the platform.',
        },
      ],
    },
  },
  market: {
    title: 'The busy market',
    sceneScript: {
      coreActions: [
        {
          id: 'vendor-weighing',
          actor: 'vendor',
          visibleAs: 'The vendor is weighing apples on a scale.',
        },
        {
          id: 'child-dropped-oranges',
          actor: 'child',
          visibleAs: 'A child dropped oranges in the market.',
        },
        {
          id: 'cyclist-swerved',
          actor: 'cyclist',
          visibleAs: 'A cyclist swerved to avoid the oranges.',
        },
        {
          id: 'dog-stole-bread',
          actor: 'dog',
          visibleAs: 'A dog stole a piece of bread.',
        },
      ],
    },
  },
  beach: {
    title: 'The windy beach',
    sceneScript: {
      coreActions: [
        {
          id: 'wind-blowing',
          actor: 'wind',
          visibleAs: 'The wind is blowing strongly across the beach.',
        },
        {
          id: 'woman-chasing-hat',
          actor: 'mum',
          visibleAs: 'Mum is trying to catch her hat.',
        },
        {
          id: 'lifeguard-watching',
          actor: 'lifeguard',
          visibleAs: 'A lifeguard is watching the water.',
        },
      ],
    },
  },
  campfire: {
    title: 'The campfire story',
    sceneScript: {
      coreActions: [
        {
          id: 'john-telling-story',
          actor: 'John',
          visibleAs: 'John is telling a story by the campfire.',
        },
        {
          id: 'owl-nearby',
          actor: 'owl',
          visibleAs: 'An owl is perched nearby.',
        },
      ],
    },
  },
  museum: {
    title: 'The museum alarm',
    sceneScript: {
      coreActions: [
        {
          id: 'boy-holding-ears',
          actor: 'boy',
          visibleAs: 'A boy is holding his ears near the statue.',
        },
        {
          id: 'alarm-glowing',
          actor: 'alarm',
          visibleAs: 'A red alarm light is glowing on the wall.',
        },
      ],
    },
  },
}

const advanced = { id: 'advanced' }
const intermediate = { id: 'intermediate' }

function baseFeedback(overrides = {}) {
  return {
    verdict: 'good-start',
    englishStatus: 'mostly correct',
    sceneFit: 'on scene',
    taskFit: 'partly on target',
    summary: 'The answer is understandable, but it is missing past perfect continuous.',
    strengths: ['Clear story'],
    corrections: [],
    rewrite: '',
    challenge: '',
    detected: {
      mentionedActions: [],
      verbForms: [],
      connectors: [],
      timeRelationships: [],
    },
    ...overrides,
  }
}

function assertNoText(feedback, pattern, message) {
  const combined = JSON.stringify(feedback).toLowerCase()
  assert.equal(pattern.test(combined), false, message)
}

{
  const answer =
    'Dad had been up all morning making pancakes when he suddenly got distracted by the cat and burned the pancakes so that the alarm went off.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'good-start',
      englishStatus: 'mostly correct',
      sceneFit: 'partly on scene',
      taskFit: 'partly on target',
      summary:
        "The sentence shows a clear time relationship with 'when' but does not describe the visible actions like cooking pancakes or smoke rising. To better fit the task, focus on the visible actions and use past continuous for ongoing background actions with simple past for interruptions.",
      strengths: [
        'Good use of past perfect continuous to show earlier ongoing action',
        "Clear use of 'when' to connect actions",
        'Correct simple past for completed events',
      ],
      corrections: [
        {
          original: 'Dad had been up all morning making pancakes',
          suggestion: 'Dad had been making pancakes all morning',
          reason: 'This keeps the same meaning and makes the phrase more natural.',
          grammarFocus: 'past perfect continuous',
        },
      ],
      rewrite:
        'Dad had been making pancakes all morning when he suddenly got distracted by the cat and burned the pancakes, so the alarm went off.',
      challenge: 'Add one sentence using while to describe what the children were doing during the cooking.',
      detected: {
        verbForms: ['past perfect continuous', 'simple past'],
        connectors: ['when', 'so'],
      },
    }),
    {
      title: 'Smoke in the kitchen',
      sceneScript: {
        coreActions: [
          {
            id: 'father-cooking',
            actor: 'father',
            visibleAs: 'A father is cooking or making pancakes at the stove.',
          },
          {
            id: 'smoke-rising',
            actor: 'smoke',
            visibleAs: 'Smoke is rising from a pan.',
          },
        ],
      },
    },
    intermediate,
    english,
    answer,
  )

  assert.equal(feedback.sceneFit, 'on scene')
  assertNoText(feedback, /does not describe[^.?!]*cooking pancakes|visible actions like cooking pancakes/, 'Making pancakes should be treated as the same scene action as cooking pancakes.')
}

{
  const answer = 'The lion chased its pray in the forest while the moose eat his breakfast.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'good-start',
      englishStatus: 'mostly correct',
      sceneFit: 'partly on scene',
      taskFit: 'on target',
      summary:
        'The sentence uses past continuous and simple past with while to show simultaneous actions, which fits the task. However, the verb forms need consistent past tense, and the scene described does not match the picture of a woman sleeping in an apartment bedroom.',
      strengths: [
        "Uses 'while' to connect two actions",
        'Attempts past continuous and simple past verb forms',
      ],
      corrections: [
        {
          original: 'while the moose eat his breakfast',
          suggestion: 'while the moose was eating its breakfast',
          reason: "Use past continuous for the ongoing action and correct 'pray' to 'prey'.",
          grammarFocus: 'past continuous',
        },
      ],
      rewrite: 'The lion was chasing its prey in the forest while the moose was eating its breakfast.',
      challenge: 'Use the same pattern with the bedroom scene.',
      detected: {
        verbForms: ['past continuous', 'simple past'],
        connectors: ['while'],
        timeRelationships: ['simultaneous actions'],
      },
    }),
    {
      title: 'The midnight knock',
      sceneScript: {
        coreActions: [
          {
            id: 'woman-sleeping',
            actor: 'woman',
            visibleAs: 'The woman is asleep under the blanket.',
          },
          {
            id: 'stranger-knocked',
            actor: 'stranger',
            visibleAs: 'A shadowy person is knocking on the closed door.',
          },
          {
            id: 'cat-jumped',
            actor: 'cat',
            visibleAs: 'The startled cat is jumping near the bed.',
          },
        ],
      },
    },
    intermediate,
    english,
    answer,
  )

  assert.equal(feedback.sceneFit, 'not scene-based')
  assert.equal(feedback.verdict, 'keep-building')
}

{
  const answer =
    'In the museum we were, but suddenly a strong sound. The boy was holding his ears and the alarm glows red.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'excellent',
      englishStatus: 'correct',
      taskFit: 'on target',
      summary:
        "The answer uses past continuous and simple past forms but lacks clear connectors like 'when' or 'while' to show the relationship.",
      strengths: [
        "Uses past continuous for background action ('was holding')",
        "Includes a completed event ('alarm glows red')",
      ],
      corrections: [
        {
          original: 'In the museum we were, but suddenly a strong sound.',
          suggestion: 'We were in the museum when suddenly a loud alarm sounded.',
          reason: "Using 'when' clearly connects the background action with the interrupting event.",
          grammarFocus: 'connector',
        },
      ],
      rewrite:
        'We were in the museum when suddenly a loud alarm sounded. The boy was holding his ears while the alarm glowed red.',
      detected: {
        verbForms: ['past continuous', 'simple past'],
        connectors: ['but'],
        timeRelationships: ['background + event'],
      },
    }),
    scenes.museum,
    intermediate,
    english,
    answer,
  )

  assert.notEqual(feedback.verdict, 'excellent')
  assert.notEqual(feedback.taskFit, 'on target')
}

{
  const answer =
    'Lisa had been out drinking all night, so when she fell asleep she slept so deeply that she did not hear the knocking on the door.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'good-start',
      taskFit: 'partly on target',
      summary: 'The sentence uses past perfect continuous and simple past.',
      corrections: [],
      rewrite: answer,
      challenge: 'Now add one sentence with had or had been to show what happened earlier.',
      detected: {
        verbForms: ['past perfect continuous', 'simple past'],
        connectors: ['so', 'when'],
      },
    }),
    {
      title: 'The midnight knock',
      sceneScript: {
        coreActions: [
          {
            id: 'woman-sleeping',
            actor: 'woman',
            visibleAs: 'The woman is asleep under the blanket.',
          },
          {
            id: 'stranger-knocked',
            actor: 'stranger',
            visibleAs: 'A shadowy person is knocking on the closed door.',
          },
        ],
      },
    },
    intermediate,
    english,
    answer,
  )

  assert.notEqual(feedback.challenge, 'Now add one sentence with had or had been to show what happened earlier.')
  assertNoText(feedback, /had or had been|what happened earlier/, 'Next step should not ask for an earlier-past form already present in the answer.')
}

{
  const answer = 'Dad had been making pancakes for an hour when the smoke alarm started ringing.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'excellent',
      taskFit: 'on target',
      summary: 'The answer uses past perfect continuous to show an earlier ongoing action.',
      corrections: [
        {
          original: 'your story',
          suggestion: 'Keep this sentence. Add what had already happened before.',
          reason: 'The sentence works. The next level is to add an earlier layer of the story with had.',
          grammarFocus: 'past perfect',
        },
      ],
      rewrite: `${answer} Before that, something had already happened.`,
      detected: {
        verbForms: ['past perfect continuous', 'simple past'],
      },
    }),
    {
      title: 'Smoke in the kitchen',
      sceneScript: {
        coreActions: [
          {
            id: 'dad-cooking',
            actor: 'Dad',
            visibleAs: 'Dad is making pancakes.',
          },
          {
            id: 'alarm-ringing',
            actor: 'alarm',
            visibleAs: 'The smoke alarm is ringing.',
          },
        ],
      },
    },
    advanced,
    english,
    answer,
  )

  assert.equal(feedback.verdict, 'excellent')
  assertNoText(feedback, /add what had already happened|something had already happened/, 'Past perfect continuous already satisfies the earlier-past layer.')
}

{
  const answer = 'The nurse was pushing the wheelchair when the papers fell.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'excellent',
      taskFit: 'on target',
      summary: 'The sentence uses past continuous and simple past, but the narrative time relationship could be clearer.',
      corrections: [
        {
          original: 'your sentence',
          suggestion: 'Keep the sentence and clarify the timing.',
          reason: 'The connection could be clearer.',
          grammarFocus: 'narrative coherence',
        },
      ],
      rewrite: answer,
    }),
    {
      title: 'The hospital hallway',
      sceneScript: {
        coreActions: [
          {
            id: 'nurse-pushing',
            actor: 'nurse',
            visibleAs: 'A nurse is pushing a wheelchair.',
          },
          {
            id: 'papers-fell',
            actor: 'papers',
            visibleAs: 'Papers are falling in the hallway.',
          },
        ],
      },
    },
    intermediate,
    english,
    answer,
  )

  assert.equal(feedback.verdict, 'good-work')
}

{
  const answer = 'The people were waiting for the bus when a child dropped a mitten.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'excellent',
      taskFit: 'on target',
      summary: 'The sentence clearly uses past continuous and simple past. The mitten dropping is not clearly visible in the scene.',
      corrections: [],
      rewrite: answer,
    }),
    {
      title: 'Snow at the bus stop',
      sceneScript: {
        coreActions: [
          {
            id: 'people-waiting',
            actor: 'people',
            visibleAs: 'People are waiting at a snowy bus stop.',
          },
        ],
      },
    },
    intermediate,
    english,
    answer,
  )

  assert.equal(feedback.summary, 'The sentence clearly uses past continuous and simple past.')
}

{
  assert.equal(
    turnsBoundedResultIntoPastContinuous('The people were hiking while the backpack was opening.'),
    true,
    'Backpack opening should be treated as a bounded/result event in this app context.',
  )
}

{
  const answer =
    'The market was already crowded because the vendors had opened their stalls early. While one vendor was weighing apples, a child dropped some oranges, so a cyclist swerved to avoid them. Two friends were bargaining at another stall while a dog stole a piece of bread.'
  const feedback = normalizeFeedback(
    baseFeedback({
      verdict: 'good-start',
      summary:
        "Your narration uses past continuous and simple past well. You also use 'had opened' correctly, but the task asks specifically to show what happened before somebody noticed.",
      corrections: [
        {
          original: 'had opened their stalls early',
          suggestion: 'The vendors had opened their stalls before the market became crowded.',
          reason: 'This uses before, which fits the task focus.',
          grammarFocus: 'past perfect',
        },
      ],
      rewrite:
        'The vendors had opened their stalls before the market became crowded. While one vendor was weighing apples, a child dropped some oranges, so a cyclist swerved to avoid them. Two friends were bargaining at another stall while a dog stole a piece of bread.',
    }),
    scenes.market,
    advanced,
    english,
    answer,
  )

  assert.equal(feedback.taskFit, 'on target')
  assert.equal(feedback.verdict, 'excellent')
  assertNoText(feedback, /before somebody noticed|task asks specifically|fits the task focus/, 'A strong advanced answer should not be forced into the scene model sentence.')
  assertNoText(feedback, /add what had already happened|something had already happened/, 'A strong answer that already uses had should not be told to add had again.')
}

{
  const answer =
    'It was a busy day at the train station. People were running everywhere. Somebody had forgotten his suitcase wide open on the platform, but it was ignored by the passing passengers who were too busy trying to catch the train.'
  const feedback = normalizeFeedback(
    baseFeedback({
      corrections: [
        {
          original: 'Somebody had forgotten his suitcase',
          suggestion: 'Somebody had been leaving his suitcase wide open on the platform before the passengers started running.',
          reason: 'Past perfect continuous would better fulfill the advanced task.',
          grammarFocus: 'past perfect continuous',
        },
      ],
      rewrite:
        'It was a busy day at the train station. People were running everywhere because somebody had forgotten his suitcase wide open on the platform, but it was ignored by the passing passengers who were too busy trying to catch the train.',
    }),
    scenes.platform,
    advanced,
    english,
    answer,
  )

  assert.equal(feedback.taskFit, 'on target')
  assert.notEqual(feedback.verdict, 'good-start')
  assertNoText(feedback, /had been leaving|had been forgetting|missing past perfect continuous/, 'Advanced past perfect should not be replaced by forced past perfect continuous.')
  assert.equal(
    feedback.rewrite.includes('People were running everywhere because somebody had forgotten'),
    false,
    'Rewrite must not invent a suitcase-caused-running relationship.',
  )
}

{
  const answer =
    "A gust of wind blew the hat off of mum's head, so she tried to catch it. The lifeguard was watching the water while the wind was blowing the hat away."
  const feedback = normalizeFeedback(
    baseFeedback({
      taskFit: 'on target',
      corrections: [
        {
          original: "A gust of wind blew the hat off of mum's head",
          suggestion: "While a gust of wind was blowing the hat off Mum's head, she tried to catch it.",
          reason: 'Using while with past continuous shows an action in progress.',
          grammarFocus: 'past continuous',
        },
      ],
      rewrite: answer,
    }),
    scenes.beach,
    intermediate,
    english,
    answer,
  )

  assert.equal(turnsBoundedResultIntoPastContinuous("While a gust of wind was blowing the hat off Mum's head, she tried to catch it."), true)
  assertNoText(feedback, /was blowing the hat off/, 'Bounded result events should not be corrected into past continuous.')
  assert.notEqual(feedback.rewrite, answer, 'Rewrite must not be identical to the student answer.')
}

{
  const answer = 'Carl was telling a story when an owl landed nearby.'
  const feedback = normalizeFeedback(
    baseFeedback({
      sceneFit: 'partly on scene',
      summary: 'The owl is described as landing, which is not visible in the scene.',
      corrections: [
        {
          original: 'an owl landed nearby',
          suggestion: 'an owl was watching nearby',
          reason: 'The landing itself is not visible.',
          grammarFocus: 'narrative coherence',
        },
      ],
      rewrite: 'Carl was telling a story while an owl was watching nearby.',
    }),
    scenes.campfire,
    intermediate,
    english,
    answer,
  )

  assert.equal(feedback.sceneFit, 'on scene')
  assertNoText(feedback, /not visible|landing itself/, 'Plausible actions involving present scene elements should not be nitpicked.')
}

console.log('Feedback regression checks passed.')
