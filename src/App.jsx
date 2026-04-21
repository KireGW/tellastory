import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SceneIllustration } from './components/SceneIllustration.jsx'
import { scenes } from './data/scenes.js'

function App() {
  const [activeId, setActiveId] = useState(getStoredSceneId)
  const [challengeMode, setChallengeMode] = useState(getStoredChallengeMode)
  const [uiLanguage, setUiLanguage] = useState('en')
  const [answer, setAnswer] = useState('')
  const [submittedAnswer, setSubmittedAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [recentAttemptHistory, setRecentAttemptHistory] = useState([])
  const [isChecking, setIsChecking] = useState(false)
  const [isGrammarOpen, setIsGrammarOpen] = useState(false)
  const [isBeginnerPastHintOpen, setIsBeginnerPastHintOpen] = useState(false)
  const [isConnectorHintOpen, setIsConnectorHintOpen] = useState(false)
  const [isPastPerfectHintOpen, setIsPastPerfectHintOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isStoryFocused, setIsStoryFocused] = useState(false)
  const [isFocusSceneExpanded, setIsFocusSceneExpanded] = useState(false)
  const [isFocusSceneExpandedFromFocus, setIsFocusSceneExpandedFromFocus] = useState(false)
  const [isRestoringFocusMode, setIsRestoringFocusMode] = useState(false)
  const [focusSceneZoom, setFocusSceneZoom] = useState({ scale: 1, x: 0, y: 0 })
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [hintIndex, setHintIndex] = useState(null)
  const [error, setError] = useState('')
  const [sceneTrackIndex, setSceneTrackIndex] = useState(getStoredSceneTrackIndex)
  const [sceneDragOffset, setSceneDragOffset] = useState(0)
  const [isSceneDragging, setIsSceneDragging] = useState(false)
  const [isSceneTrackAnimating, setIsSceneTrackAnimating] = useState(false)
  const feedbackRef = useRef(null)
  const practiceRef = useRef(null)
  const storyInputRef = useRef(null)
  const sceneViewportRef = useRef(null)
  const pendingFeedbackAnchorRef = useRef(false)
  const viewportStateRef = useRef({
    height: null,
    isMobile: null,
    keyboardOpen: null,
  })
  const sceneSwipeRef = useRef({
    startX: 0,
    startY: 0,
    width: 0,
    tracking: false,
    horizontal: false,
    targetTrackIndex: null,
  })
  const focusSceneGestureRef = useRef({
    mode: null,
    startDistance: 0,
    startScale: 1,
    startTouchX: 0,
    startTouchY: 0,
    startX: 0,
    startY: 0,
  })

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeId) ?? scenes[0],
    [activeId],
  )
  const activeSceneIndex = scenes.findIndex((scene) => scene.id === activeScene.id)
  const swipeScenes = useMemo(() => {
    if (!scenes.length) {
      return []
    }

    const firstScene = scenes[0]
    const lastScene = scenes[scenes.length - 1]

    return [
      { scene: lastScene, key: `clone-last-${lastScene.id}`, isClone: true },
      ...scenes.map((scene) => ({ scene, key: scene.id, isClone: false })),
      { scene: firstScene, key: `clone-first-${firstScene.id}`, isClone: true },
    ]
  }, [])
  const sceneSlideCount = swipeScenes.length || 1
  const sceneTrackTranslatePercent = -(sceneTrackIndex * 100) / sceneSlideCount
  const challengeOptions = activeScene.challengeModes ?? defaultChallengeModes
  const activeChallenge = challengeOptions[challengeMode] ?? challengeOptions.intermediate ?? Object.values(challengeOptions)[0]
  const submittedChallenge = defaultChallengeModes[challengeMode] ?? activeChallenge
  const copy = translations[uiLanguage]
  const hints = useMemo(() => buildHints(activeScene, challengeMode, copy), [activeScene, challengeMode, copy])
  const activeHint = hintIndex === null ? null : hints[hintIndex % hints.length]
  const feedbackTone = feedback ? getFeedbackTone(copy, feedback) : null
  const isMobileFocusMode = isMobileViewport && (
    (isFocusSceneExpanded && isFocusSceneExpandedFromFocus) ||
    (isStoryFocused && (isKeyboardOpen || isRestoringFocusMode))
  )
  const storyRows = isMobileFocusMode ? 2 : feedback ? 3 : 8
  const challengePromptParts = getChallengePromptParts(copy, challengeMode, activeChallenge)
  const challengeSubprompt = copy.challengeSubprompts?.[challengeMode] ?? ''
  const mobileGhostText = activeHint && !answer.trim()
    ? activeHint
    : isMobileFocusMode
      ? (copy.challengePrompts[challengeMode] ?? activeChallenge.prompt)
      : copy.app.scenePrompt
  const showMobileGhostText = isMobileViewport && !answer.trim() && !feedback
  const showMobileInlineHint = isMobileViewport && Boolean(activeHint) && Boolean(answer.trim()) && !feedback
  const showBetterVersion = Boolean(
    feedback?.rewrite &&
    hasMeaningfulRewriteDifference(feedback.rewrite, submittedAnswer),
  )

  useEffect(() => {
    if (!isMobileViewport) {
      setIsFocusSceneExpanded(false)
      setIsFocusSceneExpandedFromFocus(false)
    }
  }, [isMobileViewport])

  useEffect(() => {
    if (!isFocusSceneExpanded) {
      setIsFocusSceneExpandedFromFocus(false)
      setFocusSceneZoom({ scale: 1, x: 0, y: 0 })
      focusSceneGestureRef.current = {
        mode: null,
        startDistance: 0,
        startScale: 1,
        startTouchX: 0,
        startTouchY: 0,
        startX: 0,
        startY: 0,
      }
    }
  }, [isFocusSceneExpanded])

  useEffect(() => {
    if (!isRestoringFocusMode) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setIsRestoringFocusMode(false)
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [isRestoringFocusMode])

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
      const nextHeight = keyboardOpen ? `${viewportHeight}px` : null

      if (viewportStateRef.current.height !== nextHeight) {
        if (nextHeight) {
          document.documentElement.style.setProperty('--visual-viewport-height', nextHeight)
        } else {
          document.documentElement.style.removeProperty('--visual-viewport-height')
        }
        viewportStateRef.current.height = nextHeight
      }

      if (viewportStateRef.current.isMobile !== isMobile) {
        setIsMobileViewport(isMobile)
        viewportStateRef.current.isMobile = isMobile
      }

      if (viewportStateRef.current.keyboardOpen !== keyboardOpen) {
        setIsKeyboardOpen(keyboardOpen)
        viewportStateRef.current.keyboardOpen = keyboardOpen
      }
    }

    updateVisualViewportHeight()
    window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
    window.addEventListener('resize', updateVisualViewportHeight)
    window.addEventListener('orientationchange', updateVisualViewportHeight)

    return () => {
      window.visualViewport?.removeEventListener('resize', updateVisualViewportHeight)
      window.removeEventListener('resize', updateVisualViewportHeight)
      window.removeEventListener('orientationchange', updateVisualViewportHeight)
    }
  }, [])

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
    const checkedAnswer = answer
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: checkedAnswer,
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
          recentAttemptHistory,
        }),
      })

      if (!response.ok) {
        throw new Error(copy.errors.checkFailed)
      }

      const nextFeedback = await response.json()
      setSubmittedAnswer(checkedAnswer)
      setFeedback(nextFeedback)
      setRecentAttemptHistory((history) => [
        ...history.slice(-3),
        {
          selectedDifficulty: challengeMode,
          currentLevelTargetMet: nextFeedback.taskFit === 'on target',
          currentLevelTargetStrength: nextFeedback.taskFit === 'on target'
            ? 'clear'
            : nextFeedback.taskFit === 'partly on target'
            ? 'partial'
            : 'none',
          englishStatus: nextFeedback.englishStatus,
          sceneFit: nextFeedback.sceneFit,
          taskFit: nextFeedback.taskFit,
          errorSeverity:
            nextFeedback.englishStatus === 'unclear' || nextFeedback.sceneFit === 'not scene-based'
              ? 'high'
              : nextFeedback.englishStatus === 'mostly correct' || nextFeedback.sceneFit === 'partly on scene'
              ? 'low'
              : 'none',
          levelReadinessHintShown: Boolean(nextFeedback.levelReadinessHint),
        },
      ])

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
    const { scrollToPractice = true } = options
    const nextSceneIndex = scenes.findIndex((scene) => scene.id === sceneId)

    setActiveId(sceneId)
    if (nextSceneIndex >= 0) {
      setSceneTrackIndex(nextSceneIndex + 1)
    }
    setAnswer('')
    setSubmittedAnswer('')
    setFeedback(null)
    setHintIndex(null)
    setError('')
    setSceneDragOffset(0)
    setIsSceneDragging(false)
    setIsSceneTrackAnimating(false)
    sceneSwipeRef.current.targetTrackIndex = null

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
    if (!isMobileViewport || isMobileFocusMode || isFocusSceneExpanded) {
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
      targetTrackIndex: null,
    }
    setIsSceneTrackAnimating(false)
    setIsSceneDragging(false)
    setSceneDragOffset(0)
  }

  function handleSceneTouchMove(event) {
    if (!sceneSwipeRef.current.tracking || !isMobileViewport || isMobileFocusMode || isFocusSceneExpanded) {
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

      if (absX <= absY * 0.85) {
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
    if (!sceneSwipeRef.current.tracking || !isMobileViewport || isMobileFocusMode || isFocusSceneExpanded) {
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
    const tapThreshold = 10

    if (!sceneSwipeRef.current.horizontal && absX < tapThreshold && absY < tapThreshold) {
      sceneSwipeRef.current.tracking = false
      sceneSwipeRef.current.horizontal = false
      sceneSwipeRef.current.targetTrackIndex = null
      setIsSceneTrackAnimating(false)
      setIsSceneDragging(false)
      setSceneDragOffset(0)
      openFocusSceneExpanded(false)
      return
    }

    if (!sceneSwipeRef.current.horizontal || absX < threshold || absX <= absY * 0.9) {
      sceneSwipeRef.current.tracking = false
      sceneSwipeRef.current.horizontal = false
      sceneSwipeRef.current.targetTrackIndex = null
      setIsSceneTrackAnimating(true)
      setIsSceneDragging(false)
      setSceneDragOffset(0)
      return
    }

    const targetTrackIndex = sceneTrackIndex + (deltaX < 0 ? 1 : -1)
    sceneSwipeRef.current.tracking = false
    sceneSwipeRef.current.horizontal = false
    sceneSwipeRef.current.targetTrackIndex = targetTrackIndex
    setIsSceneTrackAnimating(true)
    setIsSceneDragging(false)
    setSceneTrackIndex(targetTrackIndex)
    setSceneDragOffset(0)
  }

  function handleSceneTrackTransitionEnd(event) {
    if (event.target !== event.currentTarget) {
      return
    }

    const targetTrackIndex = sceneSwipeRef.current.targetTrackIndex

    if (targetTrackIndex === null) {
      setIsSceneTrackAnimating(false)
      setSceneDragOffset(0)
      return
    }

    sceneSwipeRef.current.targetTrackIndex = null
    setIsSceneTrackAnimating(false)
    setSceneDragOffset(0)
    setIsSceneDragging(false)

    let normalizedTrackIndex = targetTrackIndex

    if (targetTrackIndex === 0) {
      normalizedTrackIndex = scenes.length
    } else if (targetTrackIndex === scenes.length + 1) {
      normalizedTrackIndex = 1
    }

    const normalizedSceneIndex = normalizedTrackIndex - 1
    setActiveId(scenes[normalizedSceneIndex].id)
    setAnswer('')
    setFeedback(null)
    setHintIndex(null)
    setError('')

    if (normalizedTrackIndex !== targetTrackIndex) {
      requestAnimationFrame(() => {
        setSceneTrackIndex(normalizedTrackIndex)
      })
    }
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

  function openFocusSceneExpanded(returnToFocus = false) {
    setIsFocusSceneExpandedFromFocus(returnToFocus)
    setIsFocusSceneExpanded(true)
  }

  function closeFocusSceneExpanded() {
    setIsFocusSceneExpanded(false)
    if (isFocusSceneExpandedFromFocus) {
      setIsStoryFocused(true)
      setIsRestoringFocusMode(true)
      requestAnimationFrame(() => {
        storyInputRef.current?.focus()
      })
    }
  }

  function handleFocusSceneTouchStart(event) {
    const touches = event.touches

    if (touches.length === 2) {
      const [first, second] = touches
      focusSceneGestureRef.current = {
        mode: 'pinch',
        startDistance: getTouchDistance(first, second),
        startScale: focusSceneZoom.scale,
        startTouchX: 0,
        startTouchY: 0,
        startX: focusSceneZoom.x,
        startY: focusSceneZoom.y,
      }
      return
    }

    if (touches.length === 1 && focusSceneZoom.scale > 1) {
      const [touch] = touches
      focusSceneGestureRef.current = {
        mode: 'pan',
        startDistance: 0,
        startScale: focusSceneZoom.scale,
        startTouchX: touch.clientX,
        startTouchY: touch.clientY,
        startX: focusSceneZoom.x,
        startY: focusSceneZoom.y,
      }
    }
  }

  function handleFocusSceneTouchMove(event) {
    const gesture = focusSceneGestureRef.current

    if (gesture.mode === 'pinch' && event.touches.length === 2) {
      event.preventDefault()
      const [first, second] = event.touches
      const distance = getTouchDistance(first, second)
      const nextScale = clamp(gesture.startScale * (distance / Math.max(gesture.startDistance, 1)), 1, 4)
      const scaleRatio = nextScale / Math.max(focusSceneZoom.scale, 1)

      setFocusSceneZoom((current) => {
        if (nextScale <= 1.05) {
          return { scale: 1, x: 0, y: 0 }
        }

        return {
          scale: nextScale,
          x: current.x * scaleRatio,
          y: current.y * scaleRatio,
        }
      })
      return
    }

    if (gesture.mode === 'pan' && event.touches.length === 1 && focusSceneZoom.scale > 1) {
      event.preventDefault()
      const [touch] = event.touches
      const deltaX = touch.clientX - gesture.startTouchX
      const deltaY = touch.clientY - gesture.startTouchY

      setFocusSceneZoom((current) => ({
        ...current,
        x: gesture.startX + deltaX,
        y: gesture.startY + deltaY,
      }))
    }
  }

  function handleFocusSceneTouchEnd(event) {
    if (event.touches.length === 1 && focusSceneZoom.scale > 1) {
      const [touch] = event.touches
      focusSceneGestureRef.current = {
        mode: 'pan',
        startDistance: 0,
        startScale: focusSceneZoom.scale,
        startTouchX: touch.clientX,
        startTouchY: touch.clientY,
        startX: focusSceneZoom.x,
        startY: focusSceneZoom.y,
      }
      return
    }

    focusSceneGestureRef.current.mode = null

    if (event.touches.length === 0 && focusSceneZoom.scale <= 1.05) {
      setFocusSceneZoom({ scale: 1, x: 0, y: 0 })
    }
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

  function clearStory() {
    setAnswer('')
    setSubmittedAnswer('')
    setError('')
    setHintIndex(null)
    requestAnimationFrame(() => {
      storyInputRef.current?.focus()
    })
  }

  function refreshFromTitle() {
    setAnswer('')
    window.location.reload()
  }

  return (
    <main className={isMobileFocusMode ? 'app-shell mobile-focus-mode' : 'app-shell'}>
      <section className="practice" ref={practiceRef}>
        <div className="mobile-settings" aria-label={copy.mobileSettings.label}>
          <div className="mobile-topbar">
            <div className="mobile-app-brand">
              <button type="button" className="title-reset mobile-app-title-button" onClick={refreshFromTitle}>
                <span className="mobile-app-title">{copy.app.title}</span>
              </button>
              <p className="mobile-app-subtitle">{copy.app.subtitle}</p>
            </div>
            <button
              type="button"
              className={isMobileMenuOpen ? 'mobile-menu-button ghost is-open' : 'mobile-menu-button ghost'}
              aria-label={copy.mobileSettings.toggle}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
          <div className={isMobileMenuOpen ? 'mobile-menu-panel is-open' : 'mobile-menu-panel'} aria-hidden={!isMobileMenuOpen}>
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
            <p className="challenge-prompt">
              {renderChallengePrompt(challengePromptParts, {
                challengeMode,
                openGrammar: () => setIsGrammarOpen(true),
                openBeginnerPastHint: () => setIsBeginnerPastHintOpen(true),
                openConnectorHint: () => setIsConnectorHintOpen(true),
                openPastPerfectHint: () => setIsPastPerfectHintOpen(true),
              })}
            </p>
            {challengeSubprompt ? (
              <p className="challenge-subprompt">{challengeSubprompt}</p>
            ) : null}
          </section>
        </div>

        <div className="scene-pane">
          <section className="instruction-panel">
            <button type="button" className="title-reset app-title-button" onClick={refreshFromTitle}>
              <span className="app-title-text">{copy.app.title}</span>
            </button>
            <p className="app-subtitle">{copy.app.subtitle}</p>
            <p className="scene-prompt">{copy.app.scenePrompt}</p>
          </section>
        <div
          className={isMobileViewport && !isMobileFocusMode ? 'scene-visual is-swipeable' : 'scene-visual'}
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
                  '--scene-slide-count': sceneSlideCount,
                  width: `${sceneSlideCount * 100}%`,
                  transform: `translate3d(calc(${sceneTrackTranslatePercent}% + ${sceneDragOffset}px), 0, 0)`,
                  transition: isSceneTrackAnimating ? 'transform 220ms ease' : 'none',
                }}
                onTransitionEnd={handleSceneTrackTransitionEnd}
              >
                {swipeScenes.map(({ scene, key, isClone }) => (
                  <div className="scene-slide" aria-hidden={isClone ? 'true' : undefined} key={key}>
                    <SceneIllustration scene={scene} />
                  </div>
                ))}
              </div>
            ) : (
              <SceneIllustration scene={activeScene} />
            )}
            {isMobileFocusMode ? (
              <button
                type="button"
                className="focus-scene-toggle ghost"
                aria-label={copy.form.openImage}
                onPointerDown={preserveStoryFocus}
                onMouseDown={preserveStoryFocus}
                onClick={() => openFocusSceneExpanded(true)}
              >
                ⤢
              </button>
            ) : null}
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
            <p className="challenge-prompt">
              {renderChallengePrompt(challengePromptParts, {
                challengeMode,
                openGrammar: () => setIsGrammarOpen(true),
                openBeginnerPastHint: () => setIsBeginnerPastHintOpen(true),
                openConnectorHint: () => setIsConnectorHintOpen(true),
                openPastPerfectHint: () => setIsPastPerfectHintOpen(true),
              })}
            </p>
            {challengeSubprompt ? (
              <p className="challenge-subprompt">{challengeSubprompt}</p>
            ) : null}
          </section>

          <form onSubmit={submitStory} className="story-form" autoComplete="off">
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
                onFocus={() => {
                  setIsStoryFocused(true)
                  setIsRestoringFocusMode(false)
                }}
                onBlur={() => {
                  setIsStoryFocused(false)
                }}
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
              <button
                type="button"
                className="ghost clear-button"
                onPointerDown={preserveStoryFocus}
                onMouseDown={preserveStoryFocus}
                onClick={clearStory}
              >
              {copy.form.clear}
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

                  {showBetterVersion ? (
                    <p className="rewrite"><span>{copy.feedback.betterVersion}</span> {feedback.rewrite}</p>
                  ) : null}

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

                  {feedback.levelReadinessHint ? (
                    <p className="readiness-hint">
                      <span>{copy.feedback.readiness}</span> {feedback.levelReadinessHint}
                    </p>
                  ) : null}
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

      {isFocusSceneExpanded ? (
        <div
          className="focus-scene-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={copy.form.openImage}
          onClick={closeFocusSceneExpanded}
        >
          <button
            type="button"
            className="focus-scene-close ghost"
            aria-label={copy.form.closeImage}
            onPointerDown={preserveStoryFocus}
            onMouseDown={preserveStoryFocus}
            onClick={closeFocusSceneExpanded}
          >
            ×
          </button>
          <div
            className="focus-scene-overlay-art"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleFocusSceneTouchStart}
            onTouchMove={handleFocusSceneTouchMove}
            onTouchEnd={handleFocusSceneTouchEnd}
            onTouchCancel={handleFocusSceneTouchEnd}
          >
            <div
              className="focus-scene-zoom-content"
              style={{
                transform: `translate3d(${focusSceneZoom.x}px, ${focusSceneZoom.y}px, 0) scale(${focusSceneZoom.scale})`,
              }}
            >
              {activeScene.image ? (
                <img
                  className="focus-scene-image"
                  src={activeScene.image}
                  alt={activeScene.prompt}
                  draggable="false"
                />
              ) : (
                <SceneIllustration scene={activeScene} />
              )}
            </div>
          </div>
        </div>
      ) : null}

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
                ×
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

      {isBeginnerPastHintOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsBeginnerPastHintOpen(false)}>
          <section
            className="grammar-modal connector-hint-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beginner-hint-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">{copy.beginnerPastHint.kicker}</p>
                <h2 id="beginner-hint-title">{copy.beginnerPastHint.title}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={copy.grammar.close}
                onClick={() => setIsBeginnerPastHintOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="connector-hint-grid quick-hint-grid-single">
              <article>
                <p>{copy.beginnerPastHint.text}</p>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {isConnectorHintOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsConnectorHintOpen(false)}>
          <section
            className="grammar-modal connector-hint-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connector-hint-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">{copy.connectorHint.kicker}</p>
                <h2 id="connector-hint-title">{copy.connectorHint.title}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={copy.grammar.close}
                onClick={() => setIsConnectorHintOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="connector-hint-grid">
              <article>
                <h3>{copy.connectorHint.when.title}</h3>
                <p>{copy.connectorHint.when.text}</p>
              </article>
              <article>
                <h3>{copy.connectorHint.while.title}</h3>
                <p>{copy.connectorHint.while.text}</p>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {isPastPerfectHintOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPastPerfectHintOpen(false)}>
          <section
            className="grammar-modal connector-hint-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="past-perfect-hint-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">{copy.pastPerfectHint.kicker}</p>
                <h2 id="past-perfect-hint-title">{copy.pastPerfectHint.title}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label={copy.grammar.close}
                onClick={() => setIsPastPerfectHintOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="connector-hint-grid">
              <article>
                <h3>{copy.pastPerfectHint.had.title}</h3>
                <p>{copy.pastPerfectHint.had.text}</p>
              </article>
              <article>
                <h3>{copy.pastPerfectHint.hadBeen.title}</h3>
                <p>{copy.pastPerfectHint.hadBeen.text}</p>
              </article>
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

function hasMeaningfulRewriteDifference(rewrite, original) {
  const normalizedRewrite = normalizeComparableSentence(rewrite)
  const normalizedOriginal = normalizeComparableSentence(original)

  return Boolean(normalizedRewrite) && normalizedRewrite !== normalizedOriginal
}

function normalizeComparableSentence(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function getStoredSceneTrackIndex() {
  const storedSceneId = getStoredSceneId()
  const storedSceneIndex = scenes.findIndex((scene) => scene.id === storedSceneId)

  return storedSceneIndex >= 0 ? storedSceneIndex + 1 : 1
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
  const stickyOffset = scenePane ? scenePane.getBoundingClientRect().height : 0
  const top = window.scrollY + element.getBoundingClientRect().top - stickyOffset - 8

  window.scrollTo({
    top: Math.max(0, top),
    behavior: 'smooth',
  })
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getTouchDistance(firstTouch, secondTouch) {
  return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY)
}

function buildHints(scene, challengeMode, copy) {
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
        ? copy.hints.beginner.finishedAction(eventAction.recommendedVerbForms?.[0] ?? 'simple past')
        : copy.hints.beginner.finishedActionFallback,
      resultAction
        ? copy.hints.beginner.secondAction(resultAction.actor)
        : copy.hints.beginner.secondActionFallback,
      copy.hints.beginner.sceneAnchor,
    ]
  }

  if (challengeMode === 'advanced') {
    return [
      earlierPast
        ? copy.hints.advanced.earlierPast
        : copy.hints.advanced.earlierPastFallback,
      copy.hints.advanced.connectors,
      copy.hints.advanced.selectiveDetail,
    ]
  }

  return [
    backgroundAction
      ? copy.hints.intermediate.backgroundAction(backgroundAction.recommendedVerbForms?.[0] ?? 'was/were + -ing')
      : copy.hints.intermediate.backgroundActionFallback,
    eventAction
      ? copy.hints.intermediate.eventAction(eventAction.actor)
      : copy.hints.intermediate.eventActionFallback,
    copy.hints.intermediate.pattern,
  ]
}

function getChallengePromptParts(copy, challengeMode, activeChallenge) {
  const text = copy.challengePrompts[challengeMode] ?? activeChallenge.prompt
  const grammarTerms = ['simple past', 'had been', 'had', 'when', 'while']
  const orderedTerms = grammarTerms
    .filter((term) => text.includes(term))
    .sort((left, right) => right.length - left.length)

  if (!orderedTerms.length) {
    return [{ type: 'text', value: text }]
  }

  const parts = []
  let cursor = 0

  while (cursor < text.length) {
    let nextMatch = null

    for (const term of orderedTerms) {
      const matchIndex = text.indexOf(term, cursor)
      if (matchIndex === -1) {
        continue
      }

      if (!nextMatch || matchIndex < nextMatch.index) {
        nextMatch = { term, index: matchIndex }
      }
    }

    if (!nextMatch) {
      parts.push({ type: 'text', value: text.slice(cursor) })
      break
    }

    if (nextMatch.index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, nextMatch.index) })
    }

    parts.push({ type: 'grammar', value: nextMatch.term })
    cursor = nextMatch.index + nextMatch.term.length
  }

  return parts
}

