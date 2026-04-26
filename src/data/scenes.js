export const scenes = [
  {
    id: 'midnight-knock',
    title: 'The midnight knock',
    setting: 'Apartment bedroom',
    image: '/scenes/midnight-knock.png',
    prompt:
      'A woman sleeps while rain hits the window, a shadow knocks on the door, a phone glows beside an open book, and a cat jumps from a chair.',
    focus: ['past continuous + simple past', 'interrupted action', 'when'],
    sample:
      'The woman was sleeping when somebody knocked on the door, and the cat jumped off the chair.',
    palette: ['#235347', '#f6c85f', '#f96f5d', '#2f4858'],
    objects: ['bed', 'door', 'window', 'cat', 'phone', 'book'],
    actions: ['sleeping', 'knocking', 'raining', 'jumping'],
    sceneScript: {
      premise: 'A woman is asleep in a dark bedroom when a mysterious knock interrupts the quiet night.',
      visualStyle: 'A dark theatrical bedroom set, viewed from the audience, with several actions happening at once.',
      characters: [
        {
          id: 'woman',
          description: 'A woman asleep under a blanket on the left side of the stage.',
          action: 'was sleeping',
          grammarRole: 'background action in progress',
        },
        {
          id: 'stranger',
          description: 'A shadowy person outside the apartment door, raising one hand to knock.',
          action: 'knocked',
          grammarRole: 'interrupting completed event',
        },
        {
          id: 'cat',
          description: 'A startled cat jumping down near the bed.',
          action: 'jumped',
          grammarRole: 'reaction event after the knock',
        },
      ],
      coreActions: [
        {
          id: 'woman-sleeping',
          actor: 'woman',
          visibleAs: 'The woman is asleep under the blanket.',
          recommendedVerbForms: ['was sleeping'],
          narrativeRole: 'background ongoing action',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'stranger-knocked',
          actor: 'stranger',
          visibleAs: 'A shadowy person is knocking on the closed door.',
          recommendedVerbForms: ['knocked'],
          narrativeRole: 'interrupting completed event',
          grammarTargets: ['simple past'],
        },
        {
          id: 'cat-jumped',
          actor: 'cat',
          visibleAs: 'The startled cat is jumping near the bed.',
          recommendedVerbForms: ['jumped'],
          narrativeRole: 'reaction event',
          grammarTargets: ['simple past'],
        },
        {
          id: 'rain-falling',
          actor: 'rain',
          visibleAs: 'Rain is falling against the window.',
          recommendedVerbForms: ['was falling'],
          narrativeRole: 'background atmosphere',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'phone-glowing',
          actor: 'phone',
          visibleAs: 'A phone is glowing on the bedside table.',
          recommendedVerbForms: ['was glowing'],
          narrativeRole: 'simultaneous background detail',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'book-lying',
          actor: 'book',
          visibleAs: 'An open book is lying on the nighttable.',
          recommendedVerbForms: ['was lying', 'had been reading'],
          narrativeRole: 'clue about an earlier past action',
          grammarTargets: ['past continuous', 'past perfect continuous'],
        },
      ],
      environmentActions: [
        {
          id: 'rain',
          description: 'Rain was falling against the window.',
          action: 'was falling',
          grammarRole: 'background atmosphere',
        },
        {
          id: 'phone',
          description: 'A phone was glowing on the bedside table.',
          action: 'was glowing',
          grammarRole: 'simultaneous background detail',
        },
        {
          id: 'book',
          description: 'An open book was lying on the bedside table.',
          action: 'was lying',
          grammarRole: 'background detail that suggests what happened before',
        },
      ],
      relationships: [
        {
          id: 'sleep-interrupted-by-knock',
          type: 'interruption',
          backgroundAction: 'woman-sleeping',
          interruptingAction: 'stranger-knocked',
          usefulConnectors: ['when'],
          modelSentence: 'The woman was sleeping when somebody knocked on the door.',
        },
        {
          id: 'night-background',
          type: 'simultaneous-background',
          actions: ['rain-falling', 'phone-glowing'],
          usefulConnectors: ['while', 'as'],
          modelSentence: 'Rain was falling while the phone was glowing on the nighttable.',
        },
        {
          id: 'cat-reacts',
          type: 'reaction',
          cause: 'stranger-knocked',
          result: 'cat-jumped',
          usefulConnectors: ['when', 'because'],
          modelSentence: 'The cat jumped when it heard the knock.',
        },
        {
          id: 'reading-before-sleep',
          type: 'earlier-past',
          earlierAction: 'book-lying',
          laterAction: 'woman-sleeping',
          usefulConnectors: ['before', 'after'],
          modelSentence: 'She had been reading before she fell asleep.',
        },
      ],
      targetRelationships: [
        'The woman was sleeping when somebody knocked on the door.',
        'Rain was falling while the phone was glowing on the bedside table.',
        'An open book was lying on the nighttable, so she had probably been reading before she fell asleep.',
        'The cat jumped when it heard the knock.',
        'The woman had turned off the light before she fell asleep.',
      ],
    },
    challengeModes: {
      beginner: {
        label: 'Beginner',
        prompt: 'Write two or three simple past sentences about what happened.',
        targets: ['simple past'],
      },
      intermediate: {
        label: 'Intermediate',
        prompt: 'Use when or while to connect an action in progress with a sudden event.',
        targets: ['past continuous', 'simple past', 'when', 'while'],
      },
      advanced: {
        label: 'Advanced',
        prompt: 'Use had or had been to show something that happened before another past moment. Combine with other past forms to make the timeline clear.',
        targets: ['earlier past', 'past perfect when natural', 'past perfect continuous only for ongoing earlier actions', 'before', 'after'],
      },
    },
  },
  {
    id: 'market-spill',
    title: 'The busy market',
    setting: 'Street market',
    image: '/scenes/busy-market.png',
    prompt:
      'A vendor weighs apples, a child drops oranges, a cyclist swerves, two friends bargain, and a dog steals bread.',
    focus: ['background actions', 'sudden events', 'while'],
    sample:
      'While the vendor was weighing apples, a child dropped some oranges and a dog stole a loaf of bread.',
    palette: ['#006d77', '#ffddd2', '#e29578', '#83c5be'],
    objects: ['stall', 'scale', 'fruit', 'bike', 'dog'],
    actions: ['weighing', 'dropping', 'swerving', 'bargaining'],
    sceneScript: {
      premise: 'A busy street market becomes chaotic when dropped oranges interrupt several ongoing actions.',
      visualStyle: 'A lively theatrical street market set, viewed from the audience, with several actions happening at once.',
      characters: [
        {
          id: 'vendor',
          description: 'A fruit vendor standing behind a stall and weighing apples on a scale.',
          action: 'was weighing apples',
          grammarRole: 'background action in progress',
        },
        {
          id: 'child',
          description: 'A child who has just dropped oranges, sending them rolling across the ground.',
          action: 'dropped some oranges',
          grammarRole: 'sudden completed event',
        },
        {
          id: 'cyclist',
          description: 'A cyclist swerving to avoid the oranges rolling through the market.',
          action: 'swerved',
          grammarRole: 'reaction event caused by the dropped oranges',
        },
        {
          id: 'friends',
          description: 'Two friends bargaining with a seller at another stall.',
          action: 'were bargaining',
          grammarRole: 'simultaneous background action',
        },
        {
          id: 'dog',
          description: 'A dog running away with a loaf of bread.',
          action: 'stole a loaf of bread',
          grammarRole: 'separate completed event during the busy scene',
        },
      ],
      coreActions: [
        {
          id: 'vendor-weighing',
          actor: 'vendor',
          visibleAs: 'The vendor is weighing apples on a scale.',
          recommendedVerbForms: ['was weighing'],
          narrativeRole: 'background ongoing action',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'child-dropped-oranges',
          actor: 'child',
          visibleAs: 'The child has dropped oranges onto the ground.',
          recommendedVerbForms: ['dropped'],
          narrativeRole: 'sudden completed event',
          grammarTargets: ['simple past'],
        },
        {
          id: 'oranges-rolling',
          actor: 'oranges',
          visibleAs: 'Oranges are rolling across the market floor.',
          recommendedVerbForms: ['were rolling'],
          narrativeRole: 'ongoing result',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'cyclist-swerved',
          actor: 'cyclist',
          visibleAs: 'The cyclist is swerving to avoid the oranges.',
          recommendedVerbForms: ['swerved'],
          narrativeRole: 'reaction event',
          grammarTargets: ['simple past'],
        },
        {
          id: 'friends-bargaining',
          actor: 'friends',
          visibleAs: 'Two friends are bargaining with a seller.',
          recommendedVerbForms: ['were bargaining'],
          narrativeRole: 'simultaneous background action',
          grammarTargets: ['past continuous'],
        },
        {
          id: 'dog-stole-bread',
          actor: 'dog',
          visibleAs: 'A dog is running away with a loaf of bread.',
          recommendedVerbForms: ['stole', 'had taken'],
          narrativeRole: 'separate completed event or earlier past event',
          grammarTargets: ['simple past', 'past perfect'],
        },
      ],
      environmentActions: [
        {
          id: 'oranges',
          description: 'Several oranges were rolling across the ground.',
          action: 'were rolling',
          grammarRole: 'ongoing result of the child dropping them',
        },
        {
          id: 'shoppers',
          description: 'Shoppers were walking, talking, and carrying bags in the background.',
          action: 'were walking and talking',
          grammarRole: 'background atmosphere',
        },
        {
          id: 'crates',
          description: 'Fruit crates were stacked near the stalls, with one stack looking unstable.',
          action: 'were standing near the stall',
          grammarRole: 'visual detail for richer narration',
        },
      ],
      relationships: [
        {
          id: 'vendor-interrupted-by-child',
          type: 'interruption',
          backgroundAction: 'vendor-weighing',
          interruptingAction: 'child-dropped-oranges',
          usefulConnectors: ['while', 'when', 'as'],
          modelSentence: 'While the vendor was weighing apples, a child dropped some oranges.',
        },
        {
          id: 'oranges-cause-cyclist',
          type: 'cause-result',
          cause: 'oranges-rolling',
          result: 'cyclist-swerved',
          usefulConnectors: ['because', 'so', 'as a result'],
          modelSentence: 'The cyclist swerved because oranges were rolling across the street.',
        },
        {
          id: 'friends-and-dog',
          type: 'simultaneous-background',
          actions: ['friends-bargaining', 'dog-stole-bread'],
          usefulConnectors: ['while', 'as'],
          modelSentence: 'Two friends were bargaining while the dog was stealing bread.',
        },
        {
          id: 'dog-before-noticing',
          type: 'earlier-past',
          earlierAction: 'dog-stole-bread',
          laterAction: 'vendor-noticed',
          usefulConnectors: ['before', 'by the time'],
          modelSentence: 'The dog had taken the bread before anyone noticed.',
        },
      ],
      targetRelationships: [
        'While the vendor was weighing apples, a child dropped some oranges.',
        'The cyclist swerved because oranges were rolling across the street.',
        'Two friends were bargaining while the dog was stealing bread.',
        'The dog had taken the bread before anyone noticed.',
        'Shoppers were walking through the market when the commotion started.',
      ],
    },
    challengeModes: {
      beginner: {
        label: 'Beginner',
        prompt: 'Write three simple past sentences about the market scene.',
        targets: ['simple past'],
      },
      intermediate: {
        label: 'Intermediate',
        prompt: 'Use while, when, or because to connect the actions in the market.',
        targets: ['past continuous', 'simple past', 'while', 'when', 'because'],
      },
      advanced: {
        label: 'Advanced',
        prompt: 'Use had or had already to show what happened before somebody noticed.',
        targets: ['past perfect', 'by the time', 'before'],
      },
    },
  },
  {
    id: 'train-platform',
    title: 'Platform 8',
    setting: 'Train station',
    image: '/scenes/platform-8.png',
    prompt:
      'Passengers wait on a platform, a man runs for the train, a conductor checks tickets, an open suitcase lies on the platform, and pigeons scatter.',
    focus: ['past continuous + simple past', 'sequence', 'because'],
    sample:
      'The passengers were waiting when the train arrived, but one man had already lost his ticket.',
    palette: ['#264653', '#2a9d8f', '#e9c46a', '#e76f51'],
    objects: ['train', 'clock', 'luggage', 'tickets', 'pigeons'],
    actions: ['waiting', 'running', 'checking', 'open suitcase', 'scattering'],
    sceneScript: sceneScript({
      premise: 'A train platform becomes tense as routine actions continue around a late passenger, an open suitcase, and scattering pigeons.',
      coreActions: [
        action('passengers-waiting', 'passengers', 'Passengers are waiting on Platform 8.', ['were waiting'], 'background ongoing action', ['past continuous']),
        action('man-running', 'man', 'A man is running toward the train.', ['ran', 'was running'], 'urgent completed or ongoing action', ['simple past', 'past continuous']),
        action('conductor-checking', 'conductor', 'A conductor is checking tickets near the train door.', ['was checking'], 'simultaneous background action', ['past continuous']),
        action('suitcase-lying-open', 'luggage', 'An open suitcase is lying on the platform with belongings visible.', ['was lying open', 'had opened'], 'visible state and earlier past clue, not a directly visible falling event', ['past continuous', 'past perfect']),
        action('pigeons-scattered', 'pigeons', 'Pigeons are scattering across the platform.', ['scattered'], 'reaction event', ['simple past']),
      ],
      relationships: [
        relation('waiting-interrupted-by-running', 'interruption', { backgroundAction: 'passengers-waiting', interruptingAction: 'man-running', usefulConnectors: ['when'], modelSentence: 'Passengers were waiting when a man ran toward the train.' }),
        relation('checking-while-suitcase-open', 'simultaneous-background', { actions: ['conductor-checking', 'suitcase-lying-open'], usefulConnectors: ['while', 'as'], modelSentence: 'The conductor was checking tickets while an open suitcase was lying on the platform.' }),
        relation('pigeons-reacted-to-running', 'cause-result', { cause: 'man-running', result: 'pigeons-scattered', usefulConnectors: ['because', 'so'], modelSentence: 'The pigeons scattered because the man ran past them.' }),
        relation('suitcase-before-reaching', 'earlier-past', { earlierAction: 'suitcase-lying-open', laterAction: 'passenger-reached-down', usefulConnectors: ['before', 'already'], modelSentence: 'The suitcase had already opened before someone reached down.' }),
      ],
      targetRelationships: [
        'Passengers were waiting when a man ran toward the train.',
        'The conductor was checking tickets while an open suitcase was lying on the platform.',
        'The pigeons scattered because the running man startled them.',
        'The suitcase had already opened before someone reached down.',
      ],
    }),
  },
  {
    id: 'kitchen-smoke',
    title: 'Smoke in the kitchen',
    setting: 'Family kitchen',
    image: '/scenes/smoke-in-the-kitchen.png',
    prompt:
      'A father cooks or makes pancakes, smoke rises from a pan, children set the table, milk spills, and grandmother opens a window.',
    focus: ['past continuous', 'cause and result', 'as'],
    sample:
      'As the father was cooking pancakes, smoke began to rise and the grandmother opened the window.',
    palette: ['#386641', '#a7c957', '#bc4749', '#f2e8cf'],
    objects: ['stove', 'table', 'milk', 'window', 'pancakes'],
    actions: ['cooking', 'spilling', 'setting', 'opening'],
    sceneScript: sceneScript({
      premise: 'A family kitchen becomes chaotic while breakfast is being prepared.',
      coreActions: [
        action('father-cooking', 'father', 'A father is cooking or making pancakes at the stove.', ['was cooking', 'was making'], 'background ongoing action', ['past continuous']),
        action('smoke-rising', 'smoke', 'Smoke is rising from a pan.', ['began to rise', 'was rising'], 'sudden result or ongoing background', ['simple past', 'past continuous']),
        action('children-setting-table', 'children', 'Children are setting the table.', ['were setting'], 'simultaneous background action', ['past continuous']),
        action('milk-spilled', 'milk', 'Milk has spilled on the table or floor.', ['spilled', 'had spilled'], 'completed event or earlier past clue', ['simple past', 'past perfect']),
        action('grandmother-opened-window', 'grandmother', 'A grandmother is opening a window.', ['opened'], 'reaction event', ['simple past']),
      ],
      relationships: [
        relation('cooking-smoke', 'interruption', { backgroundAction: 'father-cooking', interruptingAction: 'smoke-rising', usefulConnectors: ['when', 'as'], modelSentence: 'The father was cooking pancakes when smoke began to rise.' }),
        relation('children-milk', 'simultaneous-background', { actions: ['children-setting-table', 'milk-spilled'], usefulConnectors: ['while'], modelSentence: 'The children were setting the table while the milk spilled.' }),
        relation('smoke-window', 'cause-result', { cause: 'smoke-rising', result: 'grandmother-opened-window', usefulConnectors: ['because', 'so'], modelSentence: 'The grandmother opened the window because smoke was filling the kitchen.' }),
        relation('milk-before-pet', 'earlier-past', { earlierAction: 'milk-spilled', laterAction: 'pet-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The milk had already spilled before the pet noticed it.' }),
      ],
      targetRelationships: [
        'The father was cooking or making pancakes when smoke began to rise.',
        'The children were setting the table while the milk spilled.',
        'The grandmother opened the window because smoke was filling the kitchen.',
        'The milk had already spilled before anyone noticed.',
      ],
    }),
  },
  {
    id: 'museum-alarm',
    title: 'The museum alarm',
    setting: 'Art museum',
    image: '/scenes/museum-alarm.png',
    prompt:
      'Visitors admire paintings, a guard speaks on a radio, a teenager touches a statue, an alarm flashes, and a painter sketches nearby.',
    focus: ['interruption', 'reported sequence', 'when'],
    sample:
      'The visitors were admiring the paintings when the alarm went off because a teenager had touched a statue.',
    palette: ['#3d405b', '#81b29a', '#f2cc8f', '#e07a5f'],
    objects: ['paintings', 'statue', 'alarm', 'radio', 'sketchbook'],
    actions: ['admiring', 'touching', 'flashing', 'sketching'],
    sceneScript: sceneScript({
      premise: 'A quiet museum visit is interrupted when someone touches a statue and the alarm starts.',
      coreActions: [
        action('visitors-admiring', 'visitors', 'Visitors are admiring paintings.', ['were admiring'], 'background ongoing action', ['past continuous']),
        action('guard-radio', 'guard', 'A guard is speaking into a radio.', ['was speaking'], 'simultaneous background action', ['past continuous']),
        action('teenager-touched-statue', 'teenager', 'A teenager is touching or has touched a statue.', ['touched', 'had touched'], 'cause event or earlier past event', ['simple past', 'past perfect']),
        action('alarm-flashed', 'alarm', 'An alarm light is flashing.', ['went off', 'started flashing'], 'sudden event', ['simple past']),
        action('painter-sketching', 'painter', 'A painter or student is sketching nearby.', ['was sketching'], 'background ongoing action', ['past continuous']),
      ],
      relationships: [
        relation('visitors-alarm', 'interruption', { backgroundAction: 'visitors-admiring', interruptingAction: 'alarm-flashed', usefulConnectors: ['when'], modelSentence: 'Visitors were admiring paintings when the alarm went off.' }),
        relation('teenager-caused-alarm', 'cause-result', { cause: 'teenager-touched-statue', result: 'alarm-flashed', usefulConnectors: ['because'], modelSentence: 'The alarm went off because the teenager had touched the statue.' }),
        relation('guard-while-people-turned', 'simultaneous-background', { actions: ['guard-radio', 'visitors-admiring'], usefulConnectors: ['while'], modelSentence: 'The guard was speaking on the radio while people turned toward the statue.' }),
        relation('touch-before-notice', 'earlier-past', { earlierAction: 'teenager-touched-statue', laterAction: 'guard-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The teenager had already touched the statue before the guard noticed.' }),
      ],
      targetRelationships: [
        'Visitors were admiring paintings when the alarm went off.',
        'The alarm went off because the teenager had touched the statue.',
        'The painter was sketching quietly before the gallery became chaotic.',
      ],
    }),
  },
  {
    id: 'beach-rescue',
    title: 'The windy beach',
    setting: 'Beach',
    image: '/scenes/windy-beach.png',
    prompt:
      'A lifeguard watches the water, children build a sandcastle, a kite snaps loose, a woman chases a hat, and clouds gather.',
    focus: ['simultaneous actions', 'sudden change', 'while'],
    sample:
      'While the children were building a sandcastle, the wind blew a kite away and clouds gathered over the beach.',
    palette: ['#0081a7', '#00afb9', '#fed9b7', '#f07167'],
    objects: ['tower', 'kite', 'sandcastle', 'hat', 'clouds'],
    actions: ['watching', 'building', 'chasing', 'gathering'],
    sceneScript: sceneScript({
      premise: 'A windy beach afternoon interrupts people who had been relaxing and playing.',
      coreActions: [
        action('lifeguard-watching', 'lifeguard', 'A lifeguard is watching the water.', ['was watching'], 'background ongoing action', ['past continuous']),
        action('children-building', 'children', 'Children are building a sandcastle.', ['were building'], 'background ongoing action', ['past continuous']),
        action('kite-snapped-loose', 'kite', 'A kite has snapped loose or is blowing away.', ['snapped loose', 'blew away'], 'sudden event', ['simple past']),
        action('woman-chased-hat', 'woman', 'A woman is chasing a hat across the sand.', ['chased', 'was chasing'], 'reaction event or ongoing result', ['simple past', 'past continuous']),
        action('clouds-gathering', 'clouds', 'Clouds are gathering over the beach.', ['were gathering'], 'background atmosphere', ['past continuous']),
      ],
      relationships: [
        relation('sandcastle-kite', 'interruption', { backgroundAction: 'children-building', interruptingAction: 'kite-snapped-loose', usefulConnectors: ['when'], modelSentence: 'The children were building a sandcastle when the kite snapped loose.' }),
        relation('lifeguard-clouds', 'simultaneous-background', { actions: ['lifeguard-watching', 'clouds-gathering'], usefulConnectors: ['while'], modelSentence: 'The lifeguard was watching the water while clouds were gathering.' }),
        relation('wind-hat', 'cause-result', { cause: 'wind-blew-hat', result: 'woman-chased-hat', usefulConnectors: ['because'], modelSentence: 'The woman chased her hat because the wind had blown it away.' }),
        relation('kite-before-child-noticed', 'earlier-past', { earlierAction: 'kite-snapped-loose', laterAction: 'child-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The kite had already snapped loose before the child noticed it.' }),
      ],
      targetRelationships: [
        'The children were building a sandcastle when the kite snapped loose.',
        'The lifeguard was watching the water while clouds were gathering.',
        'The woman chased her hat because the wind had blown it away.',
      ],
    }),
  },
  {
    id: 'office-outage',
    title: 'The office outage',
    setting: 'Open office',
    image: '/scenes/office-outage.png',
    prompt:
      'Coworkers type at desks, a manager gives a presentation, lights go out, coffee spills, and a laptop battery dies.',
    focus: ['interrupted actions', 'past perfect', 'before'],
    sample:
      'The manager was giving a presentation when the lights went out, and the laptop had already lost power.',
    palette: ['#355070', '#6d597a', '#eaac8b', '#b56576'],
    objects: ['desks', 'screen', 'coffee', 'laptop', 'lights'],
    actions: ['typing', 'presenting', 'spilling', 'shutting down'],
    sceneScript: sceneScript({
      premise: 'A normal office meeting is interrupted by a sudden power outage.',
      coreActions: [
        action('coworkers-typing', 'coworkers', 'Coworkers are typing at desks.', ['were typing'], 'background ongoing action', ['past continuous']),
        action('manager-presenting', 'manager', 'A manager is giving a presentation.', ['was giving'], 'background ongoing action', ['past continuous']),
        action('lights-went-out', 'lights', 'The lights have gone out.', ['went out'], 'sudden event', ['simple past']),
        action('coffee-spilled', 'coffee', 'Coffee has spilled on or near a desk.', ['spilled'], 'reaction event', ['simple past']),
        action('laptop-died', 'laptop', 'A laptop screen is dark because the battery died.', ['died', 'had lost power'], 'completed event or earlier past clue', ['simple past', 'past perfect']),
      ],
      relationships: [
        relation('presentation-outage', 'interruption', { backgroundAction: 'manager-presenting', interruptingAction: 'lights-went-out', usefulConnectors: ['when'], modelSentence: 'The manager was giving a presentation when the lights went out.' }),
        relation('typing-dark', 'interruption', { backgroundAction: 'coworkers-typing', interruptingAction: 'lights-went-out', usefulConnectors: ['while', 'when'], modelSentence: 'Coworkers were typing when the room suddenly became dark.' }),
        relation('outage-coffee', 'cause-result', { cause: 'lights-went-out', result: 'coffee-spilled', usefulConnectors: ['because', 'so'], modelSentence: 'Someone spilled coffee because the lights went out.' }),
        relation('laptop-before-continue', 'earlier-past', { earlierAction: 'laptop-died', laterAction: 'manager-continued', usefulConnectors: ['before', 'already'], modelSentence: 'The laptop had already lost power before the manager continued.' }),
      ],
      targetRelationships: [
        'The manager was giving a presentation when the lights went out.',
        'Coworkers were typing while the room became dark.',
        'The laptop had already lost power before the manager continued.',
      ],
    }),
  },
  {
    id: 'campfire-story',
    title: 'The campfire story',
    setting: 'Forest campsite',
    image: '/scenes/campfire-story.png',
    prompt:
      'Campers sit around a fire, one tells a story, an owl watches from a branch, a raccoon opens a cooler, and sparks fly upward.',
    focus: ['past continuous + simple past', 'atmosphere', 'when'],
    sample:
      'The campers were listening to a story when a raccoon opened the cooler.',
    palette: ['#283618', '#dda15e', '#bc6c25', '#606c38'],
    objects: ['fire', 'tent', 'cooler', 'owl', 'logs'],
    actions: ['listening', 'telling', 'watching', 'opening'],
    sceneScript: sceneScript({
      premise: 'A peaceful campfire story is interrupted by animals and movement around the campsite.',
      coreActions: [
        action('campers-listening', 'campers', 'Campers are listening around the fire.', ['were listening'], 'background ongoing action', ['past continuous']),
        action('storyteller-telling', 'storyteller', 'One camper is telling a story.', ['was telling'], 'background ongoing action', ['past continuous']),
        action('owl-watching', 'owl', 'An owl is perched on a branch nearby.', ['was watching', 'was sitting'], 'background atmosphere, not a required event', ['past continuous']),
        action('raccoon-opened-cooler', 'raccoon', 'A raccoon is opening a cooler.', ['opened', 'had opened'], 'sneaky event or earlier past clue', ['simple past', 'past perfect']),
        action('sparks-flying', 'sparks', 'Sparks are flying upward from the fire.', ['were flying'], 'background atmosphere', ['past continuous']),
      ],
      relationships: [
        relation('listening-raccoon', 'interruption', { backgroundAction: 'campers-listening', interruptingAction: 'raccoon-opened-cooler', usefulConnectors: ['when'], modelSentence: 'The campers were listening to a story when a raccoon opened the cooler.' }),
        relation('story-sparks', 'simultaneous-background', { actions: ['storyteller-telling', 'sparks-flying'], usefulConnectors: ['while'], modelSentence: 'The storyteller was speaking while sparks were flying from the fire.' }),
        relation('owl-background', 'simultaneous-background', { actions: ['owl-watching', 'campers-listening'], usefulConnectors: ['while'], modelSentence: 'An owl was watching from a branch while the campers listened to the story.' }),
        relation('unwatched-cooler', 'cause-result', { cause: 'nobody-watching', result: 'raccoon-opened-cooler', usefulConnectors: ['because'], modelSentence: 'The raccoon opened the cooler because nobody was watching it.' }),
        relation('cooler-before-notice', 'earlier-past', { earlierAction: 'raccoon-opened-cooler', laterAction: 'camper-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The raccoon had already opened the cooler before one camper noticed.' }),
      ],
      targetRelationships: [
        'The campers were listening to a story when a raccoon opened the cooler.',
        'The storyteller was speaking while sparks were flying.',
        'An owl was watching from a branch while the campers listened to the story.',
        'The raccoon had already opened the cooler before one camper noticed.',
      ],
    }),
  },
  {
    id: 'hospital-hall',
    title: 'The hospital hallway',
    setting: 'Hospital corridor',
    image: '/scenes/hospital-hallway.png',
    prompt:
      'A nurse pushes a cart, a doctor reads a chart, a visitor drops flowers, doors open, and a patient waves.',
    focus: ['simultaneous actions', 'sequence', 'as'],
    sample:
      'As the nurse was pushing the cart, the doors opened and a visitor dropped the flowers.',
    palette: ['#006466', '#4d908e', '#f9c74f', '#f94144'],
    objects: ['cart', 'chart', 'flowers', 'doors', 'wheelchair'],
    actions: ['pushing', 'reading', 'dropping', 'waving'],
    sceneScript: sceneScript({
      premise: 'A hospital hallway becomes busy as doors open and a visitor drops flowers.',
      coreActions: [
        action('nurse-pushing-cart', 'nurse', 'A nurse is pushing a medical cart.', ['was pushing'], 'background ongoing action', ['past continuous']),
        action('doctor-reading-chart', 'doctor', 'A doctor is reading a chart.', ['was reading'], 'simultaneous background action', ['past continuous']),
        action('visitor-dropped-flowers', 'visitor', 'A visitor has dropped flowers.', ['dropped'], 'sudden completed event', ['simple past']),
        action('doors-opened', 'doors', 'Hospital doors are opening.', ['opened'], 'sudden event', ['simple past']),
        action('patient-waved', 'patient', 'A patient is waving.', ['waved'], 'reaction or greeting event', ['simple past']),
      ],
      relationships: [
        relation('nurse-doors', 'interruption', { backgroundAction: 'nurse-pushing-cart', interruptingAction: 'doors-opened', usefulConnectors: ['when', 'as'], modelSentence: 'As the nurse was pushing the cart, the doors opened.' }),
        relation('doctor-flowers', 'simultaneous-background', { actions: ['doctor-reading-chart', 'visitor-dropped-flowers'], usefulConnectors: ['while'], modelSentence: 'The doctor was reading a chart while the visitor dropped the flowers.' }),
        relation('noise-patient', 'reaction', { cause: 'visitor-dropped-flowers', result: 'patient-waved', usefulConnectors: ['when', 'because'], modelSentence: 'The patient waved when people turned toward the dropped flowers.' }),
        relation('visitor-before-drop', 'earlier-past', { earlierAction: 'visitor-entered', laterAction: 'visitor-dropped-flowers', usefulConnectors: ['before', 'after'], modelSentence: 'The visitor had entered the hallway before the flowers fell.' }),
      ],
      targetRelationships: [
        'As the nurse was pushing the cart, the doors opened.',
        'The doctor was reading a chart while the visitor dropped the flowers.',
        'The visitor had entered the hallway before the flowers fell.',
      ],
    }),
  },
  {
    id: 'school-lab',
    title: 'The science lab',
    setting: 'School laboratory',
    image: '/scenes/science-lab.png',
    prompt:
      'Students mix chemicals, a teacher writes notes, foam overflows, a window is open, and someone records a video.',
    focus: ['cause and result', 'past continuous', 'because'],
    sample:
      'The students were mixing chemicals when the foam overflowed because they had added too much powder.',
    palette: ['#118ab2', '#06d6a0', '#ffd166', '#ef476f'],
    objects: ['beakers', 'board', 'foam', 'window', 'phone'],
    actions: ['mixing', 'writing', 'overflowing', 'recording'],
    sceneScript: sceneScript({
      premise: 'A school science experiment becomes messy when foam overflows during class.',
      coreActions: [
        action('students-mixing', 'students', 'Students are mixing chemicals.', ['were mixing'], 'background ongoing action', ['past continuous']),
        action('teacher-writing', 'teacher', 'A teacher is writing notes.', ['was writing'], 'simultaneous background action', ['past continuous']),
        action('foam-overflowed', 'foam', 'Foam is overflowing from a beaker.', ['overflowed'], 'sudden result event', ['simple past']),
        action('window-open', 'window', 'A window is open.', ['had been opened'], 'earlier past clue or background detail', ['past perfect']),
        action('student-recording', 'student', 'Someone is recording a video.', ['was recording'], 'simultaneous background action', ['past continuous']),
      ],
      relationships: [
        relation('mixing-foam', 'interruption', { backgroundAction: 'students-mixing', interruptingAction: 'foam-overflowed', usefulConnectors: ['when'], modelSentence: 'The students were mixing chemicals when the foam overflowed.' }),
        relation('teacher-recording', 'simultaneous-background', { actions: ['teacher-writing', 'student-recording'], usefulConnectors: ['while'], modelSentence: 'The teacher was writing notes while someone recorded the experiment.' }),
        relation('powder-caused-foam', 'cause-result', { cause: 'too-much-powder', result: 'foam-overflowed', usefulConnectors: ['because'], modelSentence: 'The foam overflowed because they had added too much powder.' }),
        relation('window-before-reaction', 'earlier-past', { earlierAction: 'window-open', laterAction: 'foam-overflowed', usefulConnectors: ['before', 'already'], modelSentence: 'The window had already been opened before the reaction became messy.' }),
      ],
      targetRelationships: [
        'The students were mixing chemicals when the foam overflowed.',
        'The foam overflowed because they had added too much powder.',
        'The teacher was writing notes while someone recorded the experiment.',
      ],
    }),
  },
  {
    id: 'airport-delay',
    title: 'Gate change',
    setting: 'Airport gate',
    image: '/scenes/gate-change.png',
    prompt:
      'Travelers stand in line, a family checks passports, an announcement appears, luggage rolls away, and a pilot hurries past.',
    focus: ['past perfect', 'sequence markers', 'after'],
    sample:
      'After the gate had changed, the travelers were standing in the wrong line and the pilot hurried past.',
    palette: ['#277da1', '#90be6d', '#f9844a', '#f9c74f'],
    objects: ['gate sign', 'passports', 'suitcases', 'pilot', 'line'],
    actions: ['standing', 'checking', 'rolling', 'hurrying'],
    sceneScript: sceneScript({
      premise: 'An airport gate changes while travelers are waiting, causing confusion and movement.',
      coreActions: [
        action('travelers-standing', 'travelers', 'Travelers are standing in line.', ['were standing'], 'background ongoing action', ['past continuous']),
        action('family-checking-passports', 'family', 'A family is checking passports.', ['was checking', 'were checking'], 'simultaneous background action', ['past continuous']),
        action('announcement-appeared', 'announcement', 'A gate-change announcement has appeared.', ['appeared', 'had changed'], 'sudden event or earlier past event', ['simple past', 'past perfect']),
        action('luggage-rolled-away', 'luggage', 'Luggage is rolling away.', ['rolled away'], 'sudden event', ['simple past']),
        action('pilot-hurried-past', 'pilot', 'A pilot is hurrying past.', ['hurried past'], 'completed event', ['simple past']),
      ],
      relationships: [
        relation('line-gate-change', 'interruption', { backgroundAction: 'travelers-standing', interruptingAction: 'announcement-appeared', usefulConnectors: ['when', 'after'], modelSentence: 'The travelers were standing in line when the gate changed.' }),
        relation('passports-luggage', 'simultaneous-background', { actions: ['family-checking-passports', 'luggage-rolled-away'], usefulConnectors: ['while'], modelSentence: 'The family was checking passports while a suitcase rolled away.' }),
        relation('announcement-pilot', 'sequence', { earlierAction: 'announcement-appeared', laterAction: 'pilot-hurried-past', usefulConnectors: ['after'], modelSentence: 'After the announcement appeared, a pilot hurried past.' }),
        relation('wrong-gate-before-notice', 'earlier-past', { earlierAction: 'announcement-appeared', laterAction: 'travelers-standing', usefulConnectors: ['after', 'before'], modelSentence: 'After the gate had changed, the travelers were standing in the wrong line.' }),
      ],
      targetRelationships: [
        'The travelers were standing in line when the gate changed.',
        'The family was checking passports while a suitcase rolled away.',
        'After the gate had changed, the travelers were standing in the wrong line.',
      ],
    }),
  },
  {
    id: 'farm-storm',
    title: 'Storm on the farm',
    setting: 'Farmyard',
    image: '/scenes/storm-on-the-farm.png',
    prompt:
      'A farmer closes a gate, chickens run, a horse kicks a bucket, rain starts, and a child carries eggs.',
    focus: ['background and main event', 'when', 'past continuous'],
    sample:
      'The farmer was closing the gate when it started to rain and the chickens ran across the yard.',
    palette: ['#588157', '#dad7cd', '#a3b18a', '#e76f51'],
    objects: ['gate', 'horse', 'bucket', 'eggs', 'rain'],
    actions: ['closing', 'running', 'kicking', 'carrying'],
    sceneScript: sceneScript({
      premise: 'A farmyard becomes chaotic as a storm begins and animals react.',
      coreActions: [
        action('farmer-closing-gate', 'farmer', 'A farmer is closing a gate.', ['was closing'], 'background ongoing action', ['past continuous']),
        action('chickens-ran', 'chickens', 'Chickens are running across the yard.', ['ran'], 'sudden movement event', ['simple past']),
        action('horse-kicked-bucket', 'horse', 'A horse is kicking or has kicked a bucket.', ['kicked'], 'sudden event', ['simple past']),
        action('rain-started', 'rain', 'Rain is starting to fall.', ['started'], 'sudden weather event', ['simple past']),
        action('child-carrying-eggs', 'child', 'A child is carrying eggs.', ['was carrying'], 'simultaneous background action', ['past continuous']),
      ],
      relationships: [
        relation('gate-rain', 'interruption', { backgroundAction: 'farmer-closing-gate', interruptingAction: 'rain-started', usefulConnectors: ['when'], modelSentence: 'The farmer was closing the gate when it started to rain.' }),
        relation('child-chickens', 'simultaneous-background', { actions: ['child-carrying-eggs', 'chickens-ran'], usefulConnectors: ['while'], modelSentence: 'The chickens ran while the child was carrying eggs.' }),
        relation('horse-startled', 'cause-result', { cause: 'storm-started', result: 'horse-kicked-bucket', usefulConnectors: ['because'], modelSentence: 'The horse kicked the bucket because it had been startled.' }),
        relation('storm-before-gate', 'earlier-past', { earlierAction: 'storm-clouds-gathered', laterAction: 'farmer-closing-gate', usefulConnectors: ['before', 'already'], modelSentence: 'The storm had already gathered before the farmer closed the gate.' }),
      ],
      targetRelationships: [
        'The farmer was closing the gate when it started to rain.',
        'The chickens ran while the child was carrying eggs.',
        'The horse kicked the bucket because it had been startled.',
      ],
    }),
  },
  {
    id: 'restaurant-proposal',
    title: 'Dinner surprise',
    setting: 'Restaurant',
    image: '/scenes/dinner-surprise.png',
    prompt:
      'A waiter carries soup, musicians play, a man opens a ring box, a glass breaks, and guests turn around.',
    focus: ['interruption', 'parallel actions', 'while'],
    sample:
      'While the musicians were playing, the man opened the ring box and a waiter dropped a glass.',
    palette: ['#2b2d42', '#8d99ae', '#ef233c', '#edf2f4'],
    objects: ['table', 'soup', 'ring', 'glass', 'violin'],
    actions: ['carrying', 'playing', 'opening', 'breaking'],
    sceneScript: sceneScript({
      premise: 'A restaurant proposal is interrupted by a breaking glass and surprised guests.',
      coreActions: [
        action('waiter-carrying-soup', 'waiter', 'A waiter is carrying soup.', ['was carrying'], 'background ongoing action', ['past continuous']),
        action('musicians-playing', 'musicians', 'Musicians are playing.', ['were playing'], 'simultaneous background action', ['past continuous']),
        action('man-opened-ring-box', 'man', 'A man is opening a ring box.', ['opened', 'had opened'], 'completed event or earlier past event', ['simple past', 'past perfect']),
        action('glass-broke', 'glass', 'A glass is breaking or has broken.', ['broke'], 'sudden event', ['simple past']),
        action('guests-turned', 'guests', 'Guests are turning around.', ['turned around'], 'reaction event', ['simple past']),
      ],
      relationships: [
        relation('music-proposal', 'simultaneous-background', { actions: ['musicians-playing', 'man-opened-ring-box'], usefulConnectors: ['while'], modelSentence: 'While the musicians were playing, the man opened the ring box.' }),
        relation('waiter-glass', 'interruption', { backgroundAction: 'waiter-carrying-soup', interruptingAction: 'glass-broke', usefulConnectors: ['when'], modelSentence: 'The waiter was carrying soup when the glass broke.' }),
        relation('glass-guests', 'cause-result', { cause: 'glass-broke', result: 'guests-turned', usefulConnectors: ['because'], modelSentence: 'Guests turned around because they heard the glass break.' }),
        relation('ring-before-notice', 'earlier-past', { earlierAction: 'man-opened-ring-box', laterAction: 'guests-turned', usefulConnectors: ['before', 'already'], modelSentence: 'The man had already opened the ring box before everyone noticed.' }),
      ],
      targetRelationships: [
        'While the musicians were playing, the man opened the ring box.',
        'The waiter was carrying soup when the glass broke.',
        'The man had already opened the ring box before everyone noticed.',
      ],
    }),
  },
  {
    id: 'library-whisper',
    title: 'The library whisper',
    setting: 'Library',
    image: '/scenes/library-whisper.png',
    prompt:
      'Students read quietly, a librarian stamps books, a shelf collapses, papers fly, and someone whispers into a phone.',
    focus: ['past continuous + simple past', 'contrast', 'while'],
    sample:
      'The students were reading quietly when a shelf collapsed and papers flew across the library.',
    palette: ['#31572c', '#90a955', '#ecf39e', '#4f772d'],
    objects: ['shelves', 'books', 'papers', 'phone', 'desk'],
    actions: ['reading', 'stamping', 'collapsing', 'whispering'],
    sceneScript: sceneScript({
      premise: 'A quiet library is interrupted by a collapsing shelf and flying papers.',
      coreActions: [
        action('students-reading', 'students', 'Students are reading quietly.', ['were reading'], 'background ongoing action', ['past continuous']),
        action('librarian-stamping', 'librarian', 'A librarian is stamping books.', ['was stamping'], 'simultaneous background action', ['past continuous']),
        action('shelf-collapsed', 'shelf', 'A shelf is collapsing.', ['collapsed'], 'sudden event', ['simple past']),
        action('papers-flew', 'papers', 'Papers are flying across the library.', ['flew'], 'result event', ['simple past']),
        action('person-whispering-phone', 'person', 'Someone is whispering into a phone.', ['was whispering'], 'simultaneous background action', ['past continuous']),
      ],
      relationships: [
        relation('reading-shelf', 'interruption', { backgroundAction: 'students-reading', interruptingAction: 'shelf-collapsed', usefulConnectors: ['when'], modelSentence: 'The students were reading quietly when a shelf collapsed.' }),
        relation('stamping-phone', 'simultaneous-background', { actions: ['librarian-stamping', 'person-whispering-phone'], usefulConnectors: ['while'], modelSentence: 'The librarian was stamping books while someone whispered into a phone.' }),
        relation('shelf-papers', 'cause-result', { cause: 'shelf-collapsed', result: 'papers-flew', usefulConnectors: ['because', 'so'], modelSentence: 'Papers flew across the library because the shelf collapsed.' }),
        relation('book-before-collapse', 'earlier-past', { earlierAction: 'book-pulled-loose', laterAction: 'shelf-collapsed', usefulConnectors: ['before', 'already'], modelSentence: 'Someone had already pulled a book loose before the shelf collapsed.' }),
      ],
      targetRelationships: [
        'The students were reading quietly when a shelf collapsed.',
        'Papers flew across the library because the shelf collapsed.',
        'Someone had already pulled a book loose before the shelf collapsed.',
      ],
    }),
  },
  {
    id: 'city-parade',
    title: 'Parade on Main Street',
    setting: 'City parade',
    image: '/scenes/parade-on-main-street.png',
    prompt:
      'A band marches, dancers wave flags, a child loses a balloon, confetti falls, and a photographer kneels.',
    focus: ['simultaneous actions', 'narrative pacing', 'as'],
    sample:
      'As the band was marching down the street, a child lost a balloon and confetti was falling everywhere.',
    palette: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'],
    objects: ['band', 'flags', 'balloon', 'confetti', 'camera'],
    actions: ['marching', 'waving', 'losing', 'kneeling'],
    sceneScript: sceneScript({
      premise: 'A city parade continues as a child loses a balloon and confetti falls.',
      coreActions: [
        action('band-marching', 'band', 'A band is marching down the street.', ['was marching'], 'background ongoing action', ['past continuous']),
        action('dancers-waving', 'dancers', 'Dancers are waving flags.', ['were waving'], 'simultaneous background action', ['past continuous']),
        action('child-lost-balloon', 'child', 'A child is losing or has lost a balloon.', ['lost'], 'sudden event', ['simple past']),
        action('confetti-falling', 'confetti', 'Confetti is falling everywhere.', ['was falling'], 'background atmosphere', ['past continuous']),
        action('photographer-kneeled', 'photographer', 'A photographer is kneeling to take a picture.', ['knelt', 'kneeled'], 'completed event', ['simple past']),
      ],
      relationships: [
        relation('band-balloon', 'interruption', { backgroundAction: 'band-marching', interruptingAction: 'child-lost-balloon', usefulConnectors: ['when', 'as'], modelSentence: 'As the band was marching, a child lost a balloon.' }),
        relation('dancers-confetti', 'simultaneous-background', { actions: ['dancers-waving', 'confetti-falling'], usefulConnectors: ['while', 'as'], modelSentence: 'Dancers were waving flags while confetti was falling.' }),
        relation('parade-photo', 'cause-result', { cause: 'parade-passing', result: 'photographer-kneeled', usefulConnectors: ['because'], modelSentence: 'The photographer knelt because the parade was passing.' }),
        relation('balloon-before-parent', 'earlier-past', { earlierAction: 'child-lost-balloon', laterAction: 'parent-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The child had already let go before the parent noticed.' }),
      ],
      targetRelationships: [
        'As the band was marching, a child lost a balloon.',
        'Dancers were waving flags while confetti was falling.',
        'The child had already let go before the parent noticed.',
      ],
    }),
  },
  {
    id: 'garage-repair',
    title: 'The garage repair',
    setting: 'Car garage',
    image: '/scenes/garage-repair.png',
    prompt:
      'A mechanic fixes an engine, oil leaks, a customer waits, a tire rolls away, and a radio plays.',
    focus: ['ongoing action', 'sudden event', 'when'],
    sample:
      'The mechanic was fixing the engine when oil started leaking and a tire rolled across the floor.',
    palette: ['#1d3557', '#457b9d', '#e63946', '#a8dadc'],
    objects: ['car', 'engine', 'oil', 'tire', 'radio'],
    actions: ['fixing', 'leaking', 'waiting', 'rolling'],
    sceneScript: sceneScript({
      premise: 'A garage repair becomes messy when oil starts leaking and a tire rolls away.',
      coreActions: [
        action('mechanic-fixing-engine', 'mechanic', 'A mechanic is fixing an engine.', ['was fixing'], 'background ongoing action', ['past continuous']),
        action('oil-leaking', 'oil', 'Oil is leaking onto the floor.', ['started leaking', 'was leaking'], 'sudden event or ongoing result', ['simple past', 'past continuous']),
        action('customer-waiting', 'customer', 'A customer is waiting nearby.', ['was waiting'], 'background ongoing action', ['past continuous']),
        action('tire-rolled-away', 'tire', 'A tire is rolling away.', ['rolled away'], 'sudden event', ['simple past']),
        action('radio-playing', 'radio', 'A radio is playing.', ['was playing'], 'background atmosphere', ['past continuous']),
      ],
      relationships: [
        relation('engine-oil', 'interruption', { backgroundAction: 'mechanic-fixing-engine', interruptingAction: 'oil-leaking', usefulConnectors: ['when'], modelSentence: 'The mechanic was fixing the engine when oil started leaking.' }),
        relation('customer-radio', 'simultaneous-background', { actions: ['customer-waiting', 'radio-playing'], usefulConnectors: ['while'], modelSentence: 'The customer was waiting while the radio was playing.' }),
        relation('badly-leaned-tire', 'cause-result', { cause: 'tire-leaned-badly', result: 'tire-rolled-away', usefulConnectors: ['because'], modelSentence: 'The tire rolled away because someone had leaned it badly against the wall.' }),
        relation('oil-before-notice', 'earlier-past', { earlierAction: 'oil-leaking', laterAction: 'mechanic-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The oil had already started leaking before the mechanic noticed.' }),
      ],
      targetRelationships: [
        'The mechanic was fixing the engine when oil started leaking.',
        'The customer was waiting while the radio was playing.',
        'The oil had already started leaking before the mechanic noticed.',
      ],
    }),
  },
  {
    id: 'snowy-bus',
    title: 'Snow at the bus stop',
    setting: 'Bus stop',
    image: '/scenes/snow-at-the-bus-stop.png',
    prompt:
      'People wait in snow, a bus splashes slush, a teenager slips, a woman closes an umbrella, and headlights glow.',
    focus: ['past continuous', 'interruption', 'when'],
    sample:
      'People were waiting in the snow when the bus splashed slush and a teenager slipped.',
    palette: ['#22577a', '#38a3a5', '#c7f9cc', '#ff595e'],
    objects: ['bus', 'umbrella', 'snow', 'headlights', 'bench'],
    actions: ['waiting', 'splashing', 'slipping', 'closing'],
    sceneScript: sceneScript({
      premise: 'People waiting at a snowy bus stop are interrupted by slush and a slipping teenager.',
      coreActions: [
        action('people-waiting', 'people', 'People are waiting in the snow.', ['were waiting'], 'background ongoing action', ['past continuous']),
        action('bus-splashed-slush', 'bus', 'A bus is splashing slush.', ['splashed'], 'sudden event', ['simple past']),
        action('teenager-slipped', 'teenager', 'A teenager is slipping.', ['slipped'], 'reaction event', ['simple past']),
        action('woman-closing-umbrella', 'woman', 'A woman is closing an umbrella.', ['was closing'], 'simultaneous background action', ['past continuous']),
        action('headlights-glowing', 'headlights', 'Headlights are glowing through the snow.', ['were glowing'], 'background atmosphere', ['past continuous']),
      ],
      relationships: [
        relation('waiting-bus', 'interruption', { backgroundAction: 'people-waiting', interruptingAction: 'bus-splashed-slush', usefulConnectors: ['when'], modelSentence: 'People were waiting in the snow when the bus splashed slush.' }),
        relation('umbrella-slip', 'simultaneous-background', { actions: ['woman-closing-umbrella', 'teenager-slipped'], usefulConnectors: ['while'], modelSentence: 'The teenager slipped while the woman was closing her umbrella.' }),
        relation('puddle-slush', 'cause-result', { cause: 'bus-drove-through-puddle', result: 'bus-splashed-slush', usefulConnectors: ['because'], modelSentence: 'The bus splashed slush because it drove through a puddle.' }),
        relation('icy-before-slip', 'earlier-past', { earlierAction: 'street-became-icy', laterAction: 'teenager-slipped', usefulConnectors: ['before', 'already'], modelSentence: 'The street had already become icy before the teenager slipped.' }),
      ],
      targetRelationships: [
        'People were waiting in the snow when the bus splashed slush.',
        'The teenager slipped while the woman was closing her umbrella.',
        'The street had already become icy before the teenager slipped.',
      ],
    }),
  },
  {
    id: 'garden-party',
    title: 'The garden party',
    setting: 'Backyard party',
    image: '/scenes/garden-party.png',
    prompt:
      'Guests eat cake, someone waters plants, a tablecloth blows away, candles go out, and children chase bubbles.',
    focus: ['while', 'multiple actions', 'simple past result'],
    sample:
      'While the guests were eating cake, the wind blew the tablecloth away and the candles went out.',
    palette: ['#43aa8b', '#f9c74f', '#f8961e', '#577590'],
    objects: ['cake', 'plants', 'tablecloth', 'candles', 'bubbles'],
    actions: ['eating', 'watering', 'blowing', 'chasing'],
    sceneScript: sceneScript({
      premise: 'A backyard party is disturbed by wind while guests and children are enjoying themselves.',
      coreActions: [
        action('guests-eating-cake', 'guests', 'Guests are eating cake.', ['were eating'], 'background ongoing action', ['past continuous']),
        action('person-watering-plants', 'person', 'Someone is watering plants.', ['was watering'], 'simultaneous background action', ['past continuous']),
        action('tablecloth-blew-away', 'tablecloth', 'A tablecloth is blowing away.', ['blew away'], 'sudden event', ['simple past']),
        action('candles-went-out', 'candles', 'Candles are going out.', ['went out'], 'result event', ['simple past']),
        action('children-chasing-bubbles', 'children', 'Children are chasing bubbles.', ['were chasing'], 'simultaneous background action', ['past continuous']),
      ],
      relationships: [
        relation('cake-tablecloth', 'interruption', { backgroundAction: 'guests-eating-cake', interruptingAction: 'tablecloth-blew-away', usefulConnectors: ['while', 'when'], modelSentence: 'While the guests were eating cake, the wind blew the tablecloth away.' }),
        relation('watering-bubbles', 'simultaneous-background', { actions: ['person-watering-plants', 'children-chasing-bubbles'], usefulConnectors: ['while'], modelSentence: 'Someone was watering plants while children were chasing bubbles.' }),
        relation('wind-candles', 'cause-result', { cause: 'wind-grew-stronger', result: 'candles-went-out', usefulConnectors: ['because'], modelSentence: 'The candles went out because the wind had grown stronger.' }),
        relation('bubbles-before-tablecloth', 'earlier-past', { earlierAction: 'children-blew-bubbles', laterAction: 'tablecloth-blew-away', usefulConnectors: ['before', 'already'], modelSentence: 'The children had already blown bubbles before the tablecloth lifted.' }),
      ],
      targetRelationships: [
        'While the guests were eating cake, the wind blew the tablecloth away.',
        'The candles went out because the wind had grown stronger.',
        'The children had already blown bubbles before the tablecloth lifted.',
      ],
    }),
  },
  {
    id: 'film-set',
    title: 'On the film set',
    setting: 'Movie set',
    image: '/scenes/on-the-film-set.png',
    prompt:
      'An actor speaks lines, a director points, a camera records, rain machines spray water, and a prop sword falls.',
    focus: ['background actions', 'past perfect', 'when'],
    sample:
      'The actor was speaking his lines when the prop sword fell, although the camera had already started recording.',
    palette: ['#3a0ca3', '#4cc9f0', '#f72585', '#b8f2e6'],
    objects: ['camera', 'sword', 'rain machine', 'script', 'lights'],
    actions: ['speaking', 'pointing', 'recording', 'falling'],
    sceneScript: sceneScript({
      premise: 'A movie scene is being filmed when a prop sword falls during the take.',
      coreActions: [
        action('actor-speaking', 'actor', 'An actor is speaking lines.', ['was speaking'], 'background ongoing action', ['past continuous']),
        action('director-pointing', 'director', 'A director is pointing or giving direction.', ['pointed'], 'completed event', ['simple past']),
        action('camera-recording', 'camera', 'A camera is recording.', ['was recording', 'had started recording'], 'background action or earlier past clue', ['past continuous', 'past perfect']),
        action('rain-machines-spraying', 'rain machines', 'Rain machines are spraying water.', ['were spraying'], 'simultaneous background action', ['past continuous']),
        action('prop-sword-fell', 'prop sword', 'A prop sword is falling.', ['fell'], 'sudden event', ['simple past']),
      ],
      relationships: [
        relation('actor-sword', 'interruption', { backgroundAction: 'actor-speaking', interruptingAction: 'prop-sword-fell', usefulConnectors: ['when'], modelSentence: 'The actor was speaking his lines when the prop sword fell.' }),
        relation('camera-rain', 'simultaneous-background', { actions: ['camera-recording', 'rain-machines-spraying'], usefulConnectors: ['while'], modelSentence: 'The camera was recording while the rain machines were spraying water.' }),
        relation('director-problem', 'cause-result', { cause: 'prop-sword-fell', result: 'director-pointing', usefulConnectors: ['because'], modelSentence: 'The director pointed because the scene had gone wrong.' }),
        relation('camera-before-sword', 'earlier-past', { earlierAction: 'camera-recording', laterAction: 'prop-sword-fell', usefulConnectors: ['before', 'already'], modelSentence: 'The camera had already started recording before the sword fell.' }),
      ],
      targetRelationships: [
        'The actor was speaking his lines when the prop sword fell.',
        'The camera was recording while the rain machines were spraying water.',
        'The camera had already started recording before the sword fell.',
      ],
    }),
  },
  {
    id: 'mountain-trail',
    title: 'The mountain trail',
    setting: 'Mountain path',
    image: '/scenes/mountain-trail.png',
    prompt:
      'Hikers climb a trail, one checks a map, fog rolls in, a backpack opens, and a goat blocks the path.',
    focus: ['past continuous + simple past', 'sequence', 'because'],
    sample:
      'The hikers were climbing the trail when fog rolled in, and they stopped because a goat was blocking the path.',
    palette: ['#2d6a4f', '#74c69d', '#f4a261', '#40916c'],
    objects: ['trail', 'map', 'fog', 'backpack', 'goat'],
    actions: ['climbing', 'checking', 'rolling in', 'blocking'],
    sceneScript: sceneScript({
      premise: 'A mountain hike is interrupted by fog, an open backpack, and a goat blocking the trail.',
      coreActions: [
        action('hikers-climbing', 'hikers', 'Hikers are climbing the trail.', ['were climbing'], 'background ongoing action', ['past continuous']),
        action('hiker-checking-map', 'hiker', 'One hiker is checking a map.', ['was checking'], 'simultaneous background action', ['past continuous']),
        action('fog-rolled-in', 'fog', 'Fog is rolling in.', ['rolled in'], 'sudden weather event', ['simple past']),
        action('backpack-opened', 'backpack', 'A backpack is opening and items are slipping out.', ['opened', 'had opened'], 'completed event or earlier past clue', ['simple past', 'past perfect']),
        action('goat-blocking-path', 'goat', 'A goat is blocking the path.', ['was blocking'], 'ongoing obstacle', ['past continuous']),
      ],
      relationships: [
        relation('hiking-fog', 'interruption', { backgroundAction: 'hikers-climbing', interruptingAction: 'fog-rolled-in', usefulConnectors: ['when'], modelSentence: 'The hikers were climbing the trail when fog rolled in.' }),
        relation('map-goat', 'simultaneous-background', { actions: ['hiker-checking-map', 'goat-blocking-path'], usefulConnectors: ['while'], modelSentence: 'One hiker was checking the map while the goat was blocking the path.' }),
        relation('goat-stopped-hikers', 'cause-result', { cause: 'goat-blocking-path', result: 'hikers-stopped', usefulConnectors: ['because'], modelSentence: 'They stopped because a goat was blocking the path.' }),
        relation('backpack-before-notice', 'earlier-past', { earlierAction: 'backpack-opened', laterAction: 'hiker-noticed', usefulConnectors: ['before', 'already'], modelSentence: 'The backpack had already opened before the hiker noticed.' }),
      ],
      targetRelationships: [
        'The hikers were climbing the trail when fog rolled in.',
        'They stopped because a goat was blocking the path.',
        'The backpack had already opened before the hiker noticed.',
      ],
    }),
  },
]

