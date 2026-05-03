export function initCursor() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const style = document.createElement('style')
  style.textContent = '* { cursor: none !important; }'
  document.head.appendChild(style)

  const dpr = Math.min(devicePixelRatio, 2)

  function resize() {
    canvas.width = innerWidth * dpr
    canvas.height = innerHeight * dpr
    canvas.style.width = innerWidth + 'px'
    canvas.style.height = innerHeight + 'px'
  }
  resize()
  window.addEventListener('resize', resize)

  const TRAIL_CHARS = ['･', '✻', '◦', '✷', '✧', '○', '❋']
  const CURSOR_CHAR = '↖'
  const LIFETIME = 800
  const STAGGER = 100

  let mouseX = -100
  let mouseY = -100
  let lastGridX = null
  let lastGridY = null
  const particles = []

  function spawnParticle(x, y, isClick) {
    const spread = isClick ? 300 : 80
    particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * spread,
      dy: (Math.random() - 0.5) * spread,
      char: TRAIL_CHARS[Math.floor(Math.random() * TRAIL_CHARS.length)],
      born: performance.now()
    })
  }

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX
    mouseY = e.clientY

    const gx = Math.round(mouseX / 18) * 18
    const gy = Math.round(mouseY / 18) * 18

    if (gx !== lastGridX || gy !== lastGridY) {
      lastGridX = gx
      lastGridY = gy
      spawnParticle(mouseX, mouseY, false)
    }
  })

  window.addEventListener('click', e => {
    for (let i = 0; i < 50; i++) {
      spawnParticle(e.clientX, e.clientY, true)
    }
  })

  function getColor() {
    return document.documentElement.dataset.theme === 'light' ? '#111111' : '#f0f0f0'
  }

  function loop(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)

    const color = getColor()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      const life = now - p.born

      if (life >= LIFETIME) {
        particles.splice(i, 1)
        continue
      }

      const adjustedLife = life - STAGGER
      if (adjustedLife <= 0) continue

      const lifeRatio = adjustedLife / LIFETIME
      const sz = 18 * (1 - lifeRatio)
      if (sz <= 0) continue

      const x = p.x + p.dx * lifeRatio
      const y = p.y + p.dy * lifeRatio

      ctx.font = sz + 'px monospace'
      ctx.fillText(p.char, x, y)
    }

    ctx.font = '18px monospace'
    ctx.fillText(CURSOR_CHAR, mouseX, mouseY)

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}
