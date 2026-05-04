import * as THREE from 'three'
import gsap from 'gsap'
import { sb } from '../supabase.js'

// ── Constants ──────────────────────────────────────────────────────────────────
const CARD_W      = 420
const CARD_H_BASE = 265   // 420 × (9/16) ≈ 236, pad to 265 for content
const NOTE_MAX    = 200
const SPHERE_MAX  = 500
const GLOBE_R     = 6
const PLANE_W     = 2.0
const ADMIN_PASS  = new URLSearchParams(location.search).get('admin')
const PRESETS     = ['#1e9a64','#2563eb','#c0392b','#d97706','#7c3aed','#f0f0f0']
const INK_PRESETS = ['#ffffff','#0a0a0a','#d4a800','#1e9a64']
const ADJ  = ['WANDERING','SILENT','GOLDEN','DISTANT','QUIET','HOLLOW','GENTLE','STRANGE','BRIGHT','FADING','WILD','DRIFTING','BRAVE','ANCIENT','LONELY']
const NOUN = ['ACORN','MOTH','STAR','EMBER','TIDE','STONE','FEATHER','ECHO','SPARK','WAVE','DUSK','BLOOM','SHADE','GLOW','CLOUD']

const FONT = 'PPNeueMontreal'

// ── Font preload (required before canvas rendering) ────────────────────────────
const FONTS_READY = (async () => {
  try {
    const defs = [
      ['400', 'ppneuemontreal-book.otf'],
      ['500', 'ppneuemontreal-medium.otf'],
      ['700', 'ppneuemontreal-bold.otf'],
    ]
    await Promise.all(defs.map(async ([w, file]) => {
      const face = new FontFace(FONT, `url(/assets/fonts/${file})`, { weight: w })
      document.fonts.add(await face.load())
    }))
  } catch (e) { /* fallback to system fonts silently */ }
})()

