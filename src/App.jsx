import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isStoryFocused, setIsStoryFocused] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [hintIndex, setHintIndex] = useState(null)
  const [error, setError] = useState('')
  const [sceneDragOffset, setSceneDragOffset] = useState(0)
  const [isSceneDragging, setIsSceneDragging] = useState(false)
  const [isSceneTrackAnimating, setIsSceneTrackAnimating] = useState(false)
  const [pendingSceneHandoffIndex, setPendingSceneHandoffIndex] = useState(null)
  const [scenePeekOffset, setScenePeekOffset] = useState(0)
  const [isScenePeeking, setIsScenePeeking] = useState(false)
  const feedbackRef = useRef(null)
  const practiceRef = useRef(null)
  const storyInputRef = useRef(null)
  const scenePaneRef = useRef(null)
  const sceneViewportRef = useRef(null)
  const pendingFeedbackAnchorRef = useRef(false)
  const scenePeekRef = useRef({
    startX: 0,
    startY: 0,
    startOffset: 0,
    startDistance: 0,
    tracking: false,
    vertical: false,
    pinch: false,
  })
  const sceneSwipeRef = useRef({
    startX: 0,
    startY: 0,
    width: 0,
    tracking: false,
    horizontal: false,
    pendingOffset: 0,
  })

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeId) ?? scenes[0],
    [activeId],
  )
  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activeScene.id)
  const previousScene = scenes[(activeSceneIndex - 1 + scenes.length) % scenes.length]
  const nextScene = scenes[(activeSceneIndex + 1) % scenes.length]
  const challengeOptions = activeScene.challengeModes ?? defaultChallengeModes
  const activeChallenge = challengeOptions[challengeMode] ?? challengeOptions.intermediate ?? Object.values(challengeOptions)[0]
  const submittedChallenge = defaultChallengeModes[challengeMode] ?? activeChallenge
  const copy = translations[uiLanguage]
  const hints = useMemo(() => buildHints(activeScene, challengeMode, copy), [activeScene, challengeMode, copy])
  const activeHint = hintIndex === null ? null : hints[hintIndex % hints.length]
  const feedbackTone = feedback ? getFeedbackTone(copy, feedback) : null
  const isMobileFocusMode = isStoryFocused && isMobileViewport && isKeyboardOpen
  const storyRows = isMobileFocusMode ? 2 : feedback ? 3 : 8
  const mobileGhostText = activeHint && !answer.trim()
    ? activeHint
    : isMobileFocusMode
      ? (copy.challengePrompts[challengeMode] ?? activeChallenge.prompt)
      : copy.app.scenePrompt
  const showMobileGhostText = isMobileViewport && !answer.trim() && !feedback
  const showMobileInlineHint = isMobileViewport && Boolean(activeHint) && Boolean(answer.trim()) && !feedback
  const scenePeekProgress = Math.min(scenePeekOffset, 220) / 220

  useEffect(() => {
    if (!feedback || !feedbackRef.current) {
      return undefined
    }

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (pendingFeedbackAnchorRef.current) {
          pendingFeedbackAnchorRef.current = false
          scrollFeedbackToTopUnderScene(feedbackRef.current)
          return
        }

        scrollFeedbackOnlyIfNeeded(feedbackRef.current)
      })
    })

    return () => window.cancelAnimationFrame(firstFrame)
  }, [feedback])

  useEffect(() => {
    const updateVisualViewportHeight = () => {
      const isMobile = window.matchMedia('(max-width: 560px)').matches
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const keyboardDelta = window.innerHeight - viewportHeight
      const keyboardOpen = isMobile && keyboardDelta > 120
      const effectiveHeight = keyboardOpen ? viewportHeight : window.innerHeight

      document.documentElement.style.setProperty('--visual-viewport-height', `${effectiveHeight}px`)
      setIsMobileViewport(isMobile)
      setIsKeyboardOpen(keyboardOpen)
    }

    updateVisualViewportHeight()
    window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
    window.addEventListener('resize', updateVisualViewportHeight)

    return () => {
      window.visualViewport?.removeEventListener('resize', updateVisualViewportHeight)
      window.removeEventListener('resize', updateVisualViewportHeight)
    }
  }, [])

  useEffect(() => {
    if (!scenePaneRef.current) {
      return undefined
    }

    const updateScenePaneHeight = () => {
      const height = scenePaneRef.current?.getBoundingClientRect().height ?? 0
      document.documentElement.style.setProperty('--mobile-scene-pane-height', `${height}px`)
    }

    updateScenePaneHeight()

    const observer = new ResizeObserver(() => {
      updateScenePaneHeight()
    })

    observer.observe(scenePaneRef.current)
    window.addEventListener('resize', updateScenePaneHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScenePaneHeight)
    }
  }, [activeScene.id, isMobileFocusMode, isMobileMenuOpen, feedback, hintIndex, answer])

  useEffect(() => {
    window.localStorage.setItem(storageKeys.sceneId, activeScene.id)
  }, [activeScene.id])

  useEffect(() => {
    window.localStorage.setItem(storageKeys.challengeMode, challengeMode)
  }, [challengeMode])

  useLayoutEffect(() => {
    if (pendingSceneHandoffIndex === null) {
      return
    }

    const nextScene = scenes[pendingSceneHandoffIndex]

    setActiveId(nextScene.id)
    setAnswer('')
    setFeedback(null)
    setHintIndex(null)
    setError('')
    setSceneDragOffset(0)
    setIsSceneDragging(false)
    setIsSceneTrackAnimating(false)
    setPendingSceneHandoffIndex(null)
  }, [pendingSceneHandoffIndex])

  useEffect(() => {
    if (!storyInputRef.current) {
      return
    }

    if (isMobileFocusMode) {
      const styles = window.getComputedStyle(storyInputRef.current)
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24
      const padding =
        (Number.parseFloat(styles.paddingTop) || 0) +
        (Number.parseFloat(styles.paddingBottom) || 0) +
        (Number.parseFloat(styles.borderTopWidth) || 0) +
        (Number.parseFloat(styles.borderBottomWidth) || 0)
      const minHeight = lineHeight * 2 + padding
      const maxHeight = lineHeight * 4 + padding

      storyInputRef.current.style.height = 'auto'
      const nextHeight = Math.min(Math.max(storyInputRef.current.scrollHeight, minHeight), maxHeight)
      storyInputRef.current.style.height = `${nextHeight}px`
      storyInputRef.current.style.overflowY = storyInputRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden'
      return
    }

    if (window.matchMedia('(max-width: 560px)').matches) {
      storyInputRef.current.style.height = ''
      storyInputRef.current.style.overflowY = 'auto'
      return
    }

    storyInputRef.current.style.height = 'auto'
    storyInputRef.current.style.height = `${storyInputRef.current.scrollHeight}px`
    storyInputRef.current.style.overflowY = 'hidden'
  }, [answer, feedback, isMobileFocusMode])

  async function runStoryCheck() {
    setError('')
    setFeedback(null)

    if (answer.trim().split(/\s+/).length < 8) {
      setError(copy.errors.tooShort)
      return
    }
    const shouldExitFocusAfterFeedback = isMobileFocusMode

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
            ...submittedChallenge,
            label: activeChallenge.label ?? submittedChallenge.label,
          },
          feedbackLanguage: languageOptions[uiLanguage].feedbackName,
        }),
      })

      if (!response.ok) {
        throw new Error(copy.errors.checkFailed)
      }

      const nextFeedback = await response.json()
      setFeedback(nextFeedback)

      if (shouldExitFocusAfterFeedback) {
        pendingFeedbackAnchorRef.current = true
        requestAnimationFrame(() => {
          setIsStoryFocused(false)
          storyInputRef.current?.blur()
        })
      }
    } catch (feedbackError) {
      setError(feedbackError.message)
    } finally {
      setIsChecking(false)
    }
  }

  async function submitStory(event) {
    event.preventDefault()
    await runStoryCheck()
  }

  function chooseScene(sceneId, options = {}) {
    const { scrollToPractice = true, preserveSceneTrack = false } = options
    setActiveId(sceneId)
    setAnswer('')
    setFeedback(null)
    setHintIndex(null)
    setError('')

    if (!preserveSceneTrack) {
      setSceneDragOffset(0)
      setIsSceneDragging(false)
      setIsSceneTrackAnimating(false)
      sceneSwipeRef.current.pendingOffset = 0
    }

    if (scrollToPractice) {
      requestAnimationFrame(() => {
        practiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  function chooseSceneByOffset(offset, options) {
    const nextIndex = (activeSceneIndex + offset + scenes.length) % scenes.length
    chooseScene(scenes[nextIndex].id, options)
  }

  function handleSceneTouchStart(event) {
    if (isMobileFocusMode) {
      const touch = event.touches[0]
      const startDistance = event.touches.length === 2 ? getTouchDistance(event.touches[0], event.touches[1]) : 0
      scenePeekRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffset: scenePeekOffset,
        startDistance,
        tracking: true,
        vertical: false,
        pinch: event.touches.length === 2,
      }
      return
    }

    if (!isMobileViewport || isStoryFocused) {
      sceneSwipeRef.current.tracking = false
      return
    }

    const touch = event.touches[0]
    sceneSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      width: sceneViewportRef.current?.getBoundingClientRect().width ?? window.innerWidth,
      tracking: true,
      horizontal: false,
      pendingOffset: 0,
    }
    setIsSceneTrackAnimating(false)
    setIsSceneDragging(false)
    setSceneDragOffset(0)
  }

  function handleSceneTouchMove(event) {
    if (isMobileFocusMode) {
      if (!scenePeekRef.current.tracking) {
        return
      }

      if (event.touches.length === 2 || scenePeekRef.current.pinch) {
        if (event.touches.length < 2) {
          return
        }

        const distance = getTouchDistance(event.touches[0], event.touches[1])
        const baseDistance = scenePeekRef.current.startDistance || distance
        const scaleDelta = distance / baseDistance - 1
        const nextOffset = Math.min(Math.max(scenePeekRef.current.startOffset + scaleDelta * 260, 0), 220)

        event.preventDefault()
        scenePeekRef.current.pinch = true
        setIsScenePeeking(nextOffset > 0)
        setScenePeekOffset(nextOffset)
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - scenePeekRef.current.startX
      const deltaY = touch.clientY - scenePeekRef.current.startY
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (!scenePeekRef.current.vertical) {
        if (absX < 8 && absY < 8) {
          return
        }

        if (deltaY <= 0 || absY <= absX * 1.1) {
          scenePeekRef.current.tracking = false
          scenePeekRef.current.pinch = false
          setScenePeekOffset(0)
          setIsScenePeeking(false)
          return
        }

        scenePeekRef.current.vertical = true
      }

      event.preventDefault()
      setIsScenePeeking(true)
      setScenePeekOffset(Math.min(Math.max(scenePeekRef.current.startOffset + deltaY * 0.9, 0), 220))
      return
    }

    if (!sceneSwipeRef.current.tracking || !isMobileViewport || isStoryFocused) {
      return
    }

    const touch = event.touches[0]
    const deltaX = touch.clientX - sceneSwipeRef.current.startX
    const deltaY = touch.clientY - sceneSwipeRef.current.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (!sceneSwipeRef.current.horizontal) {
      if (absX < 8 && absY < 8) {
        return
      }

      if (absX <= absY * 1.1) {
        sceneSwipeRef.current.tracking = false
        setSceneDragOffset(0)
        setIsSceneDragging(false)
        return
      }

      sceneSwipeRef.current.horizontal = true
    }

    event.preventDefault()
    setIsSceneDragging(true)
    setIsSceneTrackAnimating(false)

    const maxOffset = sceneSwipeRef.current.width * 0.82
    const softenedOffset = Math.max(Math.min(deltaX * 0.92, maxOffset), -maxOffset)
    setSceneDragOffset(softenedOffset)
  }

  function handleSceneTouchEnd(event) {
    if (isMobileFocusMode) {
      if (event.touches.length > 0) {
        const touch = event.touches[0]
        scenePeekRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startOffset: scenePeekOffset,
          startDistance: event.touches.length === 2 ? getTouchDistance(event.touches[0], event.touches[1]) : 0,
          tracking: true,
          vertical: false,
          pinch: event.touches.length === 2,
        }
        return
      }

      scenePeekRef.current.tracking = false
      scenePeekRef.current.vertical = false
      scenePeekRef.current.pinch = false
      setIsScenePeeking(false)
      setScenePeekOffset(0)
      return
    }

    if (!sceneSwipeRef.current.tracking || !isMobileViewport || isStoryFocused) {
      sceneSwipeRef.current.tracking = false
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - sceneSwipeRef.current.startX
    const deltaY = touch.clientY - sceneSwipeRef.current.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const width = sceneSwipeRef.current.width || window.innerWidth
    const threshold = Math.min(96, width * 0.22)
    const committedOffset = deltaX < 0 ? -width : width

    if (!sceneSwipeRef.current.horizontal || absX < threshold || absX <= absY * 1.15) {
      sceneSwipeRef.current.tracking = false
      sceneSwipeRef.current.horizontal = false
      sceneSwipeRef.current.pendingOffset = 0
      setIsSceneTrackAnimating(true)
      setIsSceneDragging(false)
      setSceneDragOffset(0)
      return
    }

    sceneSwipeRef.current.tracking = false
    sceneSwipeRef.current.horizontal = false
    sceneSwipeRef.current.pendingOffset = deltaX < 0 ? 1 : -1
    setIsSceneTrackAnimating(true)
    setIsSceneDragging(false)
    setSceneDragOffset(committedOffset)
  }

  function handleSceneTrackTransitionEnd() {
    const pendingOffset = sceneSwipeRef.current.pendingOffset

    if (!pendingOffset) {
      setIsSceneTrackAnimating(false)
      setSceneDragOffset(0)
      return
    }

    const nextIndex = (activeSceneIndex + pendingOffset + scenes.length) % scenes.length
    sceneSwipeRef.current.pendingOffset = 0
    setPendingSceneHandoffIndex(nextIndex)
  }

  function addHint() {
    if (!hints.length) {
      return
    }

    setHintIndex((current) => (current === null ? 0 : (current + 1) % hints.length))
  }

  function preserveStoryFocus(event) {
    if (!isMobileViewport) {
      return
    }

    event.preventDefault()
  }

  function handleSubmitPress(event) {
    if (isMobileFocusMode) {
      event.preventDefault()
    }
  }

  function handleSubmitClick(event) {
    if (!isMobileFocusMode) {
      return
    }

    event.preventDefault()
    runStoryCheck()
  }

  function chooseChallenge(id) {
    setChallengeMode(id)
    setFeedback(null)
    setHintIndex(null)
    setError('')
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

  function handleAnswerChange(event) {
    if (isMobileViewport && activeHint) {
      setHintIndex(null)
    }

    setAnswer(event.target.value)
  }

  function renderFocusSceneArtwork() {
    return (
      <div
        className="scene-visual-stack"
        style={{
          '--scene-peek-offset': `${scenePeekOffset}px`,
          '--scene-peek-progress': `${scenePeekProgress}`,
        }}
      >
        <div className="scene-visual-layer is-cover">
          <SceneIllustration scene={activeScene} />
        </div>
        <div className="scene-visual-layer is-contain" aria-hidden="true">
          <SceneIllustration scene={activeScene} />
        </div>
      </div>
    )
  }

  return (
    <main className={isMobileFocusMode ? 'app-shell mobile-focus-mode' : 'app-shell'}>
      <section className="practice" ref={practiceRef}>
        <div className="mobile-settings" aria-label={copy.mobileSettings.label}>
          <div className="mobile-topbar">
            <p className="eyebrow mobile-app-title">{copy.app.eyebrow}</p>
            <button
              type="button"
              className="mobile-menu-button ghost"
              aria-label={copy.mobileSettings.toggle}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
          <div
            className={isMobileMenuOpen ? 'mobile-menu-panel is-open' : 'mobile-menu-panel'}
            aria-hidden={!isMobileMenuOpen}
          >
            <div className="language-stack">
              <label className="language-control">
                <span>{copy.app.language}</span>
                <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value)}>
                  {Object.entries(languageOptions).map(([id, option]) => (
                    <option key={id} value={id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <p className="language-helper">{copy.app.languageHelp}</p>
            </div>
          </div>

          <section className="challenge-box mobile-challenge-box" aria-labelledby="challenge-title-mobile">
            <div className="challenge-heading">
              <p className="section-kicker" id="challenge-title-mobile">{copy.task.title}</p>
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
                  onClick={() => chooseChallenge(id)}
                >
                  {copy.challengeLabels[id] ?? option.label}
                </button>
              ))}
            </div>
            <p className="challenge-prompt">{copy.challengePrompts[challengeMode] ?? activeChallenge.prompt}</p>
          </section>
        </div>

        <div className="scene-pane" ref={scenePaneRef}>
          <section className="instruction-panel">
            <p className="eyebrow app-title-label">{copy.app.eyebrow}</p>
            <h1>{copy.app.title}</h1>
            <p className="scene-prompt">{copy.app.scenePrompt}</p>
          </section>
          <div
            className={[
              isMobileViewport && !isMobileFocusMode ? 'scene-visual is-swipeable' : 'scene-visual',
              isMobileFocusMode && (isScenePeeking || scenePeekOffset > 0) ? 'is-peeking' : '',
            ].filter(Boolean).join(' ')}
            ref={sceneViewportRef}
            onTouchStart={handleSceneTouchStart}
            onTouchMove={handleSceneTouchMove}
            onTouchEnd={handleSceneTouchEnd}
            onTouchCancel={handleSceneTouchEnd}
          >
            {isMobileViewport && !isMobileFocusMode ? (
              <div
                className={isSceneDragging ? 'scene-track is-dragging' : 'scene-track'}
                style={{
                  transform: `translate3d(calc(-33.333333% + ${sceneDragOffset}px), 0, 0)`,
                  transition: isSceneTrackAnimating ? 'transform 220ms ease' : 'none',
                }}
                onTransitionEnd={handleSceneTrackTransitionEnd}
              >
                <div className="scene-slide" aria-hidden="true" key={`previous-${previousScene.id}`}>
                  <SceneIllustration scene={previousScene} />
                </div>
                <div className="scene-slide" key={`active-${activeScene.id}`}>
                  <SceneIllustration scene={activeScene} />
                </div>
                <div className="scene-slide" aria-hidden="true" key={`next-${nextScene.id}`}>
                  <SceneIllustration scene={nextScene} />
                </div>
              </div>
            ) : isMobileFocusMode ? (
              renderFocusSceneArtwork()
            ) : (
              <SceneIllustration scene={activeScene} />
            )}
          </div>
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
            <div className="language-stack">
              <label className="language-control">
                <span>{copy.app.language}</span>
                <select value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value)}>
                  {Object.entries(languageOptions).map(([id, option]) => (
                    <option key={id} value={id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <p className="language-helper">{copy.app.languageHelp}</p>
            </div>
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
                  onClick={() => chooseChallenge(id)}
                >
                  {copy.challengeLabels[id] ?? option.label}
                </button>
              ))}
            </div>
            <p className="challenge-prompt">{copy.challengePrompts[challengeMode] ?? activeChallenge.prompt}</p>
          </section>

          <form onSubmit={submitStory} className="story-form" autoComplete="off">
            <div className="story-composer">
              <label htmlFor="storyText">{copy.form.label}</label>
              <div className={showMobileInlineHint ? 'story-input-shell has-inline-hint' : 'story-input-shell'}>
                {/* Mobile keyboard/autofill controls are browser hints, not guaranteed suppression.
                    Safari/Chrome may still show native accessory bars; full removal needs native app control. */}
                <textarea
                  id="storyText"
                  name="storyText"
                  ref={storyInputRef}
                  value={answer}
                  onChange={handleAnswerChange}
                  onFocus={() => setIsStoryFocused(true)}
                  onBlur={() => setIsStoryFocused(false)}
                  placeholder=""
                  rows={storyRows}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="done"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                />
                {showMobileGhostText ? (
                  <div className={activeHint ? 'story-ghost-text is-hint' : 'story-ghost-text'} aria-hidden="true">
                    {mobileGhostText}
                  </div>
                ) : null}
                {showMobileInlineHint ? (
                  <div className="story-inline-hint" aria-hidden="true">
                    {activeHint}
                  </div>
                ) : null}
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isChecking}
                  onPointerDown={handleSubmitPress}
                  onMouseDown={handleSubmitPress}
                  onClick={handleSubmitClick}
                >
                  {isChecking ? copy.form.checking : copy.form.submit}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onPointerDown={preserveStoryFocus}
                  onMouseDown={preserveStoryFocus}
                  onClick={addHint}
                >
                  {copy.form.hint}
                </button>
              </div>
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
              ) : activeHint && !isMobileViewport ? (
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

function scrollFeedbackOnlyIfNeeded(element) {
  if (!element) {
    return
  }

  const viewportHeight = window.innerHeight
  const rect = element.getBoundingClientRect()
  const tolerance = 2
  const clippedTop = Math.max(0, -rect.top)
  const clippedBottom = Math.max(0, rect.bottom - viewportHeight)

  if (clippedTop <= tolerance && clippedBottom <= tolerance) {
    return
  }

  if (rect.height > viewportHeight) {
    if (clippedTop > tolerance) {
      window.scrollBy({ top: -clippedTop, behavior: 'smooth' })
    }
    return
  }

  const delta = clippedBottom > tolerance
    ? clippedBottom
    : -clippedTop

  window.scrollBy({ top: delta, behavior: 'smooth' })
}

function scrollFeedbackToTopUnderScene(element) {
  if (!element) {
    return
  }

  const scenePane = document.querySelector('.scene-pane')
  const stickyOffset = window.matchMedia('(max-width: 560px)').matches
    ? 0
    : (scenePane ? scenePane.getBoundingClientRect().height : 0)
  const top = window.scrollY + element.getBoundingClientRect().top - stickyOffset - 8

  window.scrollTo({
    top: Math.max(0, top),
    behavior: 'smooth',
  })
}

function buildHints(scene, challengeMode, copy) {
  const relationships = scene.sceneScript?.relationships ?? []
  const coreActions = scene.sceneScript?.coreActions ?? []
  const interruption = relationships.find((relationship) => relationship.type === 'interruption')
  const causeResult = relationships.find((relationship) => relationship.type === 'cause-result' || relationship.type === 'reaction')
  const earlierPast = relationships.find((relationship) => relationship.type === 'earlier-past')
  const backgroundAction = findAction(scene, interruption?.backgroundAction)
  const eventAction = findAction(scene, interruption?.interruptingAction)
  const resultAction = findAction(scene, causeResult?.result)
  const focusActor = eventAction?.actor ?? resultAction?.actor ?? coreActions.find((action) => action.actor)?.actor

  if (challengeMode === 'beginner') {
    return [
      eventAction
        ? copy.hints.beginner.finishedActionWithForm(eventAction.recommendedVerbForms?.[0] ?? copy.hints.defaults.simplePast)
        : copy.hints.beginner.finishedAction,
      resultAction
        ? copy.hints.beginner.secondActionWithActor(resultAction.actor)
        : copy.hints.beginner.secondAction,
      focusActor
        ? copy.hints.beginner.visibleThingWithActor(focusActor)
        : copy.hints.beginner.visibleThing,
    ]
  }

  if (challengeMode === 'advanced') {
    return [
      earlierPast
        ? copy.hints.advanced.earlierClue
        : copy.hints.advanced.earlierDetail,
      copy.hints.advanced.beforeByTheTime,
      copy.hints.advanced.chooseTimeline,
    ]
  }

  return [
    backgroundAction
      ? copy.hints.intermediate.backgroundWithForm(backgroundAction.recommendedVerbForms?.[0] ?? copy.hints.defaults.pastContinuous)
      : copy.hints.intermediate.background,
    eventAction
      ? copy.hints.intermediate.whenWithActor(eventAction.actor)
      : copy.hints.intermediate.when,
    copy.hints.intermediate.whileAndPast,
  ]
}

function findAction(scene, actionId) {
  return scene.sceneScript?.coreActions?.find((action) => action.id === actionId)
}

function getFeedbackTone(copy, feedback) {
  return copy.feedback.verdicts[feedback.verdict] ?? copy.feedback.verdicts['good-start']
}

function getTouchDistance(firstTouch, secondTouch) {
  const deltaX = secondTouch.clientX - firstTouch.clientX
  const deltaY = secondTouch.clientY - firstTouch.clientY

  return Math.hypot(deltaX, deltaY)
}

const languageOptions = {
  en: { label: 'English', feedbackName: 'English' },
  es: { label: 'Español', feedbackName: 'Spanish' },
  sv: { label: 'Svenska', feedbackName: 'Swedish' },
}

const translations = {
  en: {
    app: {
      eyebrow: 'English past narration trainer',
      title: 'Tell what was happening, what happened, and what had happened before.',
      scenePrompt: 'Look at the scene. Tell the story in the past.',
      language: 'Feedback language',
      languageHelp: 'You always write in English. Feedback can be shown in another language.',
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
      submit: 'Check my story',
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
      waitingText: 'Write your story and check it to see coaching without leaving the scene.',
    },
    bank: { title: 'Select a practice scene' },
    mobileSettings: { label: 'Mobile lesson settings', toggle: 'Open feedback settings' },
    sceneNav: {
      label: 'Scene navigation',
      previous: 'Previous scene',
      next: 'Next scene',
    },
    starters: { label: 'Useful story starters' },
    hints: {
      defaults: {
        simplePast: 'simple past',
        pastContinuous: 'was/were + -ing',
      },
      beginner: {
        finishedActionWithForm: (form) => `Look for one finished action. You could use: ${form}.`,
        finishedAction: 'Look for one finished action and describe it with simple past.',
        secondActionWithActor: (actor) => `Add a second finished action. Look at: ${actor}.`,
        secondAction: 'Add a second simple past sentence with Then...',
        visibleThingWithActor: (actor) => `Name one visible person or thing in the scene, like ${actor}, and say what happened.`,
        visibleThing: 'Name one visible person or thing in the scene and say what happened.',
      },
      intermediate: {
        backgroundWithForm: (form) => `Start with the background action: ${form}.`,
        background: 'Start with an action already in progress.',
        whenWithActor: (actor) => `Connect it to a sudden event with when. Look at: ${actor}.`,
        when: 'Connect the background action to a sudden event with when.',
        whileAndPast: 'Use while for the background action and simple past for the sudden event.',
      },
      advanced: {
        earlierClue: 'Find a clue about what happened earlier. Use had or had been.',
        earlierDetail: 'Add an earlier past detail with had or had been.',
        beforeByTheTime: 'Use before or by the time to make the earlier past relationship clear.',
        chooseTimeline: 'Do not describe every action. Choose the detail that changes the timeline.',
      },
    },
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
      eyebrow: 'Entrenador de narración en pasado en inglés',
      title: 'Cuenta qué estaba pasando, qué pasó y qué había pasado antes.',
      scenePrompt: 'Mira la escena. Cuenta la historia en pasado.',
      language: 'Idioma de ayuda',
      languageHelp: 'Siempre escribes en inglés. La retroalimentación puede mostrarse en otro idioma.',
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
      submit: 'Revisar mi historia',
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
      waitingText: 'Escribe tu historia y revísala para ver la ayuda sin salir de la escena.',
    },
    bank: { title: 'Selecciona una escena de práctica' },
    mobileSettings: { label: 'Ajustes móviles de la lección', toggle: 'Abrir ajustes de feedback' },
    sceneNav: {
      label: 'Navegación de escenas',
      previous: 'Escena anterior',
      next: 'Siguiente escena',
    },
    starters: { label: 'Inicios útiles para historias' },
    hints: {
      defaults: {
        simplePast: 'simple past',
        pastContinuous: 'was/were + -ing',
      },
      beginner: {
        finishedActionWithForm: (form) => `Busca una acción terminada. Podrías usar: ${form}.`,
        finishedAction: 'Busca una acción terminada y descríbela con simple past.',
        secondActionWithActor: (actor) => `Añade una segunda acción terminada. Mira: ${actor}.`,
        secondAction: 'Añade una segunda oración en simple past con Then...',
        visibleThingWithActor: (actor) => `Nombra una persona o cosa visible en la escena, como ${actor}, y di qué pasó.`,
        visibleThing: 'Nombra una persona o cosa visible en la escena y di qué pasó.',
      },
      intermediate: {
        backgroundWithForm: (form) => `Empieza con la acción de fondo: ${form}.`,
        background: 'Empieza con una acción que ya estaba en progreso.',
        whenWithActor: (actor) => `Conéctala con un evento repentino usando when. Mira: ${actor}.`,
        when: 'Conecta la acción de fondo con un evento repentino usando when.',
        whileAndPast: 'Usa while para la acción de fondo y simple past para el evento repentino.',
      },
      advanced: {
        earlierClue: 'Busca una pista de lo que había pasado antes. Usa had o had been.',
        earlierDetail: 'Añade un detalle anterior con had o had been.',
        beforeByTheTime: 'Usa before o by the time para dejar clara la relación con el pasado anterior.',
        chooseTimeline: 'No describas cada acción. Elige el detalle que cambia la línea de tiempo.',
      },
    },
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
  sv: {
    app: {
      eyebrow: 'Träning i engelsk berättande i dåtid',
      title: 'Berätta vad som pågick, vad som hände och vad som hade hänt före det.',
      scenePrompt: 'Titta på scenen. Berätta historien i dåtid.',
      language: 'Språk för feedback',
      languageHelp: 'Du skriver alltid på engelska. Feedbacken kan visas på ett annat språk.',
      grammarFocus: 'Grammatiskt fokus',
    },
    task: { title: 'Välj svårighetsgrad', level: 'Nivå' },
    challengeLabels: { beginner: 'Nybörjare', intermediate: 'Medel', advanced: 'Avancerad' },
    challengePrompts: {
      beginner: 'Skriv två eller tre meningar i simple past om scenen.',
      intermediate: 'Använd when eller while för att koppla en pågående handling till en avslutad händelse.',
      advanced: 'Använd had för en tidigare händelse, eller had been för en tidigare handling som pågick en stund.',
    },
    form: {
      label: 'Din text',
      submit: 'Granska min text',
      checking: 'Granskar...',
      hint: 'Ge mig en hint',
      hintLabel: 'Hint',
    },
    feedback: {
      verdict: 'Coachens kommentar',
      verdicts: {
        'keep-building': { label: 'Börja med tidslinjen', detail: 'Använd en tydlig handling i dåtid' },
        'good-start': { label: 'Bra början', detail: 'Förtydliga tidslinjen' },
        'good-work': { label: 'Bra jobbat', detail: 'Lite puts kvar' },
        excellent: { label: 'Utmärkt', detail: 'Redo att gå vidare' },
      },
      worked: 'Det här fungerade',
      tryThis: 'Prova detta',
      betterVersion: 'Bättre version:',
      detected: 'Upptäckt',
      next: 'Nästa steg:',
      editStory: 'Redigera texten',
      waitingTitle: 'Feedback visas här',
      waitingText: 'Skriv din text och granska den för att få coachning utan att lämna scenen.',
    },
    bank: { title: 'Välj en övningsscen' },
    mobileSettings: { label: 'Mobilinställningar för övningen', toggle: 'Öppna feedbackinställningar' },
    sceneNav: {
      label: 'Scennavigering',
      previous: 'Föregående scen',
      next: 'Nästa scen',
    },
    starters: { label: 'Användbara berättelsestarter' },
    hints: {
      defaults: {
        simplePast: 'simple past',
        pastContinuous: 'was/were + -ing',
      },
      beginner: {
        finishedActionWithForm: (form) => `Leta efter en avslutad handling. Du kan använda: ${form}.`,
        finishedAction: 'Leta efter en avslutad handling och beskriv den med simple past.',
        secondActionWithActor: (actor) => `Lägg till en andra avslutad handling. Titta på: ${actor}.`,
        secondAction: 'Lägg till en andra mening i simple past med Then...',
        visibleThingWithActor: (actor) => `Nämn en synlig person eller sak i scenen, till exempel ${actor}, och säg vad som hände.`,
        visibleThing: 'Nämn en synlig person eller sak i scenen och säg vad som hände.',
      },
      intermediate: {
        backgroundWithForm: (form) => `Börja med bakgrundshandlingen: ${form}.`,
        background: 'Börja med en handling som redan pågick.',
        whenWithActor: (actor) => `Knyt den till en plötslig händelse med when. Titta på: ${actor}.`,
        when: 'Knyt bakgrundshandlingen till en plötslig händelse med when.',
        whileAndPast: 'Använd while för bakgrundshandlingen och simple past för den plötsliga händelsen.',
      },
      advanced: {
        earlierClue: 'Leta efter en ledtråd till vad som hade hänt tidigare. Använd had eller had been.',
        earlierDetail: 'Lägg till en tidigare detalj med had eller had been.',
        beforeByTheTime: 'Använd before eller by the time för att göra den tidigare relationen tydlig.',
        chooseTimeline: 'Beskriv inte varje handling. Välj den detalj som förändrar tidslinjen.',
      },
    },
    errors: {
      tooShort: 'Skriv minst en hel mening så att coachen kan se relationen mellan verbformerna.',
      checkFailed: 'Coachen kunde inte granska svaret ännu.',
    },
    grammar: {
      open: 'Öppna grammatikguide',
      close: 'Stäng',
      kicker: 'Grammatikguide',
      title: 'Verb för berättande i dåtid',
      items: [
        {
          title: 'Simple Past',
          text: 'Används för avslutade händelser som för berättelsen framåt.',
          example: 'The child dropped the oranges. The cyclist swerved.',
        },
        {
          title: 'Past Continuous',
          text: 'Används för handlingar som redan pågick i bakgrunden.',
          example: 'The vendor was weighing apples when the child dropped the oranges.',
        },
        {
          title: 'Past Perfect',
          text: 'Används för något som hände före en annan tidpunkt i dåtiden.',
          example: 'The dog had taken the bread before anyone noticed.',
        },
        {
          title: 'Past Perfect Continuous',
          text: 'Används för en tidigare handling som hade pågått under en tid.',
          example: 'She had been reading before she fell asleep.',
        },
        {
          title: 'Connectors',
          text: 'Använd when, while, as, because, before, after och by the time för att visa tidslinjen.',
          example: 'While visar bakgrund. When markerar ofta händelsen. Because visar orsak.',
        },
      ],
    },
  },
}

export default App