function sceneScript({ premise, coreActions, relationships, targetRelationships }) {
  return {
    premise,
    visualStyle: 'A modern realistic staged scene, viewed from the audience, with several readable actions happening at once.',
    characters: coreActions
      .filter((item) => !['rain', 'smoke', 'lights', 'luggage', 'alarm', 'kite', 'clouds', 'foam', 'announcement', 'gate', 'glass', 'papers', 'confetti', 'oil', 'bus', 'candles', 'camera', 'fog', 'backpack'].includes(item.actor))
      .map((item) => ({
        id: item.actor,
        description: item.visibleAs,
        action: item.recommendedVerbForms[0],
        grammarRole: item.narrativeRole,
      })),
    coreActions,
    environmentActions: coreActions
      .filter((item) => ['rain', 'smoke', 'lights', 'luggage', 'alarm', 'kite', 'clouds', 'foam', 'announcement', 'gate', 'glass', 'papers', 'confetti', 'oil', 'bus', 'candles', 'camera', 'fog', 'backpack'].includes(item.actor))
      .map((item) => ({
        id: item.id,
        description: item.visibleAs,
        action: item.recommendedVerbForms[0],
        grammarRole: item.narrativeRole,
      })),
    relationships,
    targetRelationships,
  }
}

function action(id, actor, visibleAs, recommendedVerbForms, narrativeRole, grammarTargets) {
  return {
    id,
    actor,
    visibleAs,
    recommendedVerbForms,
    narrativeRole,
    grammarTargets,
  }
}

function relation(id, type, details) {
  return {
    id,
    type,
    ...details,
  }
}
