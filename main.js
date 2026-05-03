import { initHorizontal } from './views/horizontal.js'
import { initVertical }   from './views/vertical.js'
import { initFreeform }   from './views/freeform.js'
import { initGlobe }      from './views/globe.js'
import { initGallery }    from './views/gallery.js'
import { initModal }      from './components/modal.js'
import { tracker, preloadVision } from './components/tracking.js'
import gsap from 'gsap'

// ─── Data ─────────────────────────────────────────────────

let photoData = []

async function loadData() {
  const res = await fetch('data.json')
  const raw = await res.json()
  photoData = raw.slice().sort((a, b) => a.week - b.week)
}

// ─── Theme ────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark'
  document.documentElement.dataset.theme = saved

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('theme', next)
  })
}

// ─── View switching ───────────────────────────────────────

const viewInitialised = new Set()
const viewLoaders = {
  horizontal: initHorizontal,
  vertical:   initVertical,
  freeform:   initFreeform,
  globe:      initGlobe,
  gallery:    initGallery,
}

let activeView = null

async function activateView(name) {
  if (name === activeView) return

  document.querySelectorAll('.cp-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name)
  })

  // Fade out previous
  if (activeView) {
    const prev = document.getElementById(`view-${activeView}`)
    prev.style.transition = 'opacity 0.1s ease'
    prev.style.opacity = '0'
    await new Promise(r => setTimeout(r, 100))
    prev.style.transition = ''
    prev.classList.remove('active')
    if (prev._cleanup) { viewInitialised.delete(activeView); prev._cleanup() }
  }

  activeView = name
  const container = document.getElementById(`view-${name}`)
  container.style.opacity = '0'
  container.classList.add('active')

  if (!viewInitialised.has(name)) {
    viewInitialised.add(name)
    viewLoaders[name](container, photoData)
  }

  // Double rAF ensures layout is computed before fading in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    container.style.transition = 'opacity 0.2s ease'
    container.style.opacity = '1'
    setTimeout(() => {
      container.style.transition = ''
      container.style.opacity = ''
    }, 200)
  }))
}

// ─── Background image toggle ──────────────────────────────

function initBgToggle() {
  const btn = document.getElementById('bgToggle')
  let active = false

  btn.addEventListener('click', () => {
    active = !active
    document.body.classList.toggle('has-bg-image', active)
    btn.classList.toggle('active', active)
  })
}

// ─── Hand tracking toggle ─────────────────────────────────

function initTrackToggle() {
  const btn      = document.getElementById('trackToggle')
  const camWrap  = document.getElementById('cam-preview')
  let   loading  = false

  btn.addEventListener('click', async () => {
    if (loading) return

    if (tracker.active) {
      tracker.stop()
      btn.classList.remove('active', 'cp-track--loading')
      camWrap.classList.remove('cam-preview--active')
      return
    }

    loading = true
    btn.classList.add('cp-track--loading')

    const ok = await tracker.start(camWrap)
    loading  = false
    btn.classList.remove('cp-track--loading')

    if (ok) {
      btn.classList.add('active')
      camWrap.classList.add('cam-preview--active')
    }
  })
}

// ─── About popup ──────────────────────────────────────────

function initAbout() {
  const btn = document.querySelector('.nav-info-btn')
  let isOpen = false

  btn.addEventListener('click', () => {
    if (isOpen) return
    isOpen = true

    const src = btn.getBoundingClientRect()

    const backdrop = document.createElement('div')
    backdrop.className = 'about-backdrop'

    const popup = document.createElement('div')
    popup.className = 'about-popup'
    popup.innerHTML = `
      <div class="about-specular"></div>
      <div class="about-inner">
        <div class="about-header">
          <span class="about-eyebrow">Subtitles</span>
          <button class="about-close" aria-label="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <p class="about-quote">a collection of conversations i've had or overheard over the past year.</p>
        <div class="about-rule"></div>
        <div class="about-tracking">
          <p class="about-tracking-label">Hand Tracking</p>
          <div class="about-gesture-list">
            <div class="about-gesture"><span>Scroll</span><span>Move hand left · right</span></div>
            <div class="about-gesture"><span>Open</span><span>Pinch + hold still over a photo</span></div>
            <div class="about-gesture"><span>Close</span><span>Pinch + hold to dismiss a card</span></div>
            <div class="about-gesture"><span>Depth</span><span>Push · pull toward camera on globe</span></div>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(backdrop)
    document.body.appendChild(popup)

    // Position popup top-right, aligned with the info button
    const W = Math.min(340, window.innerWidth - 48)
    const RIGHT_PAD = window.innerWidth - src.right   // align right edge with button
    gsap.set(popup, { position: 'fixed', width: W, right: RIGHT_PAD, top: -9999 })
    const H = popup.offsetHeight
    const finalTop = src.bottom + 12

    // Clip-path origin: button center in popup-local space
    const popupLeft = window.innerWidth - RIGHT_PAD - W
    const ox = ((src.left + src.width  / 2 - popupLeft) / W  * 100).toFixed(2)
    const oy = ((src.top  + src.height / 2 - finalTop)  / H  * 100).toFixed(2)
    const origin = `${ox}% ${oy}%`

    // Place popup at its final position but clipped to a dot
    gsap.set(popup, { top: finalTop, clipPath: `circle(0% at ${origin})` })
    gsap.set(backdrop, { opacity: 0 })

    const inner = popup.querySelector('.about-inner')
    gsap.set(inner, { opacity: 0, y: 6 })

    // Liquid glass expand
    gsap.to(backdrop, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    gsap.to(popup, {
      clipPath: `circle(150% at ${origin})`,
      duration: 0.7, ease: 'expo.out',
    })
    gsap.to(inner, { opacity: 1, y: 0, duration: 0.35, delay: 0.28, ease: 'power2.out' })

    function closeAbout() {
      if (!isOpen) return
      isOpen = false
      document.removeEventListener('keydown', onKey)
      gsap.to(inner, { opacity: 0, y: 4, duration: 0.18 })
      gsap.to(backdrop, { opacity: 0, duration: 0.4, ease: 'power2.in' })
      gsap.to(popup, {
        clipPath: `circle(0% at ${origin})`,
        duration: 0.5, ease: 'expo.in',
        onComplete: () => { popup.remove(); backdrop.remove() },
      })
    }

    popup.querySelector('.about-close').addEventListener('click', closeAbout)
    backdrop.addEventListener('click', closeAbout)
    function onKey(e) { if (e.key === 'Escape') closeAbout() }
    document.addEventListener('keydown', onKey)
  })
}

// ─── Boot ─────────────────────────────────────────────────

async function init() {
  initTheme()
  initBgToggle()
  initTrackToggle()
  initAbout()
  initModal()
  preloadVision()   // start downloading WASM in background immediately
  await loadData()

  document.querySelectorAll('.cp-view-btn').forEach(btn => {
    btn.addEventListener('click', () => activateView(btn.dataset.view))
  })

  activateView('horizontal')
}

init()
