const DPR = Math.min(window.devicePixelRatio || 1, 3)

export function cloudinaryUrl(baseUrl, width, quality = 'auto:best') {
  const w = Math.round(width * DPR)
  return baseUrl.replace('/upload/', `/upload/w_${w},q_${quality},f_auto,c_limit/`)
}

export async function downloadPhoto(url, filename) {
  const res = await fetch(url)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function formatSubtitle(text) {
  const el = document.createElement('div')
  el.className = 'subtitle'
  const isDialogue = text.trim().startsWith('—')
  if (isDialogue) {
    el.classList.add('dialogue')
    text.split(/\n/).filter(Boolean).forEach(line => {
      const span = document.createElement('span')
      span.className = 'subtitle-line'
      span.textContent = line.trim()
      el.appendChild(span)
    })
  } else {
    el.textContent = text
  }
  return el
}
