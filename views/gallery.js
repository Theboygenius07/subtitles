import * as THREE from 'three'
import gsap from 'gsap'
import { cloudinaryUrl } from '../utils.js'

const ROOM_W   = 14
const ROOM_H   = 5.5
const ROOM_D   = 62
const HANG_Y   = 1.55
const EYE_Y    = 1.70
const WALL_X   = ROOM_W / 2
const PHOTO_X  = WALL_X - 0.12
const ASPECT   = 16 / 9

// Wall: smooth modern concrete. Ceiling: mirrored wood floor (same as floor, flipped).
const TEX_FLOOR = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor/wood_floor_diff_1k.jpg'
const TEX_WALL  = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_wall_008/concrete_wall_008_diff_1k.jpg'

function photoHeight(i, isAnchor) {
  if (isAnchor) return 1.90
  const r = (Math.sin(i * 7.3219 + 1.618) + 1) / 2
  if (r < 0.22) return 0.68
  if (r < 0.52) return 0.95
  if (r < 0.76) return 1.25
  if (r < 0.93) return 1.60
  return 1.95
}

// Clone texture with correct tile density. Pass mirrorY=true to flip vertically (ceiling mirror effect).
function scaledTex(src, worldW, worldH, tileSize, mirrorY = false) {
  const t = src.clone()
  const ry = worldH / tileSize
  t.repeat.set(worldW / tileSize, mirrorY ? -ry : ry)
  if (mirrorY) t.offset.y = 1   // keeps tiling correct with negative repeat
  t.needsUpdate = true
  return t
}

function renderSubtitle(text) {
  if (!text) return ''
  const isDialogue = /—|—/.test(text)
  if (isDialogue) {
    return text.split(/\s*[——]\s*/).filter(Boolean)
      .map(l => `<p class="gal-dialogue-line">— ${l}</p>`).join('')
  }
  return `<p>${text}</p>`
}

