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

    const mobile = window.matchMedia('(pointer: coarse)').matches

    const VIEWS = [
      {
        name: 'Horizontal', color: '#4f8ef7',
        icon: '<path d="M12.417 1.96c.722 0 1.307.577 1.307 1.29v9.185c0 .712-.585 1.289-1.307 1.289h-1.96c-.722 0-1.307-.577-1.307-1.29V3.25c0-.712.585-1.289 1.307-1.289h1.96zM3.268 1.96c-.722 0-1.307.577-1.307 1.29v9.185c0 .712.585 1.289 1.307 1.289h1.96c.722 0 1.307-.577 1.307-1.29V3.25c0-.712-.585-1.289-1.307-1.289h-1.96z" stroke="currentColor" stroke-width="1.3"/>',
        controls: mobile ? [
          { action: 'Browse',     keys: ['Swipe left/right'] },
          { action: 'Open photo', keys: ['Tap'] },
        ] : [
          { action: 'Browse',     keys: ['← →', 'Scroll'] },
          { action: 'Open photo', keys: ['Click'] },
        ],
      },
      {
        name: 'Vertical', color: '#a78bf7',
        icon: '<path d="M13.724 12.417c0 .722-.577 1.307-1.289 1.307H3.25c-.712 0-1.289-.585-1.289-1.307v-1.96c0-.722.577-1.307 1.289-1.307h9.185c.712 0 1.289.585 1.289 1.307v1.96zM13.724 3.267c0-.722-.577-1.307-1.289-1.307H3.25c-.712 0-1.289.585-1.289 1.307v1.96c0 .722.577 1.307 1.289 1.307h9.185c.712 0 1.289-.585 1.289-1.307v-1.96z" stroke="currentColor" stroke-width="1.3"/>',
        controls: mobile ? [
          { action: 'Browse',     keys: ['Swipe up/down'] },
          { action: 'Open photo', keys: ['Tap'] },
        ] : [
          { action: 'Browse',     keys: ['↑ ↓', 'Scroll'] },
          { action: 'Open photo', keys: ['Click'] },
        ],
      },
      {
        name: 'Canvas', color: '#5bb8a4',
        icon: '<path d="M12.417 1.96c.722 0 1.307.577 1.307 1.29v2.2c0 .712-.585 1.289-1.307 1.289h-1.96c-.722 0-1.307-.577-1.307-1.29V3.25c0-.712.585-1.289 1.307-1.289h1.96zM3.268 1.96c-.722 0-1.307.577-1.307 1.29v2.2c0 .712.585 1.289 1.307 1.289h1.96c.722 0 1.307-.577 1.307-1.29V3.25c0-.712-.585-1.289-1.307-1.289h-1.96zM12.417 8.945c.722 0 1.307.577 1.307 1.29v2.2c0 .712-.585 1.289-1.307 1.289h-1.96c-.722 0-1.307-.577-1.307-1.29v-2.2c0-.712.585-1.289 1.307-1.289h1.96zM3.268 8.945c-.722 0-1.307.577-1.307 1.29v2.2c0 .712.585 1.289 1.307 1.289h1.96c.722 0 1.307-.577 1.307-1.29v-2.2c0-.712-.585-1.289-1.307-1.289h-1.96z" stroke="currentColor" stroke-width="1.3"/>',
        controls: mobile ? [
          { action: 'Pan',        keys: ['Drag'] },
          { action: 'Open photo', keys: ['Tap'] },
          { action: 'Close',      keys: ['Tap outside'] },
        ] : [
          { action: 'Pan',        keys: ['Drag'] },
          { action: 'Open photo', keys: ['Click'] },
          { action: 'Close',      keys: ['Esc'] },
        ],
      },
      {
        name: 'Globe', color: '#f79c4f',
        icon: '<path d="M8.036 14.224c3.451 0 6.248-2.797 6.248-6.249 0-3.451-2.797-6.248-6.248-6.248m0 12.497c-3.451 0-6.248-2.797-6.248-6.249 0-3.451 2.797-6.248 6.248-6.248m0 12.497c-1.51 0-2.734-2.797-2.734-6.249 0-3.451 1.224-6.248 2.734-6.248m0 12.497c1.51 0 2.734-2.797 2.734-6.249 0-3.451-1.224-6.248-2.734-6.248M2.959 11.012c1.145-.655 3.047-1.084 5.199-1.084 2.247 0 4.22.467 5.345 1.172M2.959 4.938c1.145.655 3.047 1.084 5.199 1.084 2.247 0 4.22-.467 5.345-1.172" stroke="currentColor" stroke-width="1.155"/>',
        controls: mobile ? [
          { action: 'Rotate',     keys: ['Drag'] },
          { action: 'Zoom',       keys: ['Pinch'] },
          { action: 'Open photo', keys: ['Tap'] },
          { action: 'Close',      keys: ['Tap outside'] },
        ] : [
          { action: 'Rotate',     keys: ['Drag'] },
          { action: 'Zoom',       keys: ['Scroll'] },
          { action: 'Open photo', keys: ['Click'] },
          { action: 'Navigate',   keys: ['← →'] },
          { action: 'Close',      keys: ['Esc'] },
        ],
      },
      {
        name: 'Gallery', color: '#f76b8e',
        icon: '<path d="M1.5 13.5h13M3 13.5V8M6 13.5V8M10 13.5V8M13 13.5V8M1.5 8h13M8 1.5l6.5 6.5H1.5L8 1.5z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>',
        controls: mobile ? [
          { action: 'Walk',       keys: ['Swipe up/down'] },
          { action: 'Turn',       keys: ['Swipe left/right'] },
          { action: 'Open photo', keys: ['Tap'] },
          { action: 'Navigate',   keys: ['Panel buttons'] },
          { action: 'Close',      keys: ['Panel ×'] },
        ] : [
          { action: 'Walk',       keys: ['W A S D', '↑ ↓ ← →'] },
          { action: 'Look',       keys: ['Drag'] },
          { action: 'Open photo', keys: ['Click'] },
          { action: 'Navigate',   keys: ['← →'] },
          { action: 'Close',      keys: ['Esc'] },
        ],
      },
      {
        name: 'Hand Tracking', color: '#5bc777',
        icon: '<path d="M6 8V3.5a1 1 0 0 1 2 0V8M8 7V2.5a1 1 0 0 1 2 0V7M10 7V4a1 1 0 0 1 2 0v5.5a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 9.5V7.75a1 1 0 0 1 2 0V8M6 8V5a1 1 0 0 0-2 0v2.75" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
        controls: [
          { action: 'Scroll / Pan',  keys: ['Open hand · move'] },
          { action: 'Select',        keys: ['Pinch + hold'] },
          { action: 'Depth (Globe)', keys: ['Push · pull'] },
          { action: 'Dismiss',       keys: ['Pinch + hold'] },
        ],
      },
    ]

    const accHtml = VIEWS.map(v => `
      <div class="about-acc-item">
        <button class="about-acc-header">
          <span class="about-acc-dot" style="background:${v.color}"></span>
          <svg class="about-acc-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">${v.icon}</svg>
          <span class="about-acc-name">${v.name}</span>
          <svg class="about-acc-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="about-acc-body">
          <div class="about-acc-content">
            ${v.controls.map(c => `
              <div class="about-ctrl-row">
                <span class="about-ctrl-action">${c.action}</span>
                <div class="about-ctrl-keys">${c.keys.map(k => `<kbd class="about-key">${k}</kbd>`).join('')}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`).join('')

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
        <p class="about-section-label">How to navigate</p>
        <div class="about-accordion">${accHtml}</div>
      </div>`

    document.body.appendChild(backdrop)
    document.body.appendChild(popup)

    // Accordion toggle — one open at a time
    popup.querySelectorAll('.about-acc-header').forEach(header => {
      header.addEventListener('click', () => {
        const item   = header.parentElement
        const body   = item.querySelector('.about-acc-body')
        const isNowOpen = item.classList.contains('open')

        popup.querySelectorAll('.about-acc-item.open').forEach(other => {
          other.classList.remove('open')
          other.querySelector('.about-acc-body').style.height = '0'
        })

        if (!isNowOpen) {
          item.classList.add('open')
          body.style.height = body.querySelector('.about-acc-content').offsetHeight + 'px'
        }
      })
    })

    // Position popup top-right, aligned with the info button
    const W = Math.min(340, window.innerWidth - 48)
    const RIGHT_PAD = window.innerWidth - src.right
    gsap.set(popup, { position: 'fixed', width: W, right: RIGHT_PAD, top: -9999 })
    const H = popup.offsetHeight
    const finalTop = Math.min(src.bottom + 12, window.innerHeight - H - 16)

    const popupLeft = window.innerWidth - RIGHT_PAD - W
    const ox = ((src.left + src.width  / 2 - popupLeft) / W  * 100).toFixed(2)
    const oy = ((src.top  + src.height / 2 - finalTop)  / H  * 100).toFixed(2)
    const origin = `${ox}% ${oy}%`

    gsap.set(popup, { top: finalTop, clipPath: `circle(0% at ${origin})` })
    gsap.set(backdrop, { opacity: 0 })
    const inner = popup.querySelector('.about-inner')
    gsap.set(inner, { opacity: 0, y: 6 })

    gsap.to(backdrop, { opacity: 1, duration: 0.5, ease: 'power2.out' })
    gsap.to(popup, { clipPath: `circle(150% at ${origin})`, duration: 0.7, ease: 'expo.out' })
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
  initTrackToggle()
  initAbout()
  initModal()
  preloadVision()   // start downloading WASM in background immediately
  await loadData()

  document.querySelectorAll('.cp-view-btn').forEach(btn => {
    btn.addEventListener('click', () => activateView(btn.dataset.view))
  })

  document.getElementById('meBtn').addEventListener('click', () => {
    window.open('https://www.linkedin.com/in/oluwaseyiogundipe/', '_blank', 'noopener noreferrer')
  })

  activateView('horizontal')
}

init()
