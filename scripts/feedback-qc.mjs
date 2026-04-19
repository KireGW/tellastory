import { scenes } from '../src/data/scenes.js'

const endpoint = process.env.FEEDBACK_QC_URL ?? 'http://localhost:8787/api/feedback'

const cases = [
  ['midnight-knock', 'intermediate', 'excellent', 'The woman was sleeping while rain was hitting the window, and the cat jumped when somebody knocked on the door.'],
  ['midnight-knock', 'intermediate', 'not-excellent', 'Woman sleep. Door noise. Cat jump now.'],
  ['market-spill', 'advanced', 'excellent', 'The market was already crowded because the vendors had opened their stalls early. While one vendor was weighing apples, a child dropped some oranges, so a cyclist swerved to avoid them.'],
  ['market-spill', 'intermediate', 'not-excellent', 'In market we were, but suddenly orange. The dog is bread red.'],
  ['train-platform', 'advanced', 'excellent', 'People were rushing toward the train because the conductor had already blown the whistle. While a man was running along the platform, pigeons scattered around an open suitcase.'],
  ['train-platform', 'intermediate', 'not-excellent', 'Train station busy. People running. Suitcase open and birds around.'],
  ['kitchen-smoke', 'advanced', 'excellent', 'Dad had been making pancakes for an hour when the smoke alarm started ringing. The cat was standing near the spilled milk while the children looked at the burned pancakes.'],
  ['kitchen-smoke', 'intermediate', 'not-excellent', 'The kitchen smoke. Dad make pancakes and alarm red.'],
  ['museum-alarm', 'intermediate', 'excellent', 'The boy was touching the statue when the alarm sounded, and the guard hurried over while the visitors were staring at the red light.'],
  ['museum-alarm', 'intermediate', 'not-excellent', 'In the museum we were, but suddenly a strong sound. The boy was holding his ears and the alarm glows red.'],
  ['beach-rescue', 'intermediate', 'excellent', "The wind was blowing across the beach when a gust blew Mum's hat away, so she chased it while the lifeguard was watching the water."],
  ['beach-rescue', 'intermediate', 'not-excellent', 'Beach windy. Hat go away and mum catch now.'],
  ['office-outage', 'advanced', 'excellent', 'The team had been working on the presentation when the lights went out. While one worker was holding a laptop, another employee searched for the flashlight.'],
  ['office-outage', 'intermediate', 'not-excellent', 'Office dark. Computer was and people confused.'],
  ['campfire-story', 'advanced', 'excellent', 'The campers had been sitting by the fire for hours when John began his story. A raccoon opened the cooler while the others were listening.'],
  ['campfire-story', 'intermediate', 'not-excellent', 'Campfire nice. John story and animal there.'],
  ['hospital-hall', 'intermediate', 'excellent', 'As the nurse was pushing the cart, the doors opened, and the doctor was reading a chart while the visitor dropped the flowers.'],
  ['hospital-hall', 'intermediate', 'not-excellent', 'Hospital hallway. Nurse push chair and doctor busy.'],
  ['school-lab', 'advanced', 'excellent', 'The students had been mixing chemicals when the liquid started foaming. While the teacher was pointing at the beaker, one student dropped a notebook.'],
  ['school-lab', 'intermediate', 'not-excellent', 'Science room. Liquid green and students look.'],
  ['airport-delay', 'advanced', 'excellent', 'The passengers had been waiting at the gate when the screen changed. While one traveler was checking a phone, another passenger ran toward the counter.'],
  ['airport-delay', 'intermediate', 'not-excellent', 'Airport people wait. Gate change. Bag there.'],
  ['farm-storm', 'intermediate', 'excellent', 'The farmer was closing the barn door when the storm broke, and the animals ran inside while the wind was blowing across the field.'],
  ['farm-storm', 'intermediate', 'not-excellent', 'Farm storm. Animals scared and rain.'],
  ['restaurant-proposal', 'advanced', 'excellent', 'The guests had been eating dinner when the man opened the ring box. While the waiter was carrying a cake, everyone turned toward the table.'],
  ['restaurant-proposal', 'intermediate', 'not-excellent', 'Dinner surprise. Man ring and people happy.'],
  ['library-whisper', 'intermediate', 'excellent', 'The students were reading quietly when a shelf collapsed, so papers flew across the library while someone was whispering into a phone.'],
  ['library-whisper', 'intermediate', 'not-excellent', 'Library quiet. Book fall and kids whisper now.'],
  ['city-parade', 'intermediate', 'excellent', 'The band was marching down the street when a balloon floated away, and the crowd cheered while a child tried to reach it.'],
  ['city-parade', 'intermediate', 'not-excellent', 'Parade loud. People watch and balloon up.'],
  ['garage-repair', 'advanced', 'excellent', 'The mechanic had been fixing the engine when oil started leaking. While one person was holding a flashlight, another reached for a tool.'],
  ['garage-repair', 'intermediate', 'not-excellent', 'Garage repair. Car broken and oil there.'],
  ['snowy-bus', 'intermediate', 'excellent', 'People were waiting in the snow when the bus splashed slush, and the teenager slipped while the woman was closing her umbrella.'],
  ['snowy-bus', 'intermediate', 'not-excellent', 'Bus stop cold. People wait and snow.'],
  ['garden-party', 'advanced', 'excellent', 'The guests had been eating in the garden when a gust of wind blew the tablecloth. While Lars was holding the cloth, glasses fell from the table.'],
  ['garden-party', 'intermediate', 'not-excellent', 'Garden party. Wind and table things.'],
  ['film-set', 'intermediate', 'excellent', 'The actor was speaking his line when the prop sword fell, and the camera was recording while the rain machines were spraying water.'],
  ['film-set', 'intermediate', 'not-excellent', 'Film set busy. Actor talk and lights.'],
  ['mountain-trail', 'advanced', 'excellent', 'The hikers had been walking along the trail when the backpack opened. While one hiker was pointing at the map, supplies rolled down the path.'],
  ['mountain-trail', 'intermediate', 'not-excellent', 'Mountain trail. People hike and bag open.'],
]

