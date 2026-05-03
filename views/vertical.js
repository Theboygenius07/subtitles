import { cloudinaryUrl } from '../utils.js'

export function initVertical(container, photos) {
  container.innerHTML = ''
  container.classList.add('vt-view')

  // ── Ticker (fixed left) ───────────────────────────────────
  const tickerEl = document.createElement('div')
  tickerEl.className = 'vt-ticker'
  container.appendChild(tickerEl)

  // ── Image stage (absolute, full area) ─────────────────────
  const stage = document.createElement('div')
  stage.className = 'vt-stage'
  const track = document.createElement('div')
  track.className = 'vt-track'
  stage.appendChild(track)
  container.appendChild(stage)

  // ── Animation state ───────────────────────────────────────
  let lerpPos    = 0
  let rawTarget  = 0
  let snapIndex  = 0
  let vel        = 0
  let isWheeling = false
  let wheelEnd   = null
  let raf        = null

  const cards   = []
  const tickEls = []

  photos.forEach((photo, i) => {
    const card = document.createElement('div')
    card.className = 'vt-card'

    const img = document.createElement('img')
    img.className = 'vt-img'
    img.alt = `Week ${photo.week}`
    img.draggable = false
    img.addEventListener('load', () => img.classList.add('loaded'))

    card._img    = img
    card._loaded = false
    card._hiRes  = false
    card.appendChild(img)
    track.appendChild(card)
    cards.push(card)

    card.addEventListener('click', () => navigate(i))

    const tickEl = document.createElement('div')
    tickEl.className = 'vt-tick'
    tickerEl.appendChild(tickEl)
    tickEls.push(tickEl)
  })

  // ── Animation loop ────────────────────────────────────────
  function tick() {
    let done = false

    if (isWheeling) {
      lerpPos += (rawTarget - lerpPos) * 0.15
      done = Math.abs(rawTarget - lerpPos) < 0.0005
    } else {
      const dx = snapIndex - lerpPos
      vel += (dx * 240 - vel * 30) / 60
      lerpPos += vel / 60
      done = Math.abs(dx) < 0.0005 && Math.abs(vel) < 0.0005
      if (done) { lerpPos = snapIndex; vel = 0 }
    }

    render()
    if (done) { raf = null; return }
    raf = requestAnimationFrame(tick)
  }

  // ── Navigate ──────────────────────────────────────────────
  function navigate(idx) {
    const next = Math.max(0, Math.min(photos.length - 1, idx))
    if (next === snapIndex && !isWheeling) return
    snapIndex  = next
    rawTarget  = next
    isWheeling = false
    vel        = 0
    if (!raf) raf = requestAnimationFrame(tick)
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const vw = container.clientWidth
    const vh = container.clientHeight

    // On mobile: center in full width. On desktop: offset right of ticker column.
    const imgLeft = vw < 600 ? 20 : 410   // 410 = TICKER_AREA(110) + COLUMN_GAP(300)
    const availW  = vw - imgLeft - (vw < 600 ? 20 : 0)

    // Mobile: width-first sizing so cards never exceed availW.
    // Desktop: height-first so cards fill the vertical viewport nicely.
    let ACTIVE_H, INACT_H
    if (vw < 600) {
      ACTIVE_H = Math.round(availW * 9 / 16)
      INACT_H  = Math.round(availW * 0.65 * 9 / 16)
    } else {
      ACTIVE_H = Math.round(vh * 0.56)
      INACT_H  = Math.round(vh * 0.30)
    }
    const SLOT = Math.round((ACTIVE_H + INACT_H) / 2 + 20)

    const activeIdx = Math.round(lerpPos)

    cards.forEach((card, i) => {
      const dist = Math.abs(i - lerpPos)
      if (dist > 4) { card.style.visibility = 'hidden'; return }
      card.style.visibility = 'visible'

      const t = Math.max(0, 1 - dist)
      const h = Math.round(INACT_H + (ACTIVE_H - INACT_H) * t)
      const w = Math.round(h * 16 / 9)

      // Center horizontally within the available column
      const x = Math.round(imgLeft + (availW - w) / 2)
      const y = Math.round(vh / 2 + (i - lerpPos) * SLOT - h / 2)

      card.style.transform = `translate(${x}px,${y}px)`
      card.style.width     = w + 'px'
      card.style.height    = h + 'px'
      card.style.zIndex    = Math.round(50 - dist * 10)
      card.style.opacity   = dist > 3.5 ? '0' : dist > 2.5 ? '0.5' : '1'

      card.classList.toggle('vt-card--active', i === activeIdx)

      const img = card._img
      if (!card._loaded && dist <= 3) {
        img.src = cloudinaryUrl(photos[i].cloudinary_url, Math.round(INACT_H * 16 / 9))
        card._loaded = true
      }
      if (!card._hiRes && dist < 0.5) {
        img.src = cloudinaryUrl(photos[i].cloudinary_url, w)
        card._hiRes = true
      }
    })

    // Ticker — same bell-curve as horizontal but width varies (not height)
    tickEls.forEach((el, i) => {
      const dist   = Math.abs(i - lerpPos)
      const SPREAD = 4.5
      const t      = Math.max(0, 1 - dist / SPREAD)
      const w      = 21.5 + (68.8 - 21.5) * t * t
      el.style.width      = w.toFixed(2) + 'px'
      el.style.opacity    = dist < 0.5 ? '1' : (0.22 + 0.56 * t * t).toFixed(3)
      el.style.background = dist < 0.5 ? 'var(--tick-active)' : 'var(--tick-inactive)'
    })
  }

  // ── Keyboard ──────────────────────────────────────────────
  function onKey(e) {
    if (!container.classList.contains('active')) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') navigate(snapIndex + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') navigate(snapIndex - 1)
  }
  document.addEventListener('keydown', onKey)

  // ── Touch / swipe ─────────────────────────────────────────
  let ty0 = 0
  container.addEventListener('touchstart', e => {
    ty0 = e.touches[0].clientY
    vel = 0; isWheeling = false
  }, { passive: true })
  container.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - ty0
    if (Math.abs(dy) > 30) navigate(snapIndex + (dy < 0 ? 1 : -1))
  }, { passive: true })

  // ── Wheel ─────────────────────────────────────────────────
  container.addEventListener('wheel', e => {
    e.preventDefault()
    const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    rawTarget = Math.max(0, Math.min(photos.length - 1, rawTarget + d * 0.005))

    const newSnap = Math.round(rawTarget)
    if (newSnap !== snapIndex) snapIndex = newSnap

    isWheeling = true
    clearTimeout(wheelEnd)
    wheelEnd = setTimeout(() => {
      rawTarget  = snapIndex
      isWheeling = false
    }, 150)

    if (!raf) raf = requestAnimationFrame(tick)
  }, { passive: false })

  // ── Resize ────────────────────────────────────────────────
  function onResize() {
    cards.forEach(c => { c._hiRes = false })
    render()
  }
  window.addEventListener('resize', onResize)

  // ── Hand tracking ─────────────────────────────────────────
  function onHandMove({ detail }) {
    if (!container.classList.contains('active')) return
    if (!detail.active) return
    if (Math.abs(detail.joyY) < 0.04) return
    rawTarget = Math.max(0, Math.min(photos.length - 1, rawTarget + detail.joyY * 0.20))
    const newSnap = Math.round(rawTarget)
    if (newSnap !== snapIndex) snapIndex = newSnap
    isWheeling = true
    clearTimeout(wheelEnd)
    wheelEnd = setTimeout(() => { rawTarget = snapIndex; isWheeling = false }, 150)
    if (!raf) raf = requestAnimationFrame(tick)
  }
  document.addEventListener('hand:move', onHandMove)

  // ── Cleanup ───────────────────────────────────────────────
  container._cleanup = () => {
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('hand:move', onHandMove)
    window.removeEventListener('resize', onResize)
    if (raf) cancelAnimationFrame(raf)
  }

  render()
}
