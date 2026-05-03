/*
 * loader.js — Full-screen loading overlay
 *
 * CSS required in style.css:
 * ─────────────────────────────────────────────────────────────────
 * #loader {
 *   position: fixed;
 *   inset: 0;
 *   background: #F0EDE8;
 *   z-index: 9999;
 *   display: flex;
 *   flex-direction: column;
 *   justify-content: flex-end;
 *   pointer-events: all;
 * }
 *
 * .loader-body {
 *   display: flex;
 *   flex-direction: row;
 *   align-items: flex-end;
 *   padding: 0 0 32px 32px;
 *   gap: 24px;
 * }
 *
 * .loader-num {
 *   font-size: clamp(72px, 10vw, 120px);
 *   font-weight: 700;
 *   line-height: 1;
 *   color: #1a1a1a;
 *   font-variant-numeric: tabular-nums;
 *   min-width: 3ch;
 *   letter-spacing: -0.03em;
 *   user-select: none;
 * }
 *
 * .loader-canvas {
 *   flex: 1;
 *   height: 82px;
 *   display: block;
 * }
 * ─────────────────────────────────────────────────────────────────
 */

export function initLoader() {
  // ── DOM ────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.id = 'loader';

  const body = document.createElement('div');
  body.className = 'loader-body';

  const numSpan = document.createElement('span');
  numSpan.className = 'loader-num';
  numSpan.textContent = '0';

  const canvas = document.createElement('canvas');
  canvas.className = 'loader-canvas';

  body.appendChild(numSpan);
  body.appendChild(canvas);
  el.appendChild(body);
  document.body.appendChild(el);

  // ── State ──────────────────────────────────────────────────────
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let progress = 0;       // 0 → 1, authoritative fill position
  let displayNum = 0;     // lerped display value
  let rafId = null;
  let isComplete = false;
  let completionCb = null;

  // Auto-increment target: ramps to 0.88 over ~1800ms via easing
  const AUTO_TARGET = 0.88;
  const AUTO_DURATION = 1800; // ms
  let autoStart = null;

  // ── Canvas ─────────────────────────────────────────────────────
  const ctx = canvas.getContext('2d');

  const SPACING = 5.5; // logical px between bar centres

  function resize() {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  function draw() {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const N = Math.ceil(W / SPACING);

    for (let i = 0; i < N; i++) {
      const t = i / N;
      if (t > progress) break;

      const x = i * SPACING;
      const barW = Math.max(0.4, 4.0 * Math.pow(1 - t, 0.55));
      const opacity = Math.max(0.18, 0.92 - t * 0.74);

      ctx.fillStyle = `rgba(26,26,26,${opacity})`;
      ctx.fillRect(x - barW / 2, 0, barW, H);
    }
  }

  // ── Animation loop ─────────────────────────────────────────────
  function tick(timestamp) {
    // Auto-progress ramp
    if (!isComplete) {
      if (autoStart === null) autoStart = timestamp;
      const elapsed = timestamp - autoStart;
      const rawT = Math.min(elapsed / AUTO_DURATION, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - rawT, 3);
      progress = Math.min(eased * AUTO_TARGET, AUTO_TARGET);
    }

    // Lerp display number toward (progress * 100)
    displayNum += (progress * 100 - displayNum) * 0.07;
    numSpan.textContent = Math.floor(displayNum);

    draw();

    // Check if we just hit 100 after complete() was called
    if (isComplete && Math.floor(displayNum) >= 100 && completionCb) {
      const cb = completionCb;
      completionCb = null;
      cb();
      return; // stop rAF loop — fadeout handled in complete()
    }

    rafId = requestAnimationFrame(tick);
  }

  // ── Resize listener ────────────────────────────────────────────
  const onResize = () => {
    resize();
    draw();
  };
  window.addEventListener('resize', onResize);

  // ── Start after one rAF so CSS layout has resolved ────────────
  requestAnimationFrame(() => {
    resize();
    rafId = requestAnimationFrame(tick);
  });

  // ── Public API ─────────────────────────────────────────────────
  function complete() {
    return new Promise(resolve => {
      isComplete = true;
      progress = 1.0; // snap fill to full

      // Let the number lerp up to 100 (~600ms window)
      completionCb = () => {
        // Fade out and remove
        el.style.transition = 'opacity 0.45s ease';
        el.style.opacity = '0';
        el.addEventListener('transitionend', () => {
          window.removeEventListener('resize', onResize);
          if (rafId) cancelAnimationFrame(rafId);
          el.remove();
          resolve();
        }, { once: true });
      };
    });
  }

  return { complete };
}