export function initGallery(container, photos) {
  container.innerHTML = ''

  // ── Renderer ──────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.30
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xECE9E3)

  const camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 80)
  camera.rotation.order = 'YXZ'

  scene.add(new THREE.AmbientLight(0xFFF8F0, 1.10))

  // ── Textures ──────────────────────────────────────────────
  const tl = new THREE.TextureLoader()
  function loadBase(url) {
    const t = tl.load(url)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(1, 1)
    return t
  }

  const floorBase = loadBase(TEX_FLOOR)
  const wallBase  = loadBase(TEX_WALL)
  buildRoom(scene, floorBase, wallBase)
  addTrackLights(scene)

  // ── Frame material ────────────────────────────────────────
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1C1710, roughness: 0.20, metalness: 0.92,
  })

  // ── Photo meshes ──────────────────────────────────────────
  const clickables  = []
  const photoLoader = new THREE.TextureLoader()
  const SPREAD      = ROOM_D - 6

  photos.forEach((photo, i) => {
    const h    = photoHeight(i, photo.is_anchor)
    const w    = h * ASPECT
    const side = (i % 2 === 0) ? -1 : 1
    const wx   = side * PHOTO_X

    const t = i / (photos.length - 1)
    const z = ROOM_D / 2 - 3 - t * SPREAD + Math.sin(i * 2.618) * 0.55
    const y = HANG_Y + Math.sin(i * 1.414) * 0.12
    const ry = side === -1 ? Math.PI / 2 : -Math.PI / 2

    const photoMat = new THREE.MeshStandardMaterial({
      color: 0x181818, roughness: 0.18, metalness: 0,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), photoMat)
    mesh.rotation.y = ry
    mesh.position.set(wx - side * 0.01, y, z)
    mesh.userData = { photo, index: i, w, side, loaded: false }

    scene.add(mesh)
    clickables.push(mesh)
    addFrame(scene, wx - side * 0.01, y, z, w, h, ry, frameMat)
  })

  // ── Camera / navigation state ─────────────────────────────
  let camYaw = 0, camPitch = 0, targetYaw = 0, targetPitch = 0
  const entryZ    = ROOM_D / 2 - 2
  const targetPos = new THREE.Vector3(0, EYE_Y, entryZ + 7)
  camera.position.copy(targetPos)

  // ── Focus state ───────────────────────────────────────────
  let focusState = null   // null when roaming; object when standing at a photo

  // ── Hand cursor ───────────────────────────────────────────
  const handCursor = document.createElement('div')
  handCursor.className = 'gal-hand-cursor'
  container.appendChild(handCursor)
  let handVisible = false

  // ── Keyboard ──────────────────────────────────────────────
  const keys = new Set()
  function onKeyDown(e) { keys.add(e.code) }
  function onKeyUp(e)   { keys.delete(e.code) }
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup',   onKeyUp)

  function onGlobalKey(e) {
    if (!focusState) return
    if (e.key === 'Escape') { e.preventDefault(); closeFocus(); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      navigateFocus(e.key === 'ArrowRight' ? 1 : -1)
    }
  }
  document.addEventListener('keydown', onGlobalKey)

  // ── Mouse look ────────────────────────────────────────────
  let dragging = false, lastMX = 0, lastMY = 0, mDown = null

  function onMD(e) {
    dragging = true; lastMX = e.clientX; lastMY = e.clientY
    mDown = { x: e.clientX, y: e.clientY, t: Date.now() }
  }
  function onMM(e) {
    if (!dragging) return
    targetYaw   -= (e.clientX - lastMX) * 0.003
    targetPitch  = Math.max(-0.65, Math.min(0.55, targetPitch - (e.clientY - lastMY) * 0.003))
    lastMX = e.clientX; lastMY = e.clientY
  }
  function onMU(e) {
    dragging = false
    if (!mDown) return
    if (Math.hypot(e.clientX - mDown.x, e.clientY - mDown.y) < 5 && Date.now() - mDown.t < 280) {
      handleClick(e.clientX, e.clientY)
    }
    mDown = null
  }
  renderer.domElement.addEventListener('mousedown', onMD)
  window.addEventListener('mousemove', onMM)
  window.addEventListener('mouseup',   onMU)

  // ── Scroll wheel ──────────────────────────────────────────
  function onWheel(e) {
    if (!container.classList.contains('active') || focusState) return
    e.preventDefault()
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw))
    const rgt = new THREE.Vector3( Math.cos(camYaw), 0, -Math.sin(camYaw))
    targetPos.addScaledVector(fwd, -e.deltaY * 0.014)
    targetPos.addScaledVector(rgt,  e.deltaX * 0.014)
    clampPos()
  }
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

  // ── Touch ─────────────────────────────────────────────────
  renderer.domElement.style.touchAction = 'none'
  const isMobileTouch = window.matchMedia('(pointer: coarse)').matches
  let t0 = null, tDown = null

  function onTS(e) {
    t0    = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    tDown = { ...t0, t: Date.now() }
  }
  function onTM(e) {
    if (!t0 || e.touches.length !== 1) return
    e.preventDefault()
    const dx = e.touches[0].clientX - t0.x
    const dy = e.touches[0].clientY - t0.y
    if (isMobileTouch && !focusState) {
      // Mobile: swipe left/right = turn, swipe up/down = walk forward/back
      const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw))
      targetYaw -= dx * 0.004
      targetPos.addScaledVector(fwd, -dy * 0.003)
      clampPos()
    } else {
      // Desktop: drag = look around (yaw + pitch)
      targetYaw   -= dx * 0.004
      targetPitch  = Math.max(-0.65, Math.min(0.55, targetPitch - dy * 0.004))
    }
    t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTE(e) {
    if (!tDown) return
    const tc = e.changedTouches[0]
    if (Math.hypot(tc.clientX - tDown.x, tc.clientY - tDown.y) < 8 && Date.now() - tDown.t < 280) {
      handleClick(tc.clientX, tc.clientY)
    }
    t0 = null; tDown = null
  }
  renderer.domElement.addEventListener('touchstart', onTS, { passive: true })
  renderer.domElement.addEventListener('touchmove',  onTM, { passive: false })
  renderer.domElement.addEventListener('touchend',   onTE)

  function clampPos() {
    targetPos.x = Math.max(-(WALL_X - 1.5), Math.min(WALL_X - 1.5, targetPos.x))
    targetPos.z = Math.max(-(ROOM_D / 2 - 0.5), Math.min(ROOM_D / 2 - 0.5, targetPos.z))
  }

  function handleClick(cx, cy) {
    if (!container.classList.contains('active') || focusState) return
    const rect = renderer.domElement.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((cx - rect.left) / rect.width)  * 2 - 1,
      -((cy - rect.top)  / rect.height) * 2 + 1
    )
    const rc = new THREE.Raycaster()
    rc.setFromCamera(ndc, camera)
    const hits = rc.intersectObjects(clickables)
    if (hits.length) walkToPhoto(hits[0].object)
  }

  // ── Hand tracking ─────────────────────────────────────────
  let handPinchTimer = null

  function onHandMove({ detail }) {
    if (!container.classList.contains('active')) return

    // Show / hide cursor dot
    const nowVisible = detail.active
    if (nowVisible !== handVisible) {
      handVisible = nowVisible
      handCursor.style.opacity = nowVisible ? '1' : '0'
    }
    if (detail.active) {
      handCursor.style.left = `${detail.rawX * 100}%`
      handCursor.style.top  = `${detail.rawY * 100}%`
      handCursor.classList.toggle('gal-hand-cursor--pinch', detail.pinch)
    }

    if (focusState) {
      // In focus mode: pinch + hold to go back
      if (detail.pinch) {
        if (!handPinchTimer) {
          handPinchTimer = setTimeout(() => { handPinchTimer = null; closeFocus() }, 900)
        }
      } else {
        if (handPinchTimer) { clearTimeout(handPinchTimer); handPinchTimer = null }
      }
    } else {
      // Roaming: joyX/Y drives movement through the corridor
      if (detail.active) {
        const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw))
        const rgt = new THREE.Vector3( Math.cos(camYaw), 0, -Math.sin(camYaw))
        const HAND_SPEED = 0.055
        targetPos.addScaledVector(fwd, -detail.joyY * HAND_SPEED)
        targetPos.addScaledVector(rgt,  detail.joyX * HAND_SPEED)
        clampPos()
      }

      // Pinch start → raycast at hand cursor position and walk to photo
      if (detail.pinchStart && detail.active) {
        const nx =  detail.rawX * 2 - 1
        const ny = -(detail.rawY * 2 - 1)
        const rc = new THREE.Raycaster()
        rc.setFromCamera(new THREE.Vector2(nx, ny), camera)
        const hits = rc.intersectObjects(clickables)
        if (hits.length) walkToPhoto(hits[0].object)
      }
    }
  }
  document.addEventListener('hand:move', onHandMove)

  // ── Walk-to-photo ─────────────────────────────────────────
  function walkToPhoto(mesh, savedOverride) {
    if (focusState) return
    const { photo, index, side } = mesh.userData
    const mPos = mesh.position

    const VIEW_DIST = 2.2
    const destX = mPos.x - side * VIEW_DIST
    // side=-1 (left wall)  → yaw = PI/2  (face toward -X wall)
    // side=+1 (right wall) → yaw = -PI/2 (face toward +X wall)
    const destYaw = side * (-Math.PI / 2)

    const savedPos   = savedOverride?.pos   ?? targetPos.clone()
    const savedYaw   = savedOverride?.yaw   ?? targetYaw
    const savedPitch = savedOverride?.pitch ?? targetPitch

    focusState = { mesh, index, savedPos, savedYaw, savedPitch, panel: null }

    gsap.to(targetPos, { x: destX, z: mPos.z, duration: 1.3, ease: 'power3.inOut' })

    const yawProxy = { val: targetYaw }
    gsap.to(yawProxy, {
      val: destYaw, duration: 1.0, ease: 'power2.inOut',
      onUpdate() { targetYaw = yawProxy.val },
    })
    const pitchProxy = { val: targetPitch }
    gsap.to(pitchProxy, {
      val: 0, duration: 0.7, ease: 'power2.out',
      onUpdate() { targetPitch = pitchProxy.val },
    })

    const panel = buildInfoPanel(photo, index)
    focusState.panel = panel
    gsap.fromTo(panel, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, delay: 1.0, ease: 'power2.out' })
  }

  function buildInfoPanel(photo, index) {
    const panel = document.createElement('div')
    panel.className = 'gal-info-panel'

    const subtitleHtml = renderSubtitle(photo.subtitle)
    const contextHtml  = photo.context ? `<p class="gal-info-context">${photo.context}</p>` : ''

    panel.innerHTML = `
      <div class="gal-info-text">
        <div class="gal-info-subtitle">${subtitleHtml}</div>
        ${contextHtml}
      </div>
      <div class="gal-info-actions">
        <button class="gal-info-nav gal-info-prev" aria-label="Previous photo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 13L5 8l5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="gal-info-nav gal-info-next" aria-label="Next photo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="gal-info-dl" aria-label="Download">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8m0 0-3-3m3 3 3-3M2 12.5v.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-.5"
              stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="gal-info-close" aria-label="Back">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `

    document.body.appendChild(panel)

    panel.querySelector('.gal-info-close').addEventListener('click', closeFocus)
    panel.querySelector('.gal-info-prev').addEventListener('click', () => navigateFocus(-1))
    panel.querySelector('.gal-info-next').addEventListener('click', () => navigateFocus(1))
    panel.querySelector('.gal-info-dl').addEventListener('click', async () => {
      const res  = await fetch(photo.cloudinary_url)
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `week-${String(photo.week).padStart(2, '0')}.jpg`
      a.click()
    })

    return panel
  }

  function closeFocus() {
    if (!focusState) return
    const { savedPos, savedYaw, savedPitch, panel } = focusState
    focusState = null
    if (handPinchTimer) { clearTimeout(handPinchTimer); handPinchTimer = null }

    if (panel) {
      gsap.to(panel, { y: 60, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => panel.remove() })
    }

    gsap.to(targetPos, { x: savedPos.x, z: savedPos.z, duration: 1.1, ease: 'power2.inOut' })
    const yawProxy = { val: targetYaw }
    gsap.to(yawProxy, {
      val: savedYaw, duration: 0.9, ease: 'power2.inOut',
      onUpdate() { targetYaw = yawProxy.val },
    })
    const pitchProxy = { val: targetPitch }
    gsap.to(pitchProxy, {
      val: savedPitch, duration: 0.6, ease: 'power2.out',
      onUpdate() { targetPitch = pitchProxy.val },
    })
  }

  function navigateFocus(dir) {
    if (!focusState) return
    const nextIdx = focusState.index + dir
    if (nextIdx < 0 || nextIdx >= clickables.length) return

    const savedOverride = { pos: focusState.savedPos, yaw: focusState.savedYaw, pitch: focusState.savedPitch }
    if (focusState.panel) {
      const p = focusState.panel; focusState.panel = null
      gsap.to(p, { opacity: 0, duration: 0.2, onComplete: () => p.remove() })
    }
    focusState = null
    walkToPhoto(clickables[nextIdx], savedOverride)
  }

  // ── Render loop ───────────────────────────────────────────
  let raf = null
  const SPEED = 0.055

  function animate() {
    raf = requestAnimationFrame(animate)

    if (container.classList.contains('active') && !focusState) {
      const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw))
      const rgt = new THREE.Vector3( Math.cos(camYaw), 0, -Math.sin(camYaw))
      if (keys.has('ArrowUp')    || keys.has('KeyW')) targetPos.addScaledVector(fwd,  SPEED)
      if (keys.has('ArrowDown')  || keys.has('KeyS')) targetPos.addScaledVector(fwd, -SPEED)
      if (keys.has('KeyA'))                           targetPos.addScaledVector(rgt, -SPEED)
      if (keys.has('KeyD'))                           targetPos.addScaledVector(rgt,  SPEED)
      if (keys.has('ArrowLeft'))  targetYaw += 0.028
      if (keys.has('ArrowRight')) targetYaw -= 0.028
      clampPos()
    }

    camYaw   += (targetYaw   - camYaw)   * 0.10
    camPitch += (targetPitch - camPitch) * 0.10
    camera.position.lerp(targetPos, 0.08)
    camera.rotation.y = camYaw
    camera.rotation.x = camPitch

    clickables.forEach(mesh => {
      if (mesh.userData.loaded) return
      if (camera.position.distanceTo(mesh.position) < 22) {
        mesh.userData.loaded = true
        photoLoader.load(
          cloudinaryUrl(mesh.userData.photo.cloudinary_url, Math.round(mesh.userData.w * 450)),
          tex => {
            tex.colorSpace = THREE.SRGBColorSpace
            mesh.material.map = tex
            mesh.material.color.set(0xffffff)
            mesh.material.needsUpdate = true
          }
        )
      }
    })

    renderer.render(scene, camera)
  }

  animate()
  gsap.to(targetPos, { z: entryZ, duration: 2.8, ease: 'power3.out', delay: 0.1 })

  // ── Resize ────────────────────────────────────────────────
  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }
  window.addEventListener('resize', onResize)

  // ── Cleanup ───────────────────────────────────────────────
  container._cleanup = () => {
    if (focusState?.panel) focusState.panel.remove()
    if (handPinchTimer) clearTimeout(handPinchTimer)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup',   onKeyUp)
    document.removeEventListener('keydown', onGlobalKey)
    document.removeEventListener('hand:move', onHandMove)
    window.removeEventListener('mousemove', onMM)
    window.removeEventListener('mouseup',   onMU)
    window.removeEventListener('resize',    onResize)
    renderer.domElement.removeEventListener('mousedown',  onMD)
    renderer.domElement.removeEventListener('touchstart', onTS)
    renderer.domElement.removeEventListener('touchmove',  onTM)
    renderer.domElement.removeEventListener('touchend',   onTE)
    renderer.domElement.removeEventListener('wheel',      onWheel)
    if (raf) cancelAnimationFrame(raf)
    renderer.dispose()
  }
}

