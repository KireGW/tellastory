import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SceneIllustration } from './components/SceneIllustration.jsx'
import { scenes } from './data/scenes.js'

function App() {
  const [activeId, setActiveId] = useState(getStoredSceneId)
  const [challengeMode, setChallengeMode] = useState(getStoredChallengeMode)
  const [uiLanguage, setUiLanguage] = useState('en')
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isGrammarOpen, setIsGrammarOpen] = useState(false)
  const [hintIndex, setHintIndex] = useState(null)
  const [error, setError] = useState('')
  const feedbackRef = useRef(null)
  const practiceRef = useRef(null)
  const storyInputRef = useRef(null)

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeId) ?? scenes[0],
    [activeId],
  )
  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activeScene.id)
  const challengeOptions = activeScene.challengeModes ?? defaultChallengeModes
  const activeChallenge = challengeOptions[challengeMode] ?? challengeOptions.intermediate ?? Object.values(challengeOptions)[0]
  const copy = translations[uiLanguage]
  const hints = useMemo(() => buildHints(activeScene, challengeMode), [activeScene, challengeMode])
  const activeHint = hintIndex === null ? null : hints[hintIndex % hints.length]
  const feedbackTone = feedback ? getFeedbackTone(copy, feedback) : null
  const storyRows = feedback ? 3 : 8

  useEffect(() => {
    if (!feedback || !feedbackRef.current) {
      return undefined
    }

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })

    return () => window.cancelAnimationFrame(firstFrame)
  }, [feedback])

  useEffect(() => {
    window.localStorage.setItem(storageKeys.sceneId, activeScene.id)
  }, [activeScene.id])

  useEffect(() => {
    window.localStorage.setItem(storageKeys.challengeMode, challengeMode)
  }, [challengeMode])

  useEffect(() => {
    if (!storyInputRef.current) {
      return
    }

    storyInputRef.current.style.height = 'auto'
    storyInputRef.current.style.height = `${storyInputRef.current.scrollHeight}px`
  }, [answer, feedback])

  async function submitStory(event) {
    event.preventDefault()
    setError('')
    setFeedback(null)

    if (answer.trim().split(/\s+/).length < 8) {
      setError(copy.errors.tooShort)
      return
    }

    setIsChecking(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer,
          scene: {
            title: activeScene.title,
            setting: activeScene.setting,
            prompt: activeScene.prompt,
            focus: activeScene.focus,
            sample: activeScene.sample,
            sceneScript: activeScene.sceneScript,
          },
          challenge: {
            id: challengeMode,
            ...activeChallenge,
          },
          feedbackLanguage: languageOptions[uiLanguage].feedbackName,
        }),
      })

      if (!response.ok) {
        throw new Error(copy.errors.checkFailed)
      }

      setFeedback(await response.json())
    } catch (feedbackError) {
      setError(feedbackError.message)
    } finally {
      setIsChecking(false)
    }
  }

  function chooseScene(sceneId) {
    setActiveId(sceneId)
    setAnswer('')
    setFeedback(null)
    setHintIndex(null)
    setError('')
    requestAnimationFrame(() => {
      practiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function chooseSceneByOffset(offset) {
    const nextIndex = (activeSceneIndex + offset + scenes.length) % scenes.length
    chooseScene(scenes[nextIndex].id)
  }

  function addHint() {
    if (!hints.length) {
      return
    }

    setHintIndex((current) => (current === null ? 0 : (current + 1) % hints.length))
  }

  function focusStoryRevision() {
    setFeedback(null)
    setHintIndex(null)
    requestAnimationFrame(() => {
      storyInputRef.current?.focus()
      const answerLength = storyInputRef.current?.value.length ?? 0
      storyInputRef.current?.setSelectionRange(answerLength, answerLength)
    })
  }

  return (
    <main className="app-shell">
      <section className="practice" ref={practiceRef}>
        <div className="scene-pane">
          <section className="instruction-panel">
            <p className="eyebrow app-title-label">{copy.app.eyebrow}</p>
            <h1>{copy.app.title}</h1>
            <p className="scene-prompt">{copy.app.scenePrompt}</p>
          </section>
          <SceneIllustration scene={activeScene} />
          <div className="scene-meta">
            <span>{activeScene.title}</span>
            <div className="scene-stepper" aria-label={copy.sceneNav.label}>
              <button type="button" aria-label={copy.sceneNav.previous} onClick={() => chooseSceneByOffset(-1)}>
                ‹
              </button>
              <span>{activeSceneIndex + 1} / {scenes.length}</span>
              <button type="button" aria-label={copy.sceneNav.next} onClick={() => chooseSceneByOffset(1)}>
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="coach-pane">
          <div className="coach-topbar">
            <label className="language-control">
              <span>{copy.app.language}</span>
              <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value)}>
                {Object.entries(languageOptions).map(([id, option]) => (
                  <option key={id} value={id}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <section className="challenge-box" aria-labelledby="challenge-title">
            <div className="challenge-heading">
              <p className="section-kicker" id="challenge-title">{copy.task.title}</p>
              <button
                type="button"
                className="info-button"
                aria-label={copy.grammar.open}
                onClick={() => setIsGrammarOpen(true)}
              >
                i
              </button>
            </div>
            <div className="challenge-tabs" role="group" aria-label={copy.task.level}>
              {Object.entries(challengeOptions).map(([id, option]) => (
                <button
                  className={id === challengeMode ? 'challenge-tab active' : 'challenge-tab'}
                  type="button"
                  key={id}
                  onClick={() => {
                    setChallengeMode(id)
                    setFeedback(null)
                    setHintIndex(null)
                    setError('')
                  }}
                >
                  {copy.challengeLabels[id] ?? option.label}
                </button>
              ))}
            </div>
            <p className="challenge-prompt">{copy.challengePrompts[challengeMode] ?? activeChallenge.prompt}</p>
          </section>

          <form onSubmit={submitStory} className="story-form">
            <label htmlFor="story-answer">{copy.form.label}</label>
            <textarea
              id="story-answer"
              ref={storyInputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder=""
              rows={storyRows}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <button type="submit" disabled={isChecking}>
                {isChecking ? copy.form.checking : copy.form.submit}
              </button>
              <button type="button" className="ghost" onClick={addHint}>
                {copy.form.hint}
              </button>
            </div>
            <div className="hint-slot">
              {feedback ? (
                <section className="feedback" ref={feedbackRef} aria-live="polite" tabIndex="-1">
                  <div className="feedback-header">
                    <div>
                      <p className="verdict-label">{copy.feedback.verdict}</p>
                      <strong>{feedbackTone.label}</strong>
                    </div>
                    <span className="level-pill">{feedbackTone.detail}</span>
                  </div>
                  <p>{feedback.summary}</p>

                  <div className="coach-grid">
                    <section>
                      <h3>{copy.feedback.worked}</h3>
                      <ul>
                        {feedback.strengths.map((strength) => (
                          <li key={strength}>{strength}</li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h3>{copy.feedback.tryThis}</h3>
                      <ul>
                        {feedback.corrections.map((correction, index) => (
                          <li key={`${correction.grammarFocus}-${index}`}>
                            <span>{correction.suggestion}</span>
                            <small>{correction.reason}</small>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <p className="rewrite"><span>{copy.feedback.betterVersion}</span> {feedback.rewrite}</p>

                  <div className="detected-panel">
                    <p className="section-kicker">{copy.feedback.detected}</p>
                    <div>
                      {[
                        ...(feedback.detected?.verbForms ?? []),
                        ...(feedback.detected?.connectors ?? []),
                        ...(feedback.detected?.timeRelationships ?? []),
                      ].map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </div>

                  <div className="next-challenge">
                    <p><span>{copy.feedback.next}</span> {feedback.challenge}</p>
                    <button type="button" className="ghost" onClick={focusStoryRevision}>
                      {copy.feedback.editStory}
                    </button>
                  </div>
                </section>
              ) : activeHint ? (
                <aside className="hint-panel" aria-live="polite">
                  <p className="section-kicker">{copy.form.hintLabel} {hintIndex + 1}/{hints.length}</p>
                  <p>{activeHint}</p>
                </aside>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <section className="scene-bank" aria-labelledby="scene-bank-title">
        <div className="bank-heading">
          <h2 id="scene-bank-title">{copy.bank.title}</h2>
        </div>
        <div className="scene-grid">
          {scenes.map((scene) => (
            <button
              className={scene.id === activeScene.id ? 'scene-card active' : 'scene-card'}
              type="button"
              key={scene.id}
              onClick={() => chooseScene(scene.id)}
            >
              <SceneIllustration scene={scene} />
              <span>{scene.title}</span>
            </button>
          ))}
        </div>
      </section>

      {isGrammarOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsGrammarOpen(false)}>
          <section
            className="grammar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grammar-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">{copy.grammar.kicker}</p>
                <h2 id="grammar-modal-title">{copy.grammar.title}</h2>
              </div>
              <button type="button" className="modal-close" aria-label={copy.grammar.close} onClick={() => setIsGrammarOpen(false)}>
                {copy.grammar.close}
              </button>
            </div>

            <div className="grammar-list">
              {copy.grammar.items.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span>{item.example}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

const defaultChallengeModes = {
  beginner: {
    label: 'Beginner',
    prompt: 'Write two or three simple past sentences about the scene.',
    targets: ['simple past'],
  },
  intermediate: {
    label: 'Intermediate',
    prompt: 'Use when or while to connect an action in progress with a completed event.',
    targets: ['past continuous', 'simple past', 'when', 'while'],
  },
  advanced: {
    label: 'Advanced',
    prompt: 'Use had for an earlier event, or had been for an earlier action that continued for some time.',
    targets: ['earlier past', 'past perfect when natural', 'past perfect continuous only for ongoing earlier actions'],
  },
}

const storageKeys = {
  sceneId: 'pastNarrationTrainer.activeSceneId',
  challengeMode: 'pastNarrationTrainer.challengeMode',
}

function getStoredSceneId() {
  const storedSceneId = window.localStorage.getItem(storageKeys.sceneId)

  return scenes.some((scene) => scene.id === storedSceneId) ? storedSceneId : scenes[0].id
}

function getStoredChallengeMode() {
  const storedChallengeMode = window.localStorage.getItem(storageKeys.challengeMode)

  return Object.hasOwn(defaultChallengeModes, storedChallengeMode) ? storedChallengeMode : 'intermediate'
}

function buildHints(scene, challengeMode) {
  const relationships = scene.sceneScript?.relationships ?? []
  const interruption = relationships.find((relationship) => relationship.type === 'interruption')
  const causeResult = relationships.find((relationship) => relationship.type === 'cause-result' || relationship.type === 'reaction')
  const earlierPast = relationships.find((relationship) => relationship.type === 'earlier-past')
  const backgroundAction = findAction(scene, interruption?.backgroundAction)
  const eventAction = findAction(scene, interruption?.interruptingAction)
  const resultAction = findAction(scene, causeResult?.result)

  if (challengeMode === 'beginner') {
    return [
      eventAction
        ? `Look for one finished action. You could use: ${eventAction.recommendedVerbForms?.[0] ?? 'simple past'}.`
        : 'Look for one finished action and describe it with simple past.',
      resultAction
        ? `Add a second finished action. Look at: ${resultAction.actor}.`
        : 'Add a second simple past sentence with Then...',
      'Name one person or animal in the scene and say what happened.',
    ]
  }

  if (challengeMode === 'advanced') {
    return [
      earlierPast
        ? `Find a clue about what happened earlier. Use had or had been.`
        : 'Add an earlier past detail with had or had been.',
      'Use before or by the time to make the earlier past relationship clear.',
      'Do not describe every action. Choose the detail that changes the timeline.',
    ]
  }

  return [
    backgroundAction
      ? `Start with the background action: ${backgroundAction.recommendedVerbForms?.[0] ?? 'was/were + -ing'}.`
      : 'Start with an action already in progress.',
    eventAction
      ? `Connect it to a sudden event with when. Look at: ${eventAction.actor}.`
      : 'Connect the background action to a sudden event with when.',
    'Use while for the background action and simple past for the sudden event.',
  ]
}

function findAction(scene, actionId) {
  return scene.sceneScript?.coreActions?.find((action) => action.id === actionId)
}

function getFeedbackTone(copy, feedback) {
  return copy.feedback.verdicts[feedback.verdict] ?? copy.feedback.verdicts['good-start']
}

const languageOptions = {
  en: { label: 'English', feedbackName: 'English' },
  es: { label: 'Español', feedbackName: 'Spanish' },
  no: { label: 'Norsk', feedbackName: 'Norwegian' },
}

const translations = {
  en: {
    app: {
      eyebrow: 'Past narration trainer',
      title: 'Tell what was happening, what happened, and what had happened before.',
      scenePrompt: 'Look at the scene. Tell the story in the past.',
      language: 'Feedback language',
      grammarFocus: 'Grammar focus',
    },
    task: { title: 'Choose a difficulty level', level: 'Challenge level' },
    challengeLabels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    challengePrompts: {
      beginner: 'Write two or three simple past sentences about the scene.',
      intermediate: 'Use when or while to connect an action in progress with a completed event.',
      advanced: 'Use had for an earlier event, or had been for an earlier action that continued for some time.',
    },
    form: {
      label: 'Your story',
      submit: 'Check my verbs',
      checking: 'Checking...',
      hint: 'Give me a hint',
      hintLabel: 'Hint',
    },
    feedback: {
      verdict: 'Coach note',
      verdicts: {
        'keep-building': { label: 'Start with the timeline', detail: 'Use one clear past action' },
        'good-start': { label: 'Good start', detail: 'Clarify the timeline' },
        'good-work': { label: 'Good work', detail: 'A little polish' },
        excellent: { label: 'Excellent', detail: 'Ready to stretch' },
      },
      worked: 'What worked',
      tryThis: 'Try this',
      betterVersion: 'Better version:',
      detected: 'Detected',
      next: 'Next step:',
      editStory: 'Edit story',
      waitingTitle: 'Feedback appears here',
      waitingText: 'Write your story and check your verbs to see coaching without leaving the scene.',
    },
    bank: { title: 'Select a practice scene' },
    sceneNav: {
      label: 'Scene navigation',
      previous: 'Previous scene',
      next: 'Next scene',
    },
    starters: { label: 'Useful story starters' },
    errors: {
      tooShort: 'Write at least one full sentence so the coach can see the verb relationships.',
      checkFailed: 'The coach could not check that answer yet.',
    },
    grammar: {
      open: 'Open grammar guide',
      close: 'Close',
      kicker: 'Grammar guide',
      title: 'Past storytelling verbs',
      items: [
        {
          title: 'Simple Past',
          text: 'Use it for completed events that move the story forward.',
          example: 'The child dropped the oranges. The cyclist swerved.',
        },
        {
          title: 'Past Continuous',
          text: 'Use it for actions already happening in the background.',
          example: 'The vendor was weighing apples when the child dropped the oranges.',
        },
        {
          title: 'Past Perfect',
          text: 'Use it for something that happened before another past moment.',
          example: 'The dog had taken the bread before anyone noticed.',
        },
        {
          title: 'Past Perfect Continuous',
          text: 'Use it for an earlier action that had been continuing for some time.',
          example: 'She had been reading before she fell asleep.',
        },
        {
          title: 'Connectors',
          text: 'Use when, while, as, because, before, after, and by the time to show the timeline.',
          example: 'While shows background. When often marks the event. Because shows cause.',
        },
      ],
    },
  },
  es: {
    app: {
      eyebrow: 'Entrenador de narración en pasado',
      title: 'Cuenta qué estaba pasando, qué pasó y qué había pasado antes.',
      scenePrompt: 'Mira la escena. Cuenta la historia en pasado.',
      language: 'Idioma de ayuda',
      grammarFocus: 'Enfoque gramatical',
    },
    task: { title: 'Elige un nivel de dificultad', level: 'Nivel de reto' },
    challengeLabels: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
    challengePrompts: {
      beginner: 'Escribe dos o tres oraciones en simple past sobre la escena.',
      intermediate: 'Usa when o while para conectar una acción en progreso con un evento terminado.',
      advanced: 'Usa had para un evento anterior, o had been para una acción anterior que continuó durante un tiempo.',
    },
    form: {
      label: 'Tu historia',
      submit: 'Revisar mis verbos',
      checking: 'Revisando...',
      hint: 'Dame una pista',
      hintLabel: 'Pista',
    },
    feedback: {
      verdict: 'Nota del coach',
      verdicts: {
        'keep-building': { label: 'Empieza con la linea de tiempo', detail: 'Usa una accion clara en pasado' },
        'good-start': { label: 'Buen comienzo', detail: 'Aclara la linea de tiempo' },
        'good-work': { label: 'Buen trabajo', detail: 'Un poco de pulido' },
        excellent: { label: 'Excelente', detail: 'Listo para avanzar' },
      },
      worked: 'Lo que funcionó',
      tryThis: 'Prueba esto',
      betterVersion: 'Mejor versión:',
      detected: 'Detectado',
      next: 'Siguiente paso:',
      editStory: 'Editar historia',
      waitingTitle: 'Aquí aparecerá la retroalimentación',
      waitingText: 'Escribe tu historia y revisa tus verbos para ver la ayuda sin salir de la escena.',
    },
    bank: { title: 'Selecciona una escena de práctica' },
    sceneNav: {
      label: 'Navegación de escenas',
      previous: 'Escena anterior',
      next: 'Siguiente escena',
    },
    starters: { label: 'Inicios útiles para historias' },
    errors: {
      tooShort: 'Escribe al menos una oración completa para que el coach pueda ver la relación entre los verbos.',
      checkFailed: 'El coach no pudo revisar esa respuesta todavía.',
    },
    grammar: {
      open: 'Abrir guía gramatical',
      close: 'Cerrar',
      kicker: 'Guía gramatical',
      title: 'Verbos para narrar en pasado',
      items: [
        {
          title: 'Simple Past',
          text: 'Úsalo para eventos terminados que hacen avanzar la historia.',
          example: 'The child dropped the oranges. The cyclist swerved.',
        },
        {
          title: 'Past Continuous',
          text: 'Úsalo para acciones que ya estaban ocurriendo como fondo de la escena.',
          example: 'The vendor was weighing apples when the child dropped the oranges.',
        },
        {
          title: 'Past Perfect',
          text: 'Úsalo para algo que pasó antes de otro momento en el pasado.',
          example: 'The dog had taken the bread before anyone noticed.',
        },
        {
          title: 'Past Perfect Continuous',
          text: 'Úsalo para una acción anterior que había continuado durante un tiempo.',
          example: 'She had been reading before she fell asleep.',
        },
        {
          title: 'Conectores',
          text: 'Usa when, while, as, because, before, after y by the time para mostrar la línea de tiempo.',
          example: 'While presenta el fondo. When suele marcar el evento. Because muestra la causa.',
        },
      ],
    },
  },
  no: {
    app: {
      eyebrow: 'Trener for fortelling i fortid',
      title: 'Fortell hva som holdt på å skje, hva som skjedde, og hva som hadde skjedd før.',
      scenePrompt: 'Se på scenen. Fortell historien i fortid.',
      language: 'Tilbakemeldingsspråk',
      grammarFocus: 'Grammatisk fokus',
    },
    task: { title: 'Velg vanskelighetsgrad', level: 'Nivå' },
    challengeLabels: { beginner: 'Nybegynner', intermediate: 'Middels', advanced: 'Avansert' },
    challengePrompts: {
      beginner: 'Skriv to eller tre setninger i simple past om scenen.',
      intermediate: 'Bruk when eller while for å koble en pågående handling til en avsluttet hendelse.',
      advanced: 'Bruk had for en tidligere hendelse, eller had been for en tidligere handling som varte en stund.',
    },
    form: {
      label: 'Historien din',
      submit: 'Sjekk verbene mine',
      checking: 'Sjekker...',
      hint: 'Gi meg et hint',
      hintLabel: 'Hint',
    },
    feedback: {
      verdict: 'Coachens notat',
      verdicts: {
        'keep-building': { label: 'Start med tidslinjen', detail: 'Bruk en tydelig handling i fortid' },
        'good-start': { label: 'God start', detail: 'Gjor tidslinjen tydeligere' },
        'good-work': { label: 'Godt jobbet', detail: 'Litt finpuss' },
        excellent: { label: 'Utmerket', detail: 'Klar for å strekke deg' },
      },
      worked: 'Dette fungerte',
      tryThis: 'Prøv dette',
      betterVersion: 'Bedre versjon:',
      detected: 'Oppdaget',
      next: 'Neste steg:',
      editStory: 'Rediger historien',
      waitingTitle: 'Tilbakemeldingen vises her',
      waitingText: 'Skriv historien din og sjekk verbene for å se veiledningen uten å forlate scenen.',
    },
    bank: { title: 'Velg en øvingsscene' },
    sceneNav: {
      label: 'Scenenavigasjon',
      previous: 'Forrige scene',
      next: 'Neste scene',
    },
    starters: { label: 'Nyttige fortellingsstartere' },
    errors: {
      tooShort: 'Skriv minst én full setning, så coachen kan se forholdet mellom verbene.',
      checkFailed: 'Coachen kunne ikke sjekke svaret ennå.',
    },
    grammar: {
      open: 'Åpne grammatikkguide',
      close: 'Lukk',
      kicker: 'Grammatikkguide',
      title: 'Verb for fortelling i fortid',
      items: [
        {
          title: 'Simple Past',
          text: 'Brukes for avsluttede hendelser som driver historien videre.',
          example: 'The child dropped the oranges. The cyclist swerved.',
        },
        {
          title: 'Past Continuous',
          text: 'Brukes for handlinger som allerede pågikk i bakgrunnen.',
          example: 'The vendor was weighing apples when the child dropped the oranges.',
        },
        {
          title: 'Past Perfect',
          text: 'Brukes for noe som skjedde før et annet tidspunkt i fortiden.',
          example: 'The dog had taken the bread before anyone noticed.',
        },
        {
          title: 'Past Perfect Continuous',
          text: 'Brukes for en tidligere handling som hadde pågått en stund.',
          example: 'She had been reading before she fell asleep.',
        },
        {
          title: 'Connectors',
          text: 'Bruk when, while, as, because, before, after og by the time for å vise tidslinjen.',
          example: 'While viser bakgrunn. When markerer ofte hendelsen. Because viser årsak.',
        },
      ],
    },
  },
}

export default App