// ── Color utilities ────────────────────────────────────────────────────────────
function lum(hex) {
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255
  const f = c => c<=.03928 ? c/12.92 : ((c+.055)/1.055)**2.4
  return .2126*f(r) + .7152*f(g) + .0722*f(b)
}
function textCol(hex, mat) {
  if (mat === 'metal' || mat === 'glass') return '#ffffff'
  return lum(hex) > .40 ? '#0a0a0a' : '#ffffff'
}
function rgba(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}
function muteTC(tc, a=.45) { return tc==='#ffffff' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})` }
function randName() { return `${ADJ[Math.random()*ADJ.length|0]} ${NOUN[Math.random()*NOUN.length|0]}` }
function cardH(note) {
  if (!note || !note.trim()) return CARD_H_BASE
  return Math.min(CARD_H_BASE + Math.ceil(note.length / 46) * 20 + 14, 380)
}

// ── Card canvas renderer ───────────────────────────────────────────────────────
async function renderCard(canvas, data) {
  await FONTS_READY
  const { name='', note='', material='solid', color='#1e9a64', inkColor='#ffffff', strokes=[], visitorNumber, createdAt } = data
  const W = CARD_W, H = cardH(note)
  const PR = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W*PR; canvas.height = H*PR
  canvas.style.width = W+'px'; canvas.style.height = H+'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(PR, PR)

  const R16 = 18  // border radius
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, R16); ctx.clip()

  // ── Material backgrounds ──────────────────────────────────────────────────────
  if (material === 'solid') {
    // Rich solid: gentle vignette at bottom for depth
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H)
    const vign = ctx.createRadialGradient(W*.5, H*.3, 0, W*.5, H*.5, W*.75)
    vign.addColorStop(0, 'rgba(255,255,255,0.06)')
    vign.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H)

  } else if (material === 'metal') {
    // ── Premium dark metal (inspired by luxury bank cards) ────────────────────
    // 1. Base diagonal gradient — dark charcoal with very subtle color tint
    const cr = parseInt(color.slice(1,3),16), cg = parseInt(color.slice(3,5),16), cb = parseInt(color.slice(5,7),16)
    const tint = (base, c, strength=0.06) => Math.round(Math.min(255, base + c*strength))

    const g0 = ctx.createLinearGradient(0, H, W, 0)
    g0.addColorStop(0,    `rgb(${tint(10,cr)},${tint(10,cg)},${tint(10,cb)})`)
    g0.addColorStop(0.38, `rgb(${tint(22,cr)},${tint(22,cg)},${tint(22,cb)})`)
    g0.addColorStop(0.65, `rgb(${tint(38,cr)},${tint(38,cg)},${tint(38,cb)})`)
    g0.addColorStop(1,    `rgb(${tint(52,cr)},${tint(52,cg)},${tint(52,cb)})`)
    ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H)

    // 2. Subtle brushed-metal micro-lines (very faint)
    ctx.save(); ctx.globalAlpha = 0.028
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = y % 4 < 2 ? '#fff' : '#000'
      ctx.fillRect(0, y, W, 1)
    }
    ctx.restore()

    // 3. Diagonal sheen from top-right corner
    const sheen = ctx.createLinearGradient(W, 0, W*.15, H*.6)
    sheen.addColorStop(0,    'rgba(255,255,255,0.18)')
    sheen.addColorStop(0.30, 'rgba(255,255,255,0.06)')
    sheen.addColorStop(0.60, 'rgba(255,255,255,0.02)')
    sheen.addColorStop(1,    'rgba(255,255,255,0)')
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, W, H)

    // 4. Top-edge specular line
    const topSpec = ctx.createLinearGradient(W*.1, 0, W*.9, 0)
    topSpec.addColorStop(0,   'rgba(255,255,255,0)')
    topSpec.addColorStop(0.3, 'rgba(255,255,255,0.22)')
    topSpec.addColorStop(0.7, 'rgba(255,255,255,0.22)')
    topSpec.addColorStop(1,   'rgba(255,255,255,0)')
    ctx.fillStyle = topSpec; ctx.fillRect(0, 0, W, 1.5)

    // 5. Bottom-edge shadow
    const botShadow = ctx.createLinearGradient(0, H-2, 0, H)
    botShadow.addColorStop(0, 'rgba(0,0,0,0)'); botShadow.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = botShadow; ctx.fillRect(0, H-16, W, 16)

  } else { // glass
    // ── Premium frosted glass ─────────────────────────────────────────────────
    // 1. Very dark translucent base
    ctx.fillStyle = 'rgba(7,7,10,0.86)'; ctx.fillRect(0, 0, W, H)
    // 2. Color wash
    ctx.fillStyle = rgba(color, 0.11); ctx.fillRect(0, 0, W, H)
    // 3. Top gradient highlight (frosted glass light catch)
    const topG = ctx.createLinearGradient(0, 0, 0, H*.55)
    topG.addColorStop(0,    'rgba(255,255,255,0.14)')
    topG.addColorStop(0.25, 'rgba(255,255,255,0.05)')
    topG.addColorStop(1,    'rgba(255,255,255,0)')
    ctx.fillStyle = topG; ctx.fillRect(0, 0, W, H*.55)
    // 4. Left-edge highlight
    const leftG = ctx.createLinearGradient(0, 0, W*.12, 0)
    leftG.addColorStop(0, 'rgba(255,255,255,0.12)'); leftG.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = leftG; ctx.fillRect(0, 0, W*.12, H)
    // 5. Inner border glow
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(0.5, 0.5, W-1, H-1, R16-1); ctx.stroke()
    ctx.restore()
    // 6. Bottom darkness
    const botG = ctx.createLinearGradient(0, H*.6, 0, H)
    botG.addColorStop(0, 'rgba(0,0,0,0)'); botG.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = botG; ctx.fillRect(0, H*.6, W, H*.4)
  }

  const tc  = textCol(color, material)
  const tcm = muteTC(tc)
  const F   = FONT + ',system-ui,sans-serif'

  // ── Layout ────────────────────────────────────────────────────────────────────
  const PX = 26  // horizontal padding

  // Row 1: SUBTITLES + material badge
  ctx.font = `700 10px ${F}`; ctx.letterSpacing = '0.14em'
  ctx.fillStyle = tc; ctx.fillText('SUBTITLES', PX, 30)

  ctx.font = `500 8px ${F}`; ctx.letterSpacing = '0.12em'
  ctx.fillStyle = tcm; ctx.textAlign = 'right'
  ctx.fillText(material.toUpperCase(), W-PX, 30); ctx.textAlign = 'left'

  // Row 2: VISITOR chip
  ctx.font = `500 8px ${F}`; ctx.letterSpacing = '0.20em'
  ctx.fillStyle = muteTC(tc, .38)
  ctx.fillText('VISITOR', PX, 56)

  // Row 3: Name — large, confident
  ctx.font = `700 22px ${F}`; ctx.letterSpacing = '-0.01em'
  ctx.fillStyle = tc
  ctx.fillText((name || '').toUpperCase().slice(0, 20), PX, 86)

  let y = 112

  // Note (optional, wrapped)
  if (note && note.trim()) {
    ctx.font = `400 12px ${F}`; ctx.letterSpacing = '0.01em'
    ctx.fillStyle = muteTC(tc, .75)
    const maxW = W - PX*2
    let line = ''
    for (const word of note.trim().split(' ')) {
      const test = line ? line+' '+word : word
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, PX, y); y+=20; line=word }
      else line = test
    }
    if (line) { ctx.fillText(line, PX, y); y+=20 }
    y += 10
  }

  // Divider
  ctx.strokeStyle = muteTC(tc, .12); ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PX, y); ctx.lineTo(W-PX, y); ctx.stroke()
  y += 18

  // Footer row: NO. left, ISSUED right
  ctx.font = `500 9px ${F}`; ctx.letterSpacing = '0.08em'
  ctx.fillStyle = tcm
  ctx.fillText(visitorNumber ? `NO. ${String(visitorNumber).padStart(4,'0')}` : 'NO. ????', PX, y)
  const d = createdAt ? new Date(createdAt) : new Date()
  const ds = `${String(d.getMonth()+1).padStart(2,'0')} / ${String(d.getDate()).padStart(2,'0')} / ${String(d.getFullYear())}`
  ctx.textAlign = 'right'; ctx.fillText(ds, W-PX, y); ctx.textAlign = 'left'
  y += 28

  // Signature: X mark + line
  ctx.font = `500 10px ${F}`; ctx.letterSpacing = '0.04em'
  ctx.fillStyle = muteTC(tc, .35); ctx.fillText('X', PX, y+5)
  ctx.strokeStyle = muteTC(tc, .18); ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PX+16, y+1); ctx.lineTo(W-PX, y+1); ctx.stroke()

  if (strokes && strokes.length) {
    const SX = PX+18, SY = y-20, SW = W-PX*2-18, SH = 30
    ctx.save()
    ctx.strokeStyle = inkColor || tc; ctx.lineWidth = 1.6
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .88
    for (const stroke of strokes) {
      if (stroke.length < 2) continue
      ctx.beginPath(); ctx.moveTo(SX+stroke[0].x*SW, SY+stroke[0].y*SH)
      for (let i=1; i<stroke.length; i++) ctx.lineTo(SX+stroke[i].x*SW, SY+stroke[i].y*SH)
      ctx.stroke()
    }
    ctx.restore()
  }
}

// ── Signature capture canvas ───────────────────────────────────────────────────
function buildSigCanvas(initialInk) {
  const el = document.createElement('canvas')
  el.className = 'vc-sig-canvas'
  const W = 480, H = 110
  el.width = W*2; el.height = H*2
  el.style.width = '100%'; el.style.height = H+'px'
  const ctx = el.getContext('2d')
  ctx.scale(2, 2)

  let strokes = [], current = null, drawing = false
  let ink = initialInk || '#ffffff'

  function norm(e) {
    const r = el.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX-r.left)/r.width, y: (src.clientY-r.top)/r.height }
  }

  function redraw() {
    ctx.clearRect(0, 0, W, H)
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const all = current ? [...strokes, current] : strokes
    for (const s of all) {
      if (s.length < 2) continue
      ctx.beginPath(); ctx.moveTo(s[0].x*W, s[0].y*H)
      for (let i=1; i<s.length; i++) ctx.lineTo(s[i].x*W, s[i].y*H)
      ctx.stroke()
    }
  }

  function down(e) { e.preventDefault(); drawing=true; current=[norm(e)] }
  function move(e) { if (!drawing) return; e.preventDefault(); current.push(norm(e)); redraw() }
  function up(e)   { if (!drawing) return; e.preventDefault(); if (current) strokes.push(current); current=null; drawing=false; el.dispatchEvent(new Event('strokeend')) }

  el.addEventListener('mousedown',  down)
  el.addEventListener('mousemove',  move)
  el.addEventListener('mouseup',    up)
  el.addEventListener('touchstart', down, { passive: false })
  el.addEventListener('touchmove',  move, { passive: false })
  el.addEventListener('touchend',   up,   { passive: false })

  return {
    el,
    getStrokes: () => strokes,
    clear() { strokes=[]; current=null; ctx.clearRect(0,0,W,H) },
    setInk(c) { ink=c; redraw() },
  }
}

// ── Sign view (card-first with toolbar) ────────────────────────────────────────
function buildSignView(onDone) {
  let state = { name: randName(), note: '', material: 'solid', color: PRESETS[0], inkColor: INK_PRESETS[0] }
  let sigStrokes = []
  const sig = buildSigCanvas(state.inkColor)

  // ── Stage (fills section) ──
  const stage = document.createElement('div')
  stage.className = 'vc-stage'
  stage.innerHTML = `<div class="vc-welcome"><p class="vc-eyebrow">Subtitles · Visitor Registry</p><h2 class="vc-headline">I Was Here.</h2></div>`

  const preview = document.createElement('canvas')
  preview.className = 'vc-preview'
  stage.appendChild(preview)

  function applyGlow(el) {
    const r=parseInt(state.color.slice(1,3),16)||0,g=parseInt(state.color.slice(3,5),16)||0,b=parseInt(state.color.slice(5,7),16)||0
    const a=state.material==='solid'?.22:state.material==='glass'?.14:.07
    el.style.boxShadow=`0 0 0 1px rgba(255,255,255,0.07),0 48px 120px rgba(0,0,0,0.72),0 16px 40px rgba(0,0,0,0.42),0 0 80px rgba(${r},${g},${b},${a})`
  }

  function refresh() {
    renderCard(preview, { ...state, strokes: sigStrokes })
    applyGlow(preview)
    signBtn.classList.toggle('has-sig', sigStrokes.length > 0)
  }

  // ── Toolbar ──
  const toolbar = document.createElement('div')
  toolbar.className = 'vc-toolbar'

  // Name
  const nameIn = document.createElement('input')
  nameIn.className='vc-tb-input'; nameIn.type='text'; nameIn.maxLength=40
  nameIn.placeholder='Your name…'; nameIn.value=state.name
  nameIn.addEventListener('input', () => { state.name=nameIn.value; refresh() })
  const randBtn = document.createElement('button')
  randBtn.className='vc-tb-icon-btn'; randBtn.setAttribute('aria-label','Random name')
  randBtn.innerHTML=`<svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5A4.5 4.5 0 1 0 6.5 2M2 2v4.5h4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  randBtn.addEventListener('click', () => { state.name=randName(); nameIn.value=state.name; refresh() })
  const nameSec = document.createElement('div')
  nameSec.className='vc-tb-sec vc-tb-name'; nameSec.append(nameIn, randBtn)

  // Material
  const matSec = document.createElement('div')
  matSec.className='vc-tb-sec vc-tb-mat'
  ;['solid','metal','glass'].forEach(m => {
    const b = document.createElement('button')
    b.className=`vc-tb-mat-btn${m===state.material?' active':''}`
    b.textContent=m.charAt(0).toUpperCase()+m.slice(1)
    b.addEventListener('click', () => {
      state.material=m
      matSec.querySelectorAll('.vc-tb-mat-btn').forEach(x=>x.classList.toggle('active',x===b))
      refresh()
    })
    matSec.appendChild(b)
  })

  // Color
  const colorSec = document.createElement('div')
  colorSec.className='vc-tb-sec vc-tb-color'
  PRESETS.forEach(c => {
    const sw = document.createElement('button')
    sw.className=`vc-tb-swatch${c===state.color?' active':''}`;sw.style.background=c;sw.setAttribute('aria-label',c)
    sw.addEventListener('click', () => {
      state.color=c
      colorSec.querySelectorAll('.vc-tb-swatch').forEach(s=>s.classList.toggle('active',s===sw))
      refresh()
    })
    colorSec.appendChild(sw)
  })
  const ccLabel=document.createElement('label'); ccLabel.className='vc-tb-custom'; ccLabel.title='Custom colour'
  const ccIn=document.createElement('input'); ccIn.type='color'; ccIn.value=state.color
  ccIn.addEventListener('input', e => {
    state.color=e.target.value
    colorSec.querySelectorAll('.vc-tb-swatch').forEach(s=>s.classList.remove('active'))
    refresh()
  })
  ccLabel.append(ccIn)
  ccLabel.insertAdjacentHTML('beforeend',`<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>`)
  colorSec.appendChild(ccLabel)

  // Sign button
  const signBtn = document.createElement('button')
  signBtn.className='vc-tb-icon-btn vc-tb-sign-btn'; signBtn.setAttribute('aria-label','Add signature')
  signBtn.innerHTML=`<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13c1-2 2.5-3.5 4-4s3 0 2 2-3 3-3 1 2-4 4-6 3-2 3-1-1 3-2 4" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="vc-tb-sig-dot"></span>`

  // Submit
  const subBtn = document.createElement('button')
  subBtn.className='vc-tb-submit'; subBtn.textContent='Enter'

  const mkSep=()=>{ const d=document.createElement('div'); d.className='vc-tb-sep'; return d }
  toolbar.append(nameSec, mkSep(), matSec, mkSep(), colorSec, mkSep(), signBtn, mkSep(), subBtn)

  // ── Signature bottom sheet ──
  const overlay = document.createElement('div')
  overlay.className='vc-sig-overlay'
  const sheet = document.createElement('div')
  sheet.className='vc-sig-sheet'

  const sheetHdr = document.createElement('div'); sheetHdr.className='vc-sig-header'
  const sheetTitle = document.createElement('p'); sheetTitle.className='vc-sig-title'; sheetTitle.textContent='Signature & Note'
  const closeBtn = document.createElement('button'); closeBtn.className='vc-tb-icon-btn'; closeBtn.setAttribute('aria-label','Close')
  closeBtn.innerHTML=`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
  sheetHdr.append(sheetTitle, closeBtn)

  const noteTA = document.createElement('textarea')
  noteTA.className='vc-sig-note'; noteTA.maxLength=NOTE_MAX; noteTA.rows=2
  noteTA.placeholder='Leave a note… (optional)'
  noteTA.addEventListener('input', () => { state.note=noteTA.value; refresh() })

  const inkRow = document.createElement('div'); inkRow.className='vc-sig-ink-row'
  const inkLbl = document.createElement('p'); inkLbl.className='vc-tb-label'; inkLbl.textContent='INK'
  inkRow.appendChild(inkLbl)
  INK_PRESETS.forEach(c => {
    const sw = document.createElement('button')
    sw.className=`vc-tb-swatch vc-sig-ink-sw${c===state.inkColor?' active':''}`; sw.style.background=c
    sw.addEventListener('click', () => {
      state.inkColor=c; sig.setInk(c)
      inkRow.querySelectorAll('.vc-sig-ink-sw').forEach(s=>s.classList.toggle('active',s===sw))
      refresh()
    })
    inkRow.appendChild(sw)
  })
  const inkCL=document.createElement('label'); inkCL.className='vc-tb-custom'
  const inkCI=document.createElement('input'); inkCI.type='color'; inkCI.value=state.inkColor
  inkCI.addEventListener('input', e => {
    state.inkColor=e.target.value; sig.setInk(state.inkColor)
    inkRow.querySelectorAll('.vc-sig-ink-sw').forEach(s=>s.classList.remove('active')); refresh()
  })
  inkCL.append(inkCI); inkCL.insertAdjacentHTML('beforeend',`<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>`)
  inkRow.appendChild(inkCL)

  const clearBtn = document.createElement('button'); clearBtn.className='vc-sig-clear'
  clearBtn.textContent='Clear signature'
  clearBtn.addEventListener('click', () => { sig.clear(); sigStrokes=[]; refresh() })

  const doneBtn = document.createElement('button'); doneBtn.className='vc-sig-done'; doneBtn.textContent='Done'

  sheet.append(sheetHdr, noteTA, inkRow, sig.el, clearBtn, doneBtn)
  overlay.appendChild(sheet)

  sig.el.addEventListener('strokeend', () => { sigStrokes=sig.getStrokes(); refresh() })

  function openSheet()  { overlay.classList.add('open') }
  function closeSheet() { overlay.classList.remove('open') }
  signBtn.addEventListener('click', openSheet)
  closeBtn.addEventListener('click', closeSheet)
  doneBtn.addEventListener('click', closeSheet)
  overlay.addEventListener('click', e => { if (e.target===overlay) closeSheet() })
  document.addEventListener('keydown', e => { if (e.key==='Escape' && overlay.classList.contains('open')) closeSheet() })

  // ── Submit ──
  subBtn.addEventListener('click', async () => {
    if (!state.name.trim()) { nameIn.focus(); return }
    subBtn.disabled=true; subBtn.textContent='…'

    const { data, error } = await sb.from('visitor_cards').insert({
      name:           state.name.trim(),
      note:           state.note.trim()||null,
      signature_data: JSON.stringify(sigStrokes),
      material:       state.material,
      color:          state.color,
      ink_color:      state.inkColor,
    }).select().single()

    if (error) { subBtn.disabled=false; subBtn.textContent='Enter'; console.error(error); return }

    toolbar.remove(); overlay.remove()
    stage.innerHTML=''

    const suc = document.createElement('div'); suc.className='vc-success'
    const sucNo = document.createElement('p'); sucNo.className='vc-success-no'
    sucNo.innerHTML=`Card created. <span>NO. ${String(data.visitor_number).padStart(4,'0')}</span>`

    const sucCanvas = document.createElement('canvas'); sucCanvas.className='vc-preview'
    await renderCard(sucCanvas, { ...state, strokes: sigStrokes, visitorNumber: data.visitor_number, createdAt: data.created_at })
    applyGlow(sucCanvas)

    const btnRow = document.createElement('div'); btnRow.className='vc-success-btns'
    const dlBtn = document.createElement('button'); dlBtn.className='vc-dl-btn'; dlBtn.textContent='Download'
    dlBtn.addEventListener('click', async () => {
      const dl=document.createElement('canvas')
      await renderCard(dl, { ...state, strokes: sigStrokes, visitorNumber: data.visitor_number, createdAt: data.created_at })
      const a=document.createElement('a'); a.href=dl.toDataURL('image/png')
      a.download=`subtitles-visitor-${String(data.visitor_number).padStart(4,'0')}.png`; a.click()
    })
    const viewBtn = document.createElement('button'); viewBtn.className='vc-view-all-btn'; viewBtn.textContent='View all cards →'
    viewBtn.addEventListener('click', () => document.dispatchEvent(new CustomEvent('visitor:showglobe')))
    btnRow.append(dlBtn, viewBtn)
    suc.append(sucNo, sucCanvas, btnRow)
    stage.appendChild(suc)

    stage._setToolbarVisible = () => {}
    stage._cleanup = () => {}
    onDone(data)
  })

  document.body.append(toolbar, overlay)
  stage._setToolbarVisible = v => { toolbar.style.display = v ? '' : 'none' }
  stage._cleanup = () => { toolbar.remove(); overlay.remove() }

  refresh()
  return stage
}

// ── Visitor globe ──────────────────────────────────────────────────────────────
function buildGlobe(container) {
  container.innerHTML = ''

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, container.clientWidth/container.clientHeight, 0.1, 200)
  camera.position.set(0, 0, 55)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))

  const globe  = new THREE.Group()
  scene.add(globe)

  const meshMap  = new Map() // id → { plane, dot }
  let   dotsMode = false

  function fibPos(idx) {
    const phi   = Math.acos(-1 + (2*idx) / SPHERE_MAX)
    const theta = Math.sqrt(SPHERE_MAX * Math.PI) * phi
    return { x: GLOBE_R*Math.cos(theta)*Math.sin(phi), y: GLOBE_R*Math.sin(theta)*Math.sin(phi), z: GLOBE_R*Math.cos(phi) }
  }

  async function makeTexture(card) {
    const c = document.createElement('canvas')
    await renderCard(c, {
      name: card.name, note: card.note, material: card.material,
      color: card.color, inkColor: card.ink_color,
      strokes: JSON.parse(card.signature_data||'[]'),
      visitorNumber: card.visitor_number, createdAt: card.created_at,
    })
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { tex, h: cardH(card.note) }
  }

  async function addCard(card) {
    if (meshMap.has(card.id)) return
    const idx = ((card.visitor_number-1) % SPHERE_MAX + SPHERE_MAX) % SPHERE_MAX
    const { x, y, z } = fibPos(idx)
    const { tex, h }  = await makeTexture(card)
    const ph = PLANE_W * (h / CARD_W)

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_W, ph),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })
    )
    plane.position.set(x, y, z); plane.lookAt(x*2, y*2, z*2)
    plane.userData = { card }; plane.visible = !dotsMode
    globe.add(plane)

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(.13, 10, 10),
      new THREE.MeshBasicMaterial({ color: parseInt(card.color.slice(1),16), transparent: true, opacity: .92 })
    )
    dot.position.set(x, y, z); dot.userData = { card }; dot.visible = dotsMode
    globe.add(dot)

    meshMap.set(card.id, { plane, dot })
    emptyMsg.style.display = 'none'
  }

  function removeCard(id) {
    const entry = meshMap.get(id); if (!entry) return
    globe.remove(entry.plane); globe.remove(entry.dot)
    entry.plane.material.map?.dispose(); entry.plane.material.dispose(); entry.plane.geometry.dispose()
    entry.dot.material.dispose(); entry.dot.geometry.dispose()
    meshMap.delete(id)
    if (!meshMap.size) emptyMsg.style.display = ''
  }

  // Empty state message
  const emptyMsg = document.createElement('p')
  emptyMsg.className = 'vc-globe-empty'; emptyMsg.textContent = 'No cards yet. Be the first.'
  container.appendChild(emptyMsg)

  // Dots/planes toggle
  const toggleEl = document.createElement('button')
  toggleEl.className = 'vc-globe-toggle'; toggleEl.textContent = 'Dots'
  toggleEl.addEventListener('click', () => {
    dotsMode = !dotsMode
    toggleEl.textContent = dotsMode ? 'Cards' : 'Dots'
    toggleEl.classList.toggle('active', dotsMode)
    meshMap.forEach(({ plane, dot }) => { plane.visible = !dotsMode; dot.visible = dotsMode })
  })
  container.appendChild(toggleEl)

  // Load cards
  sb.from('visitor_cards').select('*').order('visitor_number').then(async ({ data }) => {
    if (data) await Promise.all(data.map(addCard))
    if (!meshMap.size) emptyMsg.style.display = ''
  })

  // Realtime
  const rtCh = sb.channel('vc_rt')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_cards' }, ({ new: card }) => addCard(card))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'visitor_cards' }, ({ old })      => removeCard(old.id))
    .subscribe()

  // ── Focus card ──
  let focusOpen = false

  function getMeshRect(mesh) {
    const PW = mesh.geometry?.parameters?.width  ?? PLANE_W
    const PH = mesh.geometry?.parameters?.height ?? PLANE_W
    const corners = [[-PW/2,-PH/2,0],[PW/2,-PH/2,0],[PW/2,PH/2,0],[-PW/2,PH/2,0]]
      .map(([cx,cy,cz]) => new THREE.Vector3(cx,cy,cz))
    const cr = container.getBoundingClientRect()
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity
    corners.forEach(c => {
      c.applyMatrix4(mesh.matrixWorld); c.project(camera)
      const sx=(c.x+1)/2*cr.width+cr.left, sy=(-c.y+1)/2*cr.height+cr.top
      minX=Math.min(minX,sx); maxX=Math.max(maxX,sx); minY=Math.min(minY,sy); maxY=Math.max(maxY,sy)
    })
    return { left: minX, top: minY, width: maxX-minX, height: maxY-minY }
  }

  async function openFocus(card, planeMesh) {
    if (focusOpen) return; focusOpen = true
    const srcRect = getMeshRect(planeMesh)
    const vw = window.innerWidth, vh = window.innerHeight
    const aspect = cardH(card.note) / CARD_W
    let finalW = Math.round(Math.min(vw*.82, 400))
    let finalH = Math.round(finalW * aspect)
    if (finalH > vh*.82) { finalH = Math.round(vh*.82); finalW = Math.round(finalH / aspect) }
    const finalL = Math.round((vw-finalW)/2), finalT = Math.round((vh-finalH)/2)

    const overlay = document.createElement('div')
    overlay.className = 'ff-focus-overlay'
    const card2 = document.createElement('div')
    card2.className = 'ff-focus-card'

    const cardCanvas = document.createElement('canvas')
    await renderCard(cardCanvas, {
      name: card.name, note: card.note, material: card.material,
      color: card.color, inkColor: card.ink_color,
      strokes: JSON.parse(card.signature_data||'[]'),
      visitorNumber: card.visitor_number, createdAt: card.created_at,
    })
    cardCanvas.style.cssText = 'width:100%;height:100%;display:block;'

    const dlBtn = document.createElement('button')
    dlBtn.className = 'ff-focus-dl'; dlBtn.setAttribute('aria-label','Download')
    dlBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0-3-3m3 3 3-3M2 12.5v.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    dlBtn.addEventListener('click', async e => {
      e.stopPropagation()
      const dl = document.createElement('canvas')
      await renderCard(dl, { name:card.name, note:card.note, material:card.material, color:card.color, inkColor:card.ink_color, strokes:JSON.parse(card.signature_data||'[]'), visitorNumber:card.visitor_number, createdAt:card.created_at })
      const a = document.createElement('a'); a.href = dl.toDataURL('image/png')
      a.download = `subtitles-visitor-${String(card.visitor_number).padStart(4,'0')}.png`; a.click()
    })

    let delBtn = null
    if (ADMIN_PASS) {
      delBtn = document.createElement('button')
      delBtn.className = 'vc-admin-del'; delBtn.textContent = '✕ Delete'
      let confirmPending = false, confirmTimer = null
      delBtn.addEventListener('click', async e => {
        e.stopPropagation()
        if (!confirmPending) {
          confirmPending = true; delBtn.textContent = 'Sure?'; delBtn.classList.add('vc-admin-del--confirm')
          confirmTimer = setTimeout(() => { confirmPending=false; delBtn.textContent='✕ Delete'; delBtn.classList.remove('vc-admin-del--confirm') }, 3000)
          return
        }
        clearTimeout(confirmTimer); delBtn.disabled=true; delBtn.textContent='Deleting…'
        const resp = await fetch('/api/admin', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: card.id, password: ADMIN_PASS }) })
        if (resp.ok) { close(); removeCard(card.id) }
        else { delBtn.disabled=false; delBtn.textContent='Failed' }
      })
    }

    card2.appendChild(cardCanvas); card2.appendChild(dlBtn)
    if (delBtn) card2.appendChild(delBtn)
    overlay.appendChild(card2)

    gsap.set(overlay, { backgroundColor: 'rgba(0,0,0,0)' })
    gsap.set(card2, { position:'absolute', left:srcRect.left, top:srcRect.top, width:srcRect.width, height:srcRect.height, borderRadius:3, transformPerspective:1100, rotationX:0, rotationY:0, boxShadow:'0 0px 0px rgba(0,0,0,0)' })
    gsap.set(dlBtn, { opacity: 0 })
    if (delBtn) gsap.set(delBtn, { opacity: 0 })

    document.body.appendChild(overlay)
    overlay.classList.add('ff-focus-overlay--open')

    gsap.to(overlay, { backgroundColor:'rgba(0,0,0,0.65)', duration:.55, ease:'power2.out' })
    gsap.to(card2, { left:finalL, top:finalT, width:finalW, height:finalH, borderRadius:14, rotationX:5, boxShadow:'0 70px 140px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.10),inset 0 1px 0 rgba(255,255,255,0.18)', duration:.7, ease:'expo.inOut' })
    gsap.to(dlBtn, { opacity:1, duration:.2, delay:.55 })
    if (delBtn) gsap.to(delBtn, { opacity:1, duration:.2, delay:.55 })

    card2.addEventListener('mousemove', e => {
      const r=card2.getBoundingClientRect()
      const dx=((e.clientX-r.left)/r.width-.5)*2, dy=((e.clientY-r.top)/r.height-.5)*2
      gsap.to(card2, { rotationX:5-dy*10, rotationY:dx*9, duration:.4, ease:'power2.out', overwrite:'auto' })
    })
    card2.addEventListener('mouseleave', () => gsap.to(card2, { rotationX:5, rotationY:0, duration:.8, ease:'elastic.out(1,.55)', overwrite:'auto' }))

    function close() {
      focusOpen = false
      document.removeEventListener('keydown', onKey)
      overlay.classList.remove('ff-focus-overlay--open')
      const dest = getMeshRect(planeMesh)
      gsap.to([dlBtn, delBtn].filter(Boolean), { opacity:0, duration:.12 })
      gsap.to(overlay, { backgroundColor:'rgba(0,0,0,0)', duration:.45, ease:'power2.in' })
      gsap.to(card2, { left:dest.left, top:dest.top, width:dest.width, height:dest.height, borderRadius:3, rotationX:0, rotationY:0, boxShadow:'0 0px 0px rgba(0,0,0,0)', duration:.55, ease:'expo.inOut', overwrite:'auto', onComplete:()=>overlay.remove() })
    }
    overlay.addEventListener('click', e => { if (e.target===overlay) close() })
    function onKey(e) { if (e.key==='Escape') close() }
    document.addEventListener('keydown', onKey)
  }

  // ── Orbit controls ──
  let rotX=0, rotY=0, targetX=0, targetY=0, velX=0, velY=0
  let dragging=false, prev={x:0,y:0}, dragStartX=0, dragStartY=0
  let cameraTargetZ = GLOBE_R+3
  let entryProgress=0, entryDone=false
  const entryStart = new THREE.Vector3(0,0,55), entryEnd = new THREE.Vector3(0,0,GLOBE_R+3)

  const onMouseDown = e => { if (!entryDone) return; dragging=true; prev.x=dragStartX=e.clientX; prev.y=dragStartY=e.clientY }
  const onMouseUp   = () => { dragging = false }
  const onMouseMove = e => {
    if (!dragging) return
    const dx=e.clientX-prev.x, dy=e.clientY-prev.y
    targetY+=dx*.004; targetX+=dy*.004; velX=dx*.002; velY=dy*.002
    prev.x=e.clientX; prev.y=e.clientY
  }
  const onWheel = e => {
    if (!entryDone || !container.classList.contains('active')) return
    e.preventDefault()
    cameraTargetZ = Math.max(.5, Math.min(30, cameraTargetZ+e.deltaY*.02))
  }
  const onClick = e => {
    if (!entryDone || e.target!==renderer.domElement) return
    if (Math.hypot(e.clientX-dragStartX, e.clientY-dragStartY) > 8) return
    const cr=container.getBoundingClientRect()
    const ray=new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(((e.clientX-cr.left)/cr.width)*2-1, -((e.clientY-cr.top)/cr.height)*2+1), camera)
    const targets = [...meshMap.values()].map(({plane,dot}) => dotsMode ? dot : plane)
    const hit = ray.intersectObjects(targets)[0]; if (!hit) return
    const entry = [...meshMap.values()].find(({plane,dot}) => plane===hit.object||dot===hit.object)
    if (entry) openFocus(entry.plane.userData.card, entry.plane)
  }

  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup',   onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('click',     onClick)
  container.addEventListener('wheel',  onWheel, { passive: false })

  // Touch
  renderer.domElement.style.touchAction = 'none'
  let pinchDist0 = null
  function onTS(e) {
    if (e.touches.length===2) { dragging=false; pinchDist0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY) }
    else { dragStartX=e.touches[0].clientX; dragStartY=e.touches[0].clientY; dragging=true; prev.x=dragStartX; prev.y=dragStartY; pinchDist0=null }
  }
  function onTM(e) {
    e.preventDefault()
    if (e.touches.length===2 && pinchDist0!==null) {
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY)
      cameraTargetZ=Math.max(.5,Math.min(30,cameraTargetZ-(dist-pinchDist0)*.06)); pinchDist0=dist
    } else if (e.touches.length===1 && dragging) {
      const dx=e.touches[0].clientX-prev.x, dy=e.touches[0].clientY-prev.y
      targetY+=dx*.004; targetX+=dy*.004; velX=dx*.002; velY=dy*.002
      prev.x=e.touches[0].clientX; prev.y=e.touches[0].clientY
    }
  }
  function onTE() { dragging=false; pinchDist0=null }
  renderer.domElement.addEventListener('touchstart', onTS, { passive: true })
  renderer.domElement.addEventListener('touchmove',  onTM, { passive: false })
  renderer.domElement.addEventListener('touchend',   onTE)

  // ── Render loop ──
  let rafId = null
  function animate() {
    rafId = requestAnimationFrame(animate)
    if (!entryDone) {
      entryProgress = Math.min(entryProgress+.008, 1)
      camera.position.lerpVectors(entryStart, entryEnd, entryProgress)
      globe.scale.setScalar(THREE.MathUtils.lerp(.3, 1, entryProgress))
      if (entryProgress>=1) { entryDone=true; globe.scale.setScalar(1) }
      renderer.render(scene, camera); return
    }
    camera.position.z += (cameraTargetZ-camera.position.z)*.07
    if (!dragging) { targetY+=velX; targetX+=velY; velX*=.92; velY*=.92 }
    rotX+=(targetX-rotX)*.08; rotY+=(targetY-rotY)*.08
    globe.rotation.x=rotX; globe.rotation.y=rotY
    renderer.render(scene, camera)
  }
  animate()

  const onResize = () => {
    const w=container.clientWidth, h=container.clientHeight
    camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)

  return function cleanup() {
    rtCh.unsubscribe()
    window.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mouseup',   onMouseUp)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('click',     onClick)
    window.removeEventListener('resize',    onResize)
    container.removeEventListener('wheel',  onWheel)
    renderer.domElement.removeEventListener('touchstart', onTS)
    renderer.domElement.removeEventListener('touchmove',  onTM)
    renderer.domElement.removeEventListener('touchend',   onTE)
    if (rafId) cancelAnimationFrame(rafId)
    renderer.dispose()
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export function initVisitor(container) {
  container.innerHTML = ''
  container.classList.add('vc-view')

  const signWrap  = document.createElement('div')
  signWrap.className  = 'vc-section vc-section--sign active'
  const globeWrap = document.createElement('div')
  globeWrap.className = 'vc-section vc-section--globe'
  container.appendChild(signWrap)
  container.appendChild(globeWrap)

  let globeCleanup  = null
  let currentSection = 'sign'

  // Sub-panel (above control panel, fixed)
  const subPanel = document.createElement('div')
  subPanel.className = 'vc-sub-panel'
  subPanel.innerHTML = `
    <button class="vc-tab active" data-tab="sign">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9.5l4.5-7.5M6.5 2l3.5 0m-3.5 0l0 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Sign
    </button>
    <button class="vc-tab" data-tab="globe">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.8" stroke="currentColor" stroke-width="1.2"/><ellipse cx="6" cy="6" rx="2" ry="4.8" stroke="currentColor" stroke-width="1.2"/><path d="M1.2 6h9.6" stroke="currentColor" stroke-width="1.2"/></svg>
      All Cards
    </button>`
  document.body.appendChild(subPanel)

  function showSection(name) {
    if (name === currentSection) return
    currentSection = name
    subPanel.querySelectorAll('.vc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab===name))
    if (name === 'sign') {
      signWrap.classList.add('active'); globeWrap.classList.remove('active')
      signView._setToolbarVisible?.(true)
    } else {
      globeWrap.classList.add('active'); signWrap.classList.remove('active')
      signView._setToolbarVisible?.(false)
      if (!globeCleanup) globeCleanup = buildGlobe(globeWrap)
    }
  }

  subPanel.addEventListener('click', e => {
    const tab = e.target.closest('.vc-tab'); if (!tab) return
    showSection(tab.dataset.tab)
  })

  function onShowGlobe() { showSection('globe') }
  document.addEventListener('visitor:showglobe', onShowGlobe)

  const signView = buildSignView(() => {})
  signWrap.appendChild(signView)

  container._cleanup = () => {
    subPanel.remove()
    globeCleanup?.()
    signView._cleanup?.()
    document.removeEventListener('visitor:showglobe', onShowGlobe)
  }
}
