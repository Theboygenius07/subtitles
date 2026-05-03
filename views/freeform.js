import { cloudinaryUrl } from '../utils.js'
import { gsap } from 'gsap'

const TILES = 3   // 3×3 seamless tile copies

export function initFreeform(container, photos) {
  // Grid constants — tighter on mobile
  const isMobile = window.innerWidth < 768
  const CARD_W = isMobile ? 220 : 280
  const CARD_H = Math.round(CARD_W * 9 / 16)
  const GAP    = isMobile ? 70  : 200
  const SLOT_W = CARD_W + GAP
  const SLOT_H = CARD_H + GAP
  const COLS   = 7
  container.innerHTML = ''
  container.classList.add('ff-view')

  // Shuffle display order (Fisher-Yates) without mutating original array
  const shuffled = [...photos]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const ROWS   = Math.ceil(shuffled.length / COLS)
  const GRID_W = COLS * SLOT_W
  const GRID_H = ROWS * SLOT_H

  // ── Canvas ───────────────────────────────────────────────
  const canvas = document.createElement('div')
  canvas.className = 'ff-canvas'
  canvas.style.width  = TILES * GRID_W + 'px'
  canvas.style.height = TILES * GRID_H + 'px'
  container.appendChild(canvas)

  // ── Cards (3×3 tile copies) ───────────────────────────────
  const allCards = []

  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      shuffled.forEach((photo, i) => {
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const x   = tx * GRID_W + col * SLOT_W
        const y   = ty * GRID_H + row * SLOT_H

        const card = document.createElement('div')
        card.className = 'ff-card'
        card.style.cssText =
          `left:${x}px;top:${y}px;width:${CARD_W}px;height:${CARD_H}px`

        const img = document.createElement('img')
        img.className  = 'ff-img'
        img.alt        = `Week ${photo.week}`
        img.draggable  = false
        img.dataset.src = cloudinaryUrl(photo.cloudinary_url, CARD_W)
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true })

        card.appendChild(img)
        canvas.appendChild(card)
        allCards.push({ card, photo, i })
      })
    }
  }

  // ── Pan state ─────────────────────────────────────────────
  const vw = () => container.clientWidth
  const vh = () => container.clientHeight

  // Will be set on first rAF once container has real dimensions
  let panX = 0
  let panY = 0

  let velX = 0, velY = 0
  let isPanning = false
  let startX = 0, startY = 0
  let startPanX = 0, startPanY = 0
  let lastX = 0, lastY = 0, lastT = 0
  let didMove = false
  let rafId = null
  let focusActive = false

  // Teleport seamlessly when we drift into an outer tile
  function normalize() {
    const cx = vw() / 2
    const cy = vh() / 2
    while (panX > cx - 0.5 * GRID_W) panX -= GRID_W
    while (panX < cx - 2.5 * GRID_W) panX += GRID_W
    while (panY > cy - 0.5 * GRID_H) panY -= GRID_H
    while (panY < cy - 2.5 * GRID_H) panY += GRID_H
  }

  function apply() {
    normalize()
    canvas.style.transform = `translate(${Math.round(panX)}px,${Math.round(panY)}px)`
  }

  function cancelMomentum() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    velX = 0; velY = 0
  }

  function momentum() {
    velX *= 0.93
    velY *= 0.93
    panX += velX
    panY += velY
    apply()
    if (Math.abs(velX) < 0.1 && Math.abs(velY) < 0.1) { rafId = null; return }
    rafId = requestAnimationFrame(momentum)
  }

  // ── Mouse ─────────────────────────────────────────────────
  container.addEventListener('mousedown', e => {
    cancelMomentum()
    isPanning  = true
    didMove    = false
    startX     = e.clientX; startY = e.clientY
    startPanX  = panX;      startPanY = panY
    lastX      = e.clientX; lastY = e.clientY; lastT = Date.now()
    container.style.cursor = 'grabbing'
    e.preventDefault()
  })

  window.addEventListener('mousemove', e => {
    if (!isPanning) return
    const now = Date.now()
    const dt  = Math.max(1, now - lastT)
    velX = (e.clientX - lastX) / dt * 14
    velY = (e.clientY - lastY) / dt * 14
    lastX = e.clientX; lastY = e.clientY; lastT = now
    panX  = startPanX + (e.clientX - startX)
    panY  = startPanY + (e.clientY - startY)
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) didMove = true
    apply()
  })

  window.addEventListener('mouseup', () => {
    if (!isPanning) return
    isPanning = false
    container.style.cursor = 'grab'
    if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
      rafId = requestAnimationFrame(momentum)
    }
  })

  // ── Touch ─────────────────────────────────────────────────
  let touch0 = null

  container.addEventListener('touchstart', e => {
    cancelMomentum()
    didMove = false
    if (e.touches.length === 1) {
      touch0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX, panY }
      lastX  = touch0.x; lastY = touch0.y; lastT = Date.now()
    }
  }, { passive: true })

  container.addEventListener('touchmove', e => {
    e.preventDefault()
    if (e.touches.length === 1 && touch0) {
      const now = Date.now()
      const dt  = Math.max(1, now - lastT)
      const dx  = e.touches[0].clientX - lastX
      const dy  = e.touches[0].clientY - lastY
      velX = dx / dt * 14; velY = dy / dt * 14
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; lastT = now
      panX  = touch0.panX + (e.touches[0].clientX - touch0.x)
      panY  = touch0.panY + (e.touches[0].clientY - touch0.y)
      if (Math.abs(panX - touch0.panX) > 4 || Math.abs(panY - touch0.panY) > 4) didMove = true
      apply()
    }
  }, { passive: false })

  container.addEventListener('touchend', () => {
    touch0 = null
    if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
      rafId = requestAnimationFrame(momentum)
    }
  })

  // ── Wheel / trackpad scroll ───────────────────────────────
  let wheelEnd = null
  container.addEventListener('wheel', e => {
    e.preventDefault()
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    panX -= e.deltaX
    panY -= e.deltaY
    velX = -e.deltaX * 0.6
    velY = -e.deltaY * 0.6
    apply()
    clearTimeout(wheelEnd)
    wheelEnd = setTimeout(() => {
      rafId = requestAnimationFrame(momentum)
    }, 80)
  }, { passive: false })

  // ── Focus overlay ─────────────────────────────────────────
  function openFocus(photo, srcEl) {
    if (focusActive) return
    focusActive = true
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

    const src  = srcEl.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight
    // Fit 16:9 card within 90% viewport width AND 80% viewport height
    let finalW = Math.round(vw * 0.90)
    let finalH = Math.round(finalW * 9 / 16)
    if (finalH > vh * 0.80) { finalH = Math.round(vh * 0.80); finalW = Math.round(finalH * 16 / 9) }
    const finalL = Math.round((vw - finalW) / 2)
    const finalT = Math.round((vh - finalH) / 2)

    // ── DOM ───────────────────────────────────────────────────
    const overlay = document.createElement('div')
    overlay.className = 'ff-focus-overlay'

    const card = document.createElement('div')
    card.className = 'ff-focus-card'

    const img = document.createElement('img')
    img.className = 'ff-focus-img'
    img.src = cloudinaryUrl(photo.cloudinary_url, 1600)
    img.alt = `Week ${photo.week}`

    const dlBtn = document.createElement('button')
    dlBtn.className = 'ff-focus-dl'
    dlBtn.setAttribute('aria-label', 'Download')
    dlBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8m0 0-3-3m3 3 3-3M2 12.5v.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
    dlBtn.addEventListener('click', async e => {
      e.stopPropagation()
      const res  = await fetch(photo.cloudinary_url)
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `week-${String(photo.week).padStart(2, '0')}.jpg`
      a.click()
    })

    card.appendChild(img)
    card.appendChild(dlBtn)
    overlay.appendChild(card)

    // ── GSAP initial state ────────────────────────────────────
    gsap.set(overlay, { backgroundColor: 'rgba(0,0,0,0)' })
    gsap.set(card, {
      position: 'absolute',
      left: src.left, top: src.top,
      width: src.width, height: src.height,
      borderRadius: 3,
      transformPerspective: 1100,
      rotationX: 0, rotationY: 0,
      boxShadow: '0 0px 0px rgba(0,0,0,0)'
    })
    gsap.set(dlBtn, { opacity: 0 })

    document.body.appendChild(overlay)
    overlay.classList.add('ff-focus-overlay--open')

    gsap.to(overlay, { backgroundColor: 'rgba(0,0,0,0.65)', duration: 0.55, ease: 'power2.out' })
    gsap.to(card, {
      left: finalL, top: finalT,
      width: finalW, height: finalH,
      borderRadius: 22,
      rotationX: 5,
      boxShadow: '0 70px 140px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.18)',
      duration: 0.7, ease: 'expo.inOut'
    })
    gsap.to(dlBtn, { opacity: 1, duration: 0.2, delay: 0.55 })

    // ── Tilt state ────────────────────────────────────────────
    let cursorDx = 0, cursorDy = 0
    let handDx   = 0, handDy   = 0
    let handActive = false

    function applyTilt() {
      const dx = handActive ? cursorDx * 0.5 + handDx * 0.5 : cursorDx
      const dy = handActive ? cursorDy * 0.5 + handDy * 0.5 : cursorDy
      gsap.to(card, {
        rotationX: 5 - dy * 10,
        rotationY: dx * 9,
        duration: handActive ? 0.12 : 0.4,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    }

    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect()
      cursorDx = ((e.clientX - r.left) / r.width  - 0.5) * 2
      cursorDy = ((e.clientY - r.top)  / r.height - 0.5) * 2
      applyTilt()
    })
    card.addEventListener('mouseleave', () => {
      cursorDx = 0; cursorDy = 0
      if (!handActive) {
        gsap.to(card, { rotationX: 5, rotationY: 0, duration: 0.8, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' })
      }
    })

    // ── Global tracker tilt ───────────────────────────────────
    // Use raw position for tilt — direct 1:1 mapping
    // Pinch-to-close requires 500ms hold to avoid accidental triggers
    let pinchCloseTimer = null
    function onHandTilt({ detail }) {
      handActive = detail.active
      if (detail.active) {
        handDx = clamp((detail.rawX - 0.5) * 2.5, -1, 1)
        handDy = clamp((detail.rawY - 0.5) * 2.5, -1, 1)
        applyTilt()
      }
      if (detail.pinch && !pinchCloseTimer) {
        pinchCloseTimer = setTimeout(() => { close() }, 1000)
      }
      if (!detail.pinch && pinchCloseTimer) {
        clearTimeout(pinchCloseTimer)
        pinchCloseTimer = null
      }
    }
    document.addEventListener('hand:move', onHandTilt)

    // ── Close ─────────────────────────────────────────────────
    function close() {
      clearTimeout(pinchCloseTimer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('hand:move', onHandTilt)
      overlay.classList.remove('ff-focus-overlay--open')
      const dest = srcEl.getBoundingClientRect()
      gsap.to([dlBtn], { opacity: 0, duration: 0.12 })
      gsap.to(overlay, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.45, ease: 'power2.in' })
      gsap.to(card, {
        left: dest.left, top: dest.top,
        width: dest.width, height: dest.height,
        borderRadius: 3,
        rotationX: 0, rotationY: 0,
        boxShadow: '0 0px 0px rgba(0,0,0,0)',
        duration: 0.55, ease: 'expo.inOut', overwrite: 'auto',
        onComplete: () => { overlay.remove(); focusActive = false }
      })
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close() })
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
  }

  // ── Click (only fires if user didn't pan) ──────────────────
  container.addEventListener('click', e => {
    if (didMove || focusActive) return
    const cardEl = e.target.closest('.ff-card')
    if (!cardEl) return
    const cardX = (parseInt(cardEl.style.left) % GRID_W + GRID_W) % GRID_W
    const cardY = (parseInt(cardEl.style.top)  % GRID_H + GRID_H) % GRID_H
    const col   = Math.round(cardX / SLOT_W)
    const row   = Math.round(cardY / SLOT_H)
    const idx   = row * COLS + col
    if (idx >= 0 && idx < shuffled.length) openFocus(shuffled[idx], cardEl)
  })

  // ── Lazy load ─────────────────────────────────────────────
  const lazyObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target
        if (img.dataset.src) {
          img.src = img.dataset.src
          img.removeAttribute('data-src')
        }
        lazyObs.unobserve(img)
      }
    })
  }, { root: container, rootMargin: '300px' })

  allCards.forEach(({ card }) => lazyObs.observe(card.querySelector('img')))

  // ── Resize ────────────────────────────────────────────────
  function onResize() {
    cancelMomentum()
    panX = vw() / 2 - GRID_W * 1.5
    panY = vh() / 2 - GRID_H * 1.5
    apply()
  }
  window.addEventListener('resize', onResize)

  // ── Hand cursor (visual indicator with lerp loop) ────────
  const handCursor = document.createElement('div')
  handCursor.className = 'ff-hand-cursor'
  container.appendChild(handCursor)

  let cursorTargetX = 0, cursorTargetY = 0
  let cursorX = 0, cursorY = 0
  let cursorVisible = false
  let cursorRaf = null

  function cursorLoop() {
    cursorX += (cursorTargetX - cursorX) * 0.28
    cursorY += (cursorTargetY - cursorY) * 0.28
    handCursor.style.transform = `translate(${cursorX | 0}px,${cursorY | 0}px)`
    cursorRaf = requestAnimationFrame(cursorLoop)
  }
  cursorRaf = requestAnimationFrame(cursorLoop)

  // ── Hand gestures: pinch=click, hold=grab, open=release ───
  let handGrabbing   = false
  let pinchOpenTimer = null
  let maxPinchMoved  = 0
  let pinchStartRawX = 0, pinchStartRawY = 0
  let pinchStartPanX = 0, pinchStartPanY = 0
  let lastRawX = 0, lastRawY = 0, lastHandT = 0

  function onHandGesture({ detail }) {
    if (!container.classList.contains('active')) return

    // Feed cursor target (lerp loop handles smoothing)
    if (detail.active) {
      cursorTargetX = detail.rawX * window.innerWidth  - 18
      cursorTargetY = detail.rawY * window.innerHeight - 18
      if (!cursorVisible) {
        cursorVisible = true
        cursorX = cursorTargetX; cursorY = cursorTargetY
        handCursor.style.opacity = '1'
      }
      handCursor.classList.toggle('ff-hand-cursor--grab', detail.pinch)
    } else if (cursorVisible) {
      cursorVisible = false
      handCursor.style.opacity = '0'
    }

    const now = Date.now()

    // Pinch start → record start state + launch 1s open timer
    if (detail.pinchStart && !handGrabbing) {
      handGrabbing   = true
      maxPinchMoved  = 0
      pinchStartRawX = detail.rawX
      pinchStartRawY = detail.rawY
      pinchStartPanX = panX
      pinchStartPanY = panY
      lastRawX = detail.rawX; lastRawY = detail.rawY; lastHandT = now
      cancelMomentum()

      pinchOpenTimer = setTimeout(() => {
        pinchOpenTimer = null
        // Only open if hand stayed roughly still (< 60px total travel)
        if (maxPinchMoved < 60) {
          const cx = lastRawX * window.innerWidth
          const cy = lastRawY * window.innerHeight
          const el = document.elementFromPoint(cx, cy)
          const cardEl = el?.closest('.ff-card')
          if (cardEl) {
            const cardX = (parseInt(cardEl.style.left) % GRID_W + GRID_W) % GRID_W
            const cardY = (parseInt(cardEl.style.top)  % GRID_H + GRID_H) % GRID_H
            const col   = Math.round(cardX / SLOT_W)
            const row   = Math.round(cardY / SLOT_H)
            const idx   = row * COLS + col
            if (idx >= 0 && idx < shuffled.length) openFocus(shuffled[idx], cardEl)
          }
        }
      }, 1000)
    }

    // Holding pinch → drag canvas + track max movement
    if (handGrabbing && detail.pinch && detail.active) {
      const movedNow = Math.hypot(
        (detail.rawX - pinchStartRawX) * window.innerWidth,
        (detail.rawY - pinchStartRawY) * window.innerHeight
      )
      maxPinchMoved = Math.max(maxPinchMoved, movedNow)

      const dt = Math.max(1, now - lastHandT)
      velX = (detail.rawX - lastRawX) * window.innerWidth  / dt * 14
      velY = (detail.rawY - lastRawY) * window.innerHeight / dt * 14
      lastRawX = detail.rawX; lastRawY = detail.rawY; lastHandT = now
      panX = pinchStartPanX + (detail.rawX - pinchStartRawX) * window.innerWidth
      panY = pinchStartPanY + (detail.rawY - pinchStartRawY) * window.innerHeight
      apply()
    }

    // Open hand → release, cancel open timer
    if (handGrabbing && !detail.pinch) {
      handGrabbing = false
      if (pinchOpenTimer) { clearTimeout(pinchOpenTimer); pinchOpenTimer = null }
      if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
        rafId = requestAnimationFrame(momentum)
      }
    }
  }
  document.addEventListener('hand:move', onHandGesture)

  // ── Cleanup ───────────────────────────────────────────────
  container._cleanup = () => {
    window.removeEventListener('resize', onResize)
    document.removeEventListener('hand:move', onHandGesture)
    if (cursorRaf) cancelAnimationFrame(cursorRaf)
    cancelMomentum()
    lazyObs.disconnect()
  }

  container.style.cursor = 'grab'
  requestAnimationFrame(() => {
    panX = vw() / 2 - GRID_W * 1.5
    panY = vh() / 2 - GRID_H * 1.5
    apply()
  })
}
