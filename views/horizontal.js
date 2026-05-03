import { cloudinaryUrl } from '../utils.js'

export function initHorizontal(container, photos) {
  container.innerHTML = ''
  container.classList.add('hz-view')

  const stage = document.createElement('div')
  stage.className = 'hz-stage'
  const track = document.createElement('div')
  track.className = 'hz-track'
  stage.appendChild(track)
  container.appendChild(stage)

  // Edge fades
  const fadeL = document.createElement('div'); fadeL.className = 'hz-fade hz-fade-left'
  const fadeR = document.createElement('div'); fadeR.className = 'hz-fade hz-fade-right'
  container.append(fadeL, fadeR)

  // Ticker
  const tickerEl = document.createElement('div')
  tickerEl.className = 'hz-ticker'
  container.appendChild(tickerEl)

  // ── Animation state ───────────────────────────────────────
  // Wheel phase  → lerp toward rawTarget (smooth, Lenis-like)
  // Idle phase   → spring snap to nearest integer (snappy)
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
    card.className = 'hz-card'

    const img = document.createElement('img')
    img.className = 'hz-img'
    img.alt = `Week ${photo.week}`
    img.draggable = false
    img.addEventListener('load', () => img.classList.add('loaded'))

    card._img    = img
    card._loaded = false
    card._hiRes  = false
    card.appendChild(img)
    track.appendChild(card)
    cards.push(card)

    // Click: navigate to card (auto-scroll to focus)
    card.addEventListener('click', () => navigate(i))

    const tickEl = document.createElement('div')
    tickEl.className = 'hz-tick'
    tickerEl.appendChild(tickEl)
    tickEls.push(tickEl)
  })

  // ── Animation loop ────────────────────────────────────────
  function tick() {
    let done = false

    if (isWheeling) {
      lerpPos += (rawTarget - lerpPos) * 0.15   // snappier lerp
      done = Math.abs(rawTarget - lerpPos) < 0.0005
    } else {
      const dx = snapIndex - lerpPos
      vel += (dx * 240 - vel * 30) / 60         // snappier spring
      lerpPos += vel / 60
      done = Math.abs(dx) < 0.0005 && Math.abs(vel) < 0.0005
      if (done) { lerpPos = snapIndex; vel = 0 }
    }

    render()
    if (done) { raf = null; return }
    raf = requestAnimationFrame(tick)
  }

  // ── Navigate (keyboard / touch / click) ───────────────────
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
    const sh = stage.clientHeight

    const ACTIVE_W = Math.min(960, Math.round(vw * 0.70))
    const INACT_W  = Math.min(480, Math.round(vw * 0.35))
    const SLOT     = Math.round((ACTIVE_W + INACT_W) / 2 + 24)

    const activeIdx = Math.round(lerpPos)

    cards.forEach((card, i) => {
      const dist = Math.abs(i - lerpPos)
      if (dist > 4) { card.style.visibility = 'hidden'; return }
      card.style.visibility = 'visible'

      const t = Math.max(0, 1 - dist)
      const w = Math.round(INACT_W + (ACTIVE_W - INACT_W) * t)
      const h = Math.round(w * 9 / 16)

      // Center active card at exact viewport center
      const x = Math.round(vw / 2 + (i - lerpPos) * SLOT - w / 2)
      const y = Math.round((sh - h) / 2)

      card.style.transform = `translate(${x}px,${y}px)`
      card.style.width   = w + 'px'
      card.style.height  = h + 'px'
      card.style.zIndex  = Math.round(50 - dist * 10)
      card.style.opacity = dist > 3.5 ? '0' : dist > 2.5 ? '0.5' : '1'

      // Active class drives the CSS grayscale→color transition
      card.classList.toggle('hz-card--active', i === activeIdx)

      const img = card._img
      if (!card._loaded && dist <= 3) {
        img.src = cloudinaryUrl(photos[i].cloudinary_url, INACT_W)
        card._loaded = true
      }
      if (!card._hiRes && dist < 0.5) {
        img.src = cloudinaryUrl(photos[i].cloudinary_url, ACTIVE_W)
        card._hiRes = true
      }
    })

    // Ticker — bell-curve: 4 neighbours scale up smoothly with lerpPos
    tickEls.forEach((el, i) => {
      const dist   = Math.abs(i - lerpPos)
      const SPREAD = 4.5
      const t      = Math.max(0, 1 - dist / SPREAD)
      const h      = 21.5 + (68.8 - 21.5) * t * t
      el.style.height     = h.toFixed(2) + 'px'
      el.style.opacity    = dist < 0.5 ? '1' : (0.22 + 0.56 * t * t).toFixed(3)
      el.style.background = dist < 0.5 ? 'var(--tick-active)' : 'var(--tick-inactive)'
    })
  }

  // ── Keyboard ──────────────────────────────────────────────
  function onKey(e) {
    if (!container.classList.contains('active')) return
    if (e.key === 'ArrowRight') navigate(snapIndex + 1)
    else if (e.key === 'ArrowLeft') navigate(snapIndex - 1)
  }
  document.addEventListener('keydown', onKey)

  // ── Touch / swipe ─────────────────────────────────────────
  let tx0 = 0
  container.addEventListener('touchstart', e => {
    tx0 = e.touches[0].clientX
    vel = 0; isWheeling = false
  }, { passive: true })
  container.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx0
    if (Math.abs(dx) > 30) navigate(snapIndex + (dx < 0 ? 1 : -1))
  }, { passive: true })

  // ── Wheel (Lenis-like) ────────────────────────────────────
  container.addEventListener('wheel', e => {
    e.preventDefault()
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
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

  // ── Hand tracking ─────────────────────────────────────────
  function onHandMove({ detail }) {
    if (!container.classList.contains('active')) return
    if (!detail.active) return
    if (Math.abs(detail.joyX) < 0.04) return
    rawTarget = Math.max(0, Math.min(photos.length - 1, rawTarget + detail.joyX * 0.20))
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
    if (raf) cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
  }

  function onResize() {
    cards.forEach(c => { c._hiRes = false })
    render()
  }
  window.addEventListener('resize', onResize)

  render()
}