function renderChallengePrompt(parts, {
  challengeMode,
  openGrammar,
  openBeginnerPastHint,
  openConnectorHint,
  openPastPerfectHint,
}) {
  return parts.map((part, index) => {
    if (part.type !== 'grammar') {
      return <span key={`text-${index}`}>{part.value}</span>
    }

    const opensBeginnerPastHint =
      challengeMode === 'beginner' &&
      part.value === 'in the past'
    const opensConnectorHint =
      challengeMode === 'intermediate' &&
      (part.value === 'when' || part.value === 'while')
    const opensPastPerfectHint =
      challengeMode === 'advanced' &&
      (part.value === 'had' || part.value === 'had been')

    return (
      <button
        key={`grammar-${part.value}-${index}`}
        type="button"
        className="grammar-inline-link"
        onClick={() => {
          if (opensBeginnerPastHint) {
            openBeginnerPastHint()
            return
          }

          if (opensConnectorHint) {
            openConnectorHint()
            return
          }

          if (opensPastPerfectHint) {
            openPastPerfectHint()
            return
          }

          openGrammar()
        }}
      >
        {part.value}
      </button>
    )
  })
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
  sv: { label: 'Svenska', feedbackName: 'Swedish' },
}

const translations = {
  en: {
    app: {
      title: 'Tell a story',
      subtitle: 'English past narration trainer',
      scenePrompt: 'Look at the scene. Tell the story in the past.',
      language: 'Feedback language',
      languageHelp: 'You always write in English. Feedback can be shown in another language.',
      grammarFocus: 'Grammar focus',
    },
    task: { title: 'Choose a difficulty level', level: 'Challenge level' },
    challengeLabels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
    challengePrompts: {
      beginner: 'Write 2-3 sentences about the scene in the past.',
      intermediate: 'Use when or while to connect actions in the past.',
      advanced: 'Add what happened before using had or had been.',
    },
    challengeSubprompts: {},
    beginnerPastHint: {
      kicker: 'Quick hint',
      title: 'in the past',
      text: 'Describe what people did and what was happening.',
    },
    connectorHint: {
      kicker: 'Quick hint',
      title: 'when / while',
      when: {
        title: 'when',
        text: 'Something happens\n(a moment)',
      },
      while: {
        title: 'while',
        text: 'Things are happening\n(a longer time)',
      },
    },
    pastPerfectHint: {
      kicker: 'Quick hint',
      title: 'had and had been',
      had: {
        title: 'had',
        text: 'A finished action before.',
      },
      hadBeen: {
        title: 'had been',
        text: 'An ongoing action before.',
      },
    },
    form: {
      label: 'Your story',
      submit: 'Check my story',
      checking: 'Checking...',
      hint: 'Give me a hint',
      clear: 'Clear',
      openImage: 'Open image full screen',
      closeImage: 'Close full screen image',
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
      readiness: 'Optional challenge:',
      editStory: 'Edit story',
      waitingTitle: 'Feedback appears here',
      waitingText: 'Write your story and check your verbs to see coaching without leaving the scene.',
    },
    bank: { title: 'Select a practice scene' },
    mobileSettings: { label: 'Mobile lesson settings', toggle: 'Open feedback settings' },
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
      title: 'Cuenta una historia',
      subtitle: 'Entrenador de narración en pasado en inglés',
      scenePrompt: 'Mira la escena. Cuenta la historia en pasado.',
      language: 'Idioma del feedback',
      languageHelp: 'Siempre escribes en inglés. La retroalimentación puede mostrarse en otro idioma.',
      grammarFocus: 'Enfoque gramatical',
    },
    task: { title: 'Elige un nivel de dificultad', level: 'Nivel de reto' },
    challengeLabels: { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' },
    challengePrompts: {
      beginner: 'Escribe dos o tres oraciones en simple past sobre la escena.',
      intermediate: 'Usa when o while para conectar acciones en el pasado.',
      advanced: 'Añade lo que pasó antes usando had o had been.',
    },
    challengeSubprompts: {},
    beginnerPastHint: {
      kicker: 'Pista rápida',
      title: 'in the past',
      text: 'Describe lo que hizo la gente y lo que estaba pasando.',
    },
    connectorHint: {
      kicker: 'Pista rápida',
      title: 'when y while',
      when: {
        title: 'when',
        text: 'Usa when cuando una acción ocurre durante otra que ya estaba en progreso.',
      },
      while: {
        title: 'while',
        text: 'Usa while cuando dos acciones están ocurriendo al mismo tiempo.',
      },
    },
    pastPerfectHint: {
      kicker: 'Pista rápida',
      title: 'had y had been',
      had: {
        title: 'had',
        text: 'Una acción terminada antes.',
      },
      hadBeen: {
        title: 'had been',
        text: 'Una acción en progreso antes.',
      },
    },
    form: {
      label: 'Tu historia',
      submit: 'Revisar mi historia',
      checking: 'Revisando...',
      hint: 'Dame una pista',
      clear: 'Borrar',
      openImage: 'Abrir imagen en pantalla completa',
      closeImage: 'Cerrar imagen en pantalla completa',
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
      readiness: 'Desafío opcional:',
      editStory: 'Editar historia',
      waitingTitle: 'Aquí aparecerá la retroalimentación',
      waitingText: 'Escribe tu historia y revisa tus verbos para ver la ayuda sin salir de la escena.',
    },
    bank: { title: 'Selecciona una escena de práctica' },
    mobileSettings: { label: 'Ajustes móviles de la lección', toggle: 'Abrir ajustes de feedback' },
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
    hints: {
      beginner: {
        finishedAction: (verbForm) => `Busca una acción terminada. Puedes usar: ${verbForm}.`,
        finishedActionFallback: 'Busca una acción terminada y descríbela con simple past.',
        secondAction: (actor) => `Añade una segunda acción terminada. Mira: ${actor}.`,
        secondActionFallback: 'Añade una segunda oración en simple past con Then...',
        sceneAnchor: 'Nombra una persona u objeto visible de la escena y di qué pasó.',
      },
      intermediate: {
        backgroundAction: (verbForm) => `Empieza con la acción de fondo: ${verbForm}.`,
        backgroundActionFallback: 'Empieza con una acción que ya estaba en progreso.',
        eventAction: (actor) => `Conéctala con un evento repentino usando when. Mira: ${actor}.`,
        eventActionFallback: 'Conecta la acción de fondo con un evento repentino usando when.',
        pattern: 'Usa while para la acción de fondo y simple past para el evento repentino.',
      },
      advanced: {
        earlierPast: 'Busca una pista de algo que ocurrió antes. Usa had o had been.',
        earlierPastFallback: 'Añade un detalle anterior con had o had been.',
        connectors: 'Usa before o by the time para dejar clara la relación anterior.',
        selectiveDetail: 'No describas todo. Elige el detalle que cambia la línea de tiempo.',
      },
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
      title: 'Berätta en historia',
      subtitle: 'Tränare för engelsk berättelse i dåtid',
      scenePrompt: 'Titta på scenen. Berätta historien i dåtid.',
      language: 'Språk för feedback',
      languageHelp: 'Du skriver alltid på engelska. Feedbacken kan visas på ett annat språk.',
      grammarFocus: 'Grammatiskt fokus',
    },
    task: { title: 'Välj svårighetsgrad', level: 'Nivå' },
    challengeLabels: { beginner: 'Nybörjare', intermediate: 'Medel', advanced: 'Avancerad' },
    challengePrompts: {
      beginner: 'Skriv två eller tre meningar i simple past om scenen.',
      intermediate: 'Använd when eller while för att koppla handlingar i dåtid.',
      advanced: 'Lägg till vad som hände tidigare med had eller had been.',
    },
    challengeSubprompts: {},
    beginnerPastHint: {
      kicker: 'Snabb ledtråd',
      title: 'in the past',
      text: 'Beskriv vad människor gjorde och vad som pågick.',
    },
    connectorHint: {
      kicker: 'Snabb ledtråd',
      title: 'when och while',
      when: {
        title: 'when',
        text: 'Använd when när en handling händer under en annan som redan pågår.',
      },
      while: {
        title: 'while',
        text: 'Använd while när två handlingar händer samtidigt.',
      },
    },
    pastPerfectHint: {
      kicker: 'Snabb ledtråd',
      title: 'had och had been',
      had: {
        title: 'had',
        text: 'En avslutad handling tidigare.',
      },
      hadBeen: {
        title: 'had been',
        text: 'En pågående handling tidigare.',
      },
    },
    form: {
      label: 'Din historia',
      submit: 'Kolla min berättelse',
      checking: 'Kollar...',
      hint: 'Ge mig en ledtråd',
      clear: 'Rensa',
      openImage: 'Öppna bild i helskärm',
      closeImage: 'Stäng helskärmsbild',
      hintLabel: 'Ledtråd',
    },
    feedback: {
      verdict: 'Coachens kommentar',
      verdicts: {
        'keep-building': { label: 'Börja med tidslinjen', detail: 'Använd en tydlig handling i dåtid' },
        'good-start': { label: 'Bra start', detail: 'Förtydliga tidslinjen' },
        'good-work': { label: 'Bra jobbat', detail: 'Lite finslipning' },
        excellent: { label: 'Utmärkt', detail: 'Redo att gå vidare' },
      },
      worked: 'Detta fungerade',
      tryThis: 'Prova detta',
      betterVersion: 'Bättre version:',
      detected: 'Upptäckt',
      next: 'Nästa steg:',
      readiness: 'Valfri utmaning:',
      editStory: 'Redigera historien',
      waitingTitle: 'Feedbacken visas här',
      waitingText: 'Skriv din historia och kolla den för att se coachning utan att lämna scenen.',
    },
    bank: { title: 'Välj en övningsscen' },
    mobileSettings: { label: 'Mobilinställningar för övningen', toggle: 'Öppna feedbackinställningar' },
    sceneNav: {
      label: 'Scennavigering',
      previous: 'Föregående scen',
      next: 'Nästa scen',
    },
    starters: { label: 'Användbara berättelsestarter' },
    errors: {
      tooShort: 'Skriv minst en hel mening så att coachen kan se relationen mellan verben.',
      checkFailed: 'Coachen kunde inte kolla svaret ännu.',
    },
    hints: {
      beginner: {
        finishedAction: (verbForm) => `Leta efter en avslutad handling. Du kan använda: ${verbForm}.`,
        finishedActionFallback: 'Leta efter en avslutad handling och beskriv den med simple past.',
        secondAction: (actor) => `Lägg till en andra avslutad handling. Titta på: ${actor}.`,
        secondActionFallback: 'Lägg till en andra mening i simple past med Then...',
        sceneAnchor: 'Nämn en synlig person eller sak i scenen och säg vad som hände.',
      },
      intermediate: {
        backgroundAction: (verbForm) => `Börja med bakgrundshandlingen: ${verbForm}.`,
        backgroundActionFallback: 'Börja med en handling som redan pågick.',
        eventAction: (actor) => `Koppla den till en plötslig händelse med when. Titta på: ${actor}.`,
        eventActionFallback: 'Koppla bakgrundshandlingen till en plötslig händelse med when.',
        pattern: 'Använd while för bakgrundshandlingen och simple past för den plötsliga händelsen.',
      },
      advanced: {
        earlierPast: 'Hitta en ledtråd om något som hände tidigare. Använd had eller had been.',
        earlierPastFallback: 'Lägg till en tidigare detalj med had eller had been.',
        connectors: 'Använd before eller by the time för att göra den tidigare relationen tydlig.',
        selectiveDetail: 'Beskriv inte allt. Välj den detalj som förändrar tidslinjen.',
      },
    },
    grammar: {
      open: 'Öppna grammatikguiden',
      close: 'Stäng',
      kicker: 'Grammatikguide',
      title: 'Verb för berättande i dåtid',
      items: [
        {
          title: 'Simple Past',
          text: 'Används för avslutade händelser som driver berättelsen framåt.',
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
          text: 'Används för en tidigare handling som hade pågått en stund.',
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