// ── Room geometry ──────────────────────────────────────────
// floorBase is reused for the ceiling, mirrored (reflection effect).
function buildRoom(scene, floorBase, wallBase) {
  function wallMat(w, h) {
    return new THREE.MeshStandardMaterial({
      map: scaledTex(wallBase, w, h, 5.0),
      color: 0xF0EDE8, roughness: 0.78, metalness: 0,
    })
  }

  const floorMat = new THREE.MeshStandardMaterial({
    map: scaledTex(floorBase, ROOM_W, ROOM_D, 1.5),
    color: 0xCCAA72, roughness: 0.72, metalness: 0.01,
  })
  // Ceiling: same wood texture, flipped vertically → mirror of the floor
  const ceilMat = new THREE.MeshStandardMaterial({
    map: scaledTex(floorBase, ROOM_W, ROOM_D, 1.5, true),
    color: 0xBB9960, roughness: 0.60, metalness: 0.02,
  })
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xDDDAD3, roughness: 0.80, metalness: 0 })

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat)
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = ROOM_H
  scene.add(ceil)

  const lw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat(ROOM_D, ROOM_H))
  lw.rotation.y = Math.PI / 2
  lw.position.set(-ROOM_W / 2, ROOM_H / 2, 0)
  scene.add(lw)

  const rw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat(ROOM_D, ROOM_H))
  rw.rotation.y = -Math.PI / 2
  rw.position.set(ROOM_W / 2, ROOM_H / 2, 0)
  scene.add(rw)

  const bw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat(ROOM_W, ROOM_H))
  bw.position.set(0, ROOM_H / 2, -ROOM_D / 2)
  scene.add(bw)

  const fw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat(ROOM_W, ROOM_H))
  fw.rotation.y = Math.PI
  fw.position.set(0, ROOM_H / 2, ROOM_D / 2)
  scene.add(fw)

  const BH = 0.14
  const BL = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, BH), baseMat)
  BL.rotation.y = Math.PI / 2
  BL.position.set(-ROOM_W / 2 + 0.002, BH / 2, 0)
  scene.add(BL)

  const BR = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, BH), baseMat)
  BR.rotation.y = -Math.PI / 2
  BR.position.set(ROOM_W / 2 - 0.002, BH / 2, 0)
  scene.add(BR)

  const BB = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, BH), baseMat)
  BB.position.set(0, BH / 2, -ROOM_D / 2 + 0.002)
  scene.add(BB)

  const BF = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, BH), baseMat)
  BF.rotation.y = Math.PI
  BF.position.set(0, BH / 2, ROOM_D / 2 - 0.002)
  scene.add(BF)
}