function challengeFor(id) {
  return { id, label: id[0].toUpperCase() + id.slice(1) }
}

function expectedPassed(expected, feedback) {
  if (expected === 'excellent') {
    return feedback.verdict === 'excellent' && feedback.taskFit === 'on target'
  }

  return feedback.verdict !== 'excellent'
}

async function runCase([sceneId, challengeId, expected, text]) {
  const scene = scenes.find((item) => item.id === sceneId)

  if (!scene) {
    return { sceneId, challengeId, expected, text, ok: false, error: 'Missing scene' }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answer: text,
      scene: {
        title: scene.title,
        setting: scene.setting,
        prompt: scene.prompt,
        focus: scene.focus,
        sample: scene.sample,
        sceneScript: scene.sceneScript,
      },
      challenge: challengeFor(challengeId),
      feedbackLanguage: 'English',
    }),
  })

  if (!response.ok) {
    return { scene: scene.title, sceneId, challengeId, expected, text, ok: false, error: `HTTP ${response.status}` }
  }

  const feedback = await response.json()

  return {
    scene: scene.title,
    sceneId,
    challengeId,
    expected,
    actualVerdict: feedback.verdict,
    actualTaskFit: feedback.taskFit,
    actualEnglish: feedback.englishStatus,
    ok: expectedPassed(expected, feedback),
    summary: feedback.summary,
    tryThis: feedback.corrections?.[0]?.suggestion,
    text,
  }
}

const results = []

for (const testCase of cases) {
  results.push(await runCase(testCase))
}

const failures = results.filter((result) => !result.ok)
const totals = {
  cases: results.length,
  pass: results.length - failures.length,
  fail: failures.length,
}

console.log(JSON.stringify({ endpoint, totals, failures, results }, null, 2))

if (failures.length) {
  process.exitCode = 1
}
