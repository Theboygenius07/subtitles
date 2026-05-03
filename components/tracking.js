// ── Preload: kick off WASM download immediately, before user clicks ──
let _visionPromise = null
export function preloadVision() {
  if (_visionPromise) return
  _visionPromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')
    .then(({ FilesetResolver }) =>
      FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )
    )
    .catch(() => { _visionPromise = null })
}

function getVision() {
  preloadVision()
  return _visionPromise
}

// ── Dead-zone joystick mapping ────────────────────────────────────────
const DEAD = 0.07   // tight dead zone — only ignore tiny tremors
function joystick(pos) {
  const c = pos - 0.5
  if (Math.abs(c) < DEAD) return 0
  return Math.sign(c) * (Math.abs(c) - DEAD) / (0.5 - DEAD)
}

// ── Tracker singleton ─────────────────────────────────────────────────
class HandTracker {
  constructor() {
    this.active      = false
    this.x = 0.5; this.y = 0.5
    this.joyX = 0;  this.joyY = 0
    this.pinch       = false
    this._landmarker = null
    this._video      = null
    this._stream     = null
    this._raf        = null
    this._lastTs     = -1
    this._camWrap    = null
  }

  async start(camWrap) {
    this._camWrap = camWrap
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })

      this._video = document.createElement('video')
      this._video.srcObject  = this._stream
      this._video.autoplay   = true
      this._video.playsInline = true
      this._video.muted      = true
      camWrap.appendChild(this._video)
      await this._video.play()

      const vision = await getVision()
      const { HandLandmarker } =
        await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')

      this._landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      })

      this.active = true
      this._loop()
      return true
    } catch (err) {
      console.warn('Hand tracking failed:', err)
      this.stop()
      return false
    }
  }

  stop() {
    this.active = false
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null }
    this._stream?.getTracks().forEach(t => t.stop())
    this._stream = null; this._video = null
    this._landmarker?.close(); this._landmarker = null
    this.joyX = 0; this.joyY = 0; this.pinch = false
    this._dispatch({ joyX: 0, joyY: 0, pinch: false, active: false })
  }

  _loop() {
    if (!this.active) return
    const now = performance.now()

    if (this._video?.readyState >= 2 && now !== this._lastTs) {
      this._lastTs = now
      const result = this._landmarker.detectForVideo(this._video, now)

      if (result.landmarks?.length) {
        const lm   = result.landmarks[0]
        const tip  = lm[8]   // index fingertip
        const thb  = lm[4]   // thumb tip

        // EMA smooth the raw position to remove per-frame jitter
        const SMOOTH = 0.35
        this._sx = (this._sx ?? tip.x) * (1 - SMOOTH) + tip.x * SMOOTH
        this._sy = (this._sy ?? tip.y) * (1 - SMOOTH) + tip.y * SMOOTH

        this.x = this._sx
        this.y = this._sy

        // Joystick uses smoothed + mirrored position
        const rawJoyX = joystick(1 - this._sx)
        const rawJoyY = joystick(this._sy)
        this.joyX = this.joyX * 0.55 + rawJoyX * 0.45
        this.joyY = this.joyY * 0.55 + rawJoyY * 0.45

        const wasPinch = this.pinch
        this.pinch = Math.hypot(tip.x - thb.x, tip.y - thb.y) < 0.06

        // Hand depth proxy: wrist-to-pinky-base span (lm[0]→lm[17]).
        // Stable across finger movements; larger = closer to camera.
        const wrist = lm[0], pinkyBase = lm[17]
        const span  = Math.hypot(wrist.x - pinkyBase.x, wrist.y - pinkyBase.y)
        this._sz = (this._sz ?? span) * 0.80 + span * 0.20   // EMA — smooth but responsive
        // Map span [0.06, 0.24] → rawZ [0, 1]  (0=far, 1=very close)
        const rawZ = Math.max(0, Math.min(1, (this._sz - 0.06) / 0.18))

        this._dispatch({
          joyX: this.joyX, joyY: this.joyY,
          rawX: 1 - this._sx, rawY: this._sy,   // smoothed + mirrored
          rawZ,
          pinch: this.pinch, pinchStart: this.pinch && !wasPinch,
          x: this.x, y: this.y, active: true
        })
      } else {
        this._sx = null; this._sy = null; this._sz = null   // reset smoother on loss of hand
        this.joyX *= 0.7; this.joyY *= 0.7
        this.pinch = false
        this._dispatch({ joyX: this.joyX, joyY: this.joyY, pinch: false, active: false })
      }
    }

    this._raf = requestAnimationFrame(() => this._loop())
  }

  _dispatch(detail) {
    document.dispatchEvent(new CustomEvent('hand:move', { detail }))
  }
}

export const tracker = new HandTracker()