// ── Ceiling track lights ───────────────────────────────────
function addTrackLights(scene) {
  const COUNT   = 14
  const fixMat  = new THREE.MeshBasicMaterial({ color: 0x222222 })
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFFEE88 })

  for (let i = 0; i < COUNT; i++) {
    const t  = i / (COUNT - 1)
    const lz = ROOM_D / 2 - 1.5 - t * (ROOM_D - 3)
    const light = new THREE.PointLight(0xFFEDD0, 3.5, 11)
    light.position.set(0, ROOM_H - 0.08, lz)
    scene.add(light)

    const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.20, 8), fixMat)
    fix.position.set(0, ROOM_H - 0.10, lz)
    scene.add(fix)

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), bulbMat)
    bulb.position.set(0, ROOM_H - 0.20, lz)
    scene.add(bulb)
  }
}

// ── 3D thin metal frame ────────────────────────────────────
function addFrame(scene, px, py, pz, w, h, ry, mat) {
  const FW = 0.026, FD = 0.018
  const hBar = new THREE.BoxGeometry(w + FW * 2, FW, FD)
  const vBar = new THREE.BoxGeometry(FW, h, FD)

  const top = new THREE.Mesh(hBar, mat)
  top.rotation.y = ry; top.position.set(px, py + h / 2 + FW / 2, pz)
  scene.add(top)

  const bot = new THREE.Mesh(hBar, mat)
  bot.rotation.y = ry; bot.position.set(px, py - h / 2 - FW / 2, pz)
  scene.add(bot)

  const lft = new THREE.Mesh(vBar, mat)
  lft.rotation.y = ry; lft.position.set(px, py, pz + w / 2 + FW / 2)
  scene.add(lft)

  const rgt = new THREE.Mesh(vBar, mat)
  rgt.rotation.y = ry; rgt.position.set(px, py, pz - w / 2 - FW / 2)
  scene.add(rgt)
}
