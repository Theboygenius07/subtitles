import * as THREE from 'three'
import gsap from 'gsap'
import { cloudinaryUrl } from '../utils.js'

const R     = 6
const COUNT = 80
const PW    = 1.6
const PH    = PW * (9 / 16)

function makeList(photos) {
  const out = [], pool = [...photos]
  while (out.length < COUNT) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    out.push(...pool)
  }
  return out.slice(0, COUNT)
}

export function initGlobe(container, photos) {
  const list = makeList(photos)

  container.innerHTML = ''
  container.classList.add('globe-view')

  // ── Renderer ──────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  // ── Scene / Camera ────────────────────────────────────────
  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    70, container.clientWidth / container.clientHeight, 0.1, 200
  )
  camera.position.set(0, 0, 55)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))

  // ── Globe group ───────────────────────────────────────────
  const globe = new THREE.Group()
  scene.add(globe)

  // ── Cards — Fibonacci-sunflower distribution ──────────────
  // lookAt outward (x*2, y*2, z*2): front face faces AWAY from center.
  // Viewer outside sees front face = correct, non-mirrored texture.
  const loader = new THREE.TextureLoader()
  const images = []

  for (let i = 0; i < COUNT; i++) {
    const phi   = Math.acos(-1 + (2 * i) / COUNT)
    const theta = Math.sqrt(COUNT * Math.PI) * phi
    const x = R * Math.cos(theta) * Math.sin(phi)
    const y = R * Math.sin(theta) * Math.sin(phi)
    const z = R * Math.cos(phi)

    const mat = new THREE.MeshBasicMaterial({
      color: 0x444444, side: THREE.DoubleSide,
      transparent: true, opacity: 1,
    })
    loader.load(cloudinaryUrl(list[i].cloudinary_url, 280), tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true
    })

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat)
    mesh.position.set(x, y, z)
    mesh.lookAt(x * 2, y * 2, z * 2)   // front face points outward
    mesh.userData = { photo: list[i] }
    globe.add(mesh)
    images.push(mesh)
  }

  // ── Project a globe mesh to a viewport bounding rect ─────
  function getMeshScreenRect(mesh) {
    const corners = [
      new THREE.Vector3(-PW / 2, -PH / 2, 0),
      new THREE.Vector3( PW / 2, -PH / 2, 0),
      new THREE.Vector3( PW / 2,  PH / 2, 0),
      new THREE.Vector3(-PW / 2,  PH / 2, 0),
    ]
    const cr = container.getBoundingClientRect()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    corners.forEach(c => {
      c.applyMatrix4(mesh.matrixWorld)
      c.project(camera)
      const sx = (c.x + 1) / 2 * cr.width  + cr.left
      const sy = (-c.y + 1) / 2 * cr.height + cr.top
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx)
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy)
    })
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY }
  }

  // ── Track whether a focus card is currently open ─────────
  let focusOpen = false

  // ── Vision Pro card — same effect as freeform view ───────
  function openFocus(photo, mesh) {
    if (focusOpen) return   // don't stack cards
    focusOpen = true
    const srcRect = getMeshScreenRect(mesh)
    const vw = window.innerWidth, vh = window.innerHeight
    const finalH = Math.round(vh * 0.8)
    const finalW = Math.round(finalH * 16 / 9)
    const finalL = Math.round((vw - finalW) / 2)
    const finalT = Math.round((vh - finalH) / 2)

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
      <path d="M8 2v8m0 0-3-3m3 3 3-3M2 12.5v.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-.5"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
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

    gsap.set(overlay, { backgroundColor: 'rgba(0,0,0,0)' })
    gsap.set(card, {
      position: 'absolute',
      left: srcRect.left, top: srcRect.top,
      width: srcRect.width, height: srcRect.height,
      borderRadius: 3,
      transformPerspective: 1100,
      rotationX: 0, rotationY: 0,
      boxShadow: '0 0px 0px rgba(0,0,0,0)',
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
      duration: 0.7, ease: 'expo.inOut',
    })
    gsap.to(dlBtn, { opacity: 1, duration: 0.2, delay: 0.55 })

    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect()
      const dx = ((e.clientX - r.left) / r.width  - 0.5) * 2
      const dy = ((e.clientY - r.top)  / r.height - 0.5) * 2
      gsap.to(card, {
        rotationX: 5 - dy * 10, rotationY: dx * 9,
        duration: 0.4, ease: 'power2.out', overwrite: 'auto',
      })
    })
    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotationX: 5, rotationY: 0,
        duration: 0.8, ease: 'elastic.out(1, 0.55)', overwrite: 'auto',
      })
    })

    // Hand tilt + pinch-to-close (mirrors freeform's onHandTilt)
    let pinchCloseTimer = null
    function onHandTilt({ detail }) {
      if (detail.active) {
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
        const dx = clamp((detail.rawX - 0.5) * 2.5, -1, 1)
        const dy = clamp((detail.rawY - 0.5) * 2.5, -1, 1)
        gsap.to(card, {
          rotationX: 5 - dy * 10, rotationY: dx * 9,
          duration: 0.12, ease: 'power2.out', overwrite: 'auto',
        })
      }
      if (detail.pinch && !pinchCloseTimer) {
        pinchCloseTimer = setTimeout(() => close(), 800)
      }
      if (!detail.pinch && pinchCloseTimer) {
        clearTimeout(pinchCloseTimer); pinchCloseTimer = null
      }
    }
    document.addEventListener('hand:move', onHandTilt)

    function close() {
      focusOpen = false
      clearTimeout(pinchCloseTimer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('hand:move', onHandTilt)
      overlay.classList.remove('ff-focus-overlay--open')
      const dest = getMeshScreenRect(mesh)
      gsap.to(dlBtn, { opacity: 0, duration: 0.12 })
      gsap.to(overlay, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.45, ease: 'power2.in' })
      gsap.to(card, {
        left: dest.left, top: dest.top,
        width: dest.width, height: dest.height,
        borderRadius: 3, rotationX: 0, rotationY: 0,
        boxShadow: '0 0px 0px rgba(0,0,0,0)',
        duration: 0.55, ease: 'expo.inOut', overwrite: 'auto',
        onComplete: () => overlay.remove(),
      })
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) close() })
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
  }

  // ── Cinematic entry ───────────────────────────────────────
  let entryProgress = 0, entryDone = false
  const entryStart  = new THREE.Vector3(0, 0, 55)
  const entryEnd    = new THREE.Vector3(0, 0, R + 3)

  // ── Globe rotation state ──────────────────────────────────
  let rotX = 0, rotY = 0, targetX = 0, targetY = 0
  let velX = 0, velY = 0
  let dragging   = false
  let prev       = { x: 0, y: 0 }
  let dragStartX = 0, dragStartY = 0
  let cameraTargetZ = R + 3

  // ── Mouse drag ────────────────────────────────────────────
  window.addEventListener('mousedown', e => {
    if (!entryDone) return
    dragging = true
    prev.x = dragStartX = e.clientX
    prev.y = dragStartY = e.clientY
  })
  window.addEventListener('mouseup', () => { dragging = false })
  window.addEventListener('mousemove', e => {
    if (!dragging) return
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y
    targetY += dx * 0.004; targetX += dy * 0.004
    velX = dx * 0.002;     velY = dy * 0.002
    prev.x = e.clientX;   prev.y = e.clientY
  })

  // ── Scroll zoom ───────────────────────────────────────────
  window.addEventListener('wheel', e => {
    if (!entryDone) return
    e.preventDefault()
    cameraTargetZ = Math.max(0.5, Math.min(30, cameraTargetZ + e.deltaY * 0.02))
  }, { passive: false })

  // ── Click ─────────────────────────────────────────────────
  window.addEventListener('click', e => {
    if (e.target !== renderer.domElement) return
    if (!entryDone) return
    if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 8) return
    const r   = container.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width)  * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    ), camera)
    const hit = ray.intersectObjects(images)[0]
    if (hit) openFocus(hit.object.userData.photo, hit.object)
  })

  // ── Touch ─────────────────────────────────────────────────
  window.addEventListener('touchstart', e => {
    dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY
    dragging = true; prev.x = dragStartX; prev.y = dragStartY
  }, { passive: true })
  window.addEventListener('touchmove', e => {
    if (!dragging) return
    const dx = e.touches[0].clientX - prev.x, dy = e.touches[0].clientY - prev.y
    targetY += dx * 0.004; targetX += dy * 0.004
    velX = dx * 0.002;     velY = dy * 0.002
    prev.x = e.touches[0].clientX; prev.y = e.touches[0].clientY
  }, { passive: true })
  window.addEventListener('touchend', () => { dragging = false })

  // ── Hand cursor — on body so it stays above ff-focus-overlay ─
  const handCursor = document.createElement('div')
  handCursor.className = 'ff-hand-cursor'
  handCursor.style.cssText = 'position:fixed;top:0;left:0;z-index:1000;'
  document.body.appendChild(handCursor)

  let cursorTargetX = 0, cursorTargetY = 0
  let cursorX = 0, cursorY = 0
  let cursorVisible = false
  let cursorRafId = null

  function cursorLoop() {
    cursorX += (cursorTargetX - cursorX) * 0.28
    cursorY += (cursorTargetY - cursorY) * 0.28
    handCursor.style.transform = `translate(${cursorX | 0}px,${cursorY | 0}px)`
    cursorRafId = requestAnimationFrame(cursorLoop)
  }
  cursorRafId = requestAnimationFrame(cursorLoop)

  // ── Hand tracking — freeform-style controls ───────────────
  let handGrabbing   = false
  let pinchOpenTimer = null
  let maxHandMoved   = 0
  let pinchStartRawX = 0, pinchStartRawY = 0
  let prevHandRawX   = null, prevHandRawY = null
  let prevRawZ       = null

  function onHandMove({ detail }) {
    if (!container.classList.contains('active')) return

    if (detail.active) {
      // Cursor always follows hand, even when a card is open
      cursorTargetX = detail.rawX * window.innerWidth  - 18
      cursorTargetY = detail.rawY * window.innerHeight - 18
      if (!cursorVisible) {
        cursorVisible = true
        cursorX = cursorTargetX; cursorY = cursorTargetY
        handCursor.style.opacity = '1'
      }
      handCursor.classList.toggle('ff-hand-cursor--grab', !!detail.pinch)

      // Z-axis zoom — only when no card is open
      // Delta approach with dead zone to filter tremor
      if (!focusOpen && detail.rawZ !== undefined && prevRawZ !== null) {
        const delta = detail.rawZ - prevRawZ
        if (Math.abs(delta) > 0.010) {
          cameraTargetZ = Math.max(0.5, Math.min(30, cameraTargetZ - delta * 18))
        }
      }
      prevRawZ = detail.rawZ
    } else {
      if (cursorVisible) { cursorVisible = false; handCursor.style.opacity = '0' }
      prevHandRawX = null; prevHandRawY = null; prevRawZ = null
    }

    // All globe controls below are blocked while a card is open
    if (focusOpen) return

    // Pinch start → start 1-second open timer
    if (detail.pinchStart && !handGrabbing && entryDone) {
      handGrabbing   = true
      maxHandMoved   = 0
      pinchStartRawX = detail.rawX
      pinchStartRawY = detail.rawY
      prevHandRawX   = detail.rawX
      prevHandRawY   = detail.rawY

      pinchOpenTimer = setTimeout(() => {
        pinchOpenTimer = null
        if (maxHandMoved < 60) {
          // Use prevHandRawX/Y — the current hand position, not pinch-start
          const cx = (prevHandRawX ?? pinchStartRawX) * window.innerWidth
          const cy = (prevHandRawY ?? pinchStartRawY) * window.innerHeight
          const cr = container.getBoundingClientRect()
          const ray = new THREE.Raycaster()
          ray.setFromCamera(new THREE.Vector2(
            ((cx - cr.left) / cr.width)  * 2 - 1,
            -((cy - cr.top) / cr.height) * 2 + 1,
          ), camera)
          const hit = ray.intersectObjects(images)[0]
          if (hit) openFocus(hit.object.userData.photo, hit.object)
        }
      }, 1000)
    }

    // Holding pinch + moving → rotate globe
    if (handGrabbing && detail.pinch && detail.active && prevHandRawX !== null) {
      const dx = (detail.rawX - prevHandRawX) * window.innerWidth
      const dy = (detail.rawY - prevHandRawY) * window.innerHeight
      const totalMoved = Math.hypot(
        (detail.rawX - pinchStartRawX) * window.innerWidth,
        (detail.rawY - pinchStartRawY) * window.innerHeight,
      )
      maxHandMoved = Math.max(maxHandMoved, totalMoved)
      targetY += dx * 0.006; targetX += dy * 0.006
      velX = dx * 0.003;     velY = dy * 0.003
    }
    if (handGrabbing && detail.active) {
      prevHandRawX = detail.rawX; prevHandRawY = detail.rawY
    }

    // Release pinch → stop
    if (handGrabbing && !detail.pinch) {
      handGrabbing = false
      if (pinchOpenTimer) { clearTimeout(pinchOpenTimer); pinchOpenTimer = null }
      prevHandRawX = null; prevHandRawY = null
    }
  }
  document.addEventListener('hand:move', onHandMove)

  // ── Render loop ───────────────────────────────────────────
  let rafId = null

  function animate() {
    rafId = requestAnimationFrame(animate)

    if (!entryDone) {
      entryProgress = Math.min(entryProgress + 0.008, 1)
      camera.position.lerpVectors(entryStart, entryEnd, entryProgress)
      globe.scale.setScalar(THREE.MathUtils.lerp(0.3, 1, entryProgress))
      if (entryProgress >= 1) { entryDone = true; globe.scale.setScalar(1) }
      renderer.render(scene, camera); return
    }

    camera.position.z += (cameraTargetZ - camera.position.z) * 0.07

    if (!dragging) {
      targetY += velX; targetX += velY
      velX *= 0.92;    velY *= 0.92
    }
    rotX += (targetX - rotX) * 0.08
    rotY += (targetY - rotY) * 0.08
    globe.rotation.x = rotX
    globe.rotation.y = rotY

    renderer.render(scene, camera)
  }

  animate()

  // ── Resize ────────────────────────────────────────────────
  function onResize() {
    const w = container.clientWidth, h = container.clientHeight
    camera.aspect = w / h; camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  container._cleanup = () => {
    document.removeEventListener('hand:move', onHandMove)
    window.removeEventListener('resize', onResize)
    if (rafId) cancelAnimationFrame(rafId)
    if (cursorRafId) cancelAnimationFrame(cursorRafId)
    handCursor.remove()
    renderer.dispose()
  }
}
