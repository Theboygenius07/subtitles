import { cloudinaryUrl, downloadPhoto, formatSubtitle } from '../utils.js'

let photos = []
let currentIndex = 0
let modal = null
let overlay = null

export function initModal() {
  overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal()
  })

  modal = document.createElement('div')
  modal.className = 'modal'
  modal.innerHTML = `
    <button class="modal-close" aria-label="Close">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="modal-nav modal-prev" aria-label="Previous">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M12 4l-8 6 8 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="modal-media">
      <img class="modal-img" alt="" />
    </div>
    <div class="modal-info">
      <div class="modal-subtitle-wrap"></div>
      <p class="modal-context"></p>
      <button class="modal-download">Download</button>
    </div>
    <button class="modal-nav modal-next" aria-label="Next">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M8 4l8 6-8 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `

  overlay.appendChild(modal)
  document.body.appendChild(overlay)

  modal.querySelector('.modal-close').addEventListener('click', closeModal)
  modal.querySelector('.modal-prev').addEventListener('click', () => navigate(-1))
  modal.querySelector('.modal-next').addEventListener('click', () => navigate(1))
  modal.querySelector('.modal-download').addEventListener('click', handleDownload)

  document.addEventListener('keydown', handleKey)
}

function handleKey(e) {
  if (!overlay.classList.contains('open')) return
  if (e.key === 'Escape') closeModal()
  if (e.key === 'ArrowLeft') navigate(-1)
  if (e.key === 'ArrowRight') navigate(1)
}

function navigate(dir) {
  currentIndex = (currentIndex + dir + photos.length) % photos.length
  render()
}

function render() {
  const photo = photos[currentIndex]
  const img = modal.querySelector('.modal-img')
  img.src = cloudinaryUrl(photo.cloudinary_url, Math.round(window.innerWidth * 0.75))
  img.alt = `Week ${photo.week}`

  const wrap = modal.querySelector('.modal-subtitle-wrap')
  wrap.innerHTML = ''
  wrap.appendChild(formatSubtitle(photo.subtitle))

  const ctx = modal.querySelector('.modal-context')
  ctx.textContent = photo.context || ''
  ctx.style.display = photo.context ? 'block' : 'none'

  modal.querySelector('.modal-prev').style.opacity = photos.length > 1 ? '1' : '0'
  modal.querySelector('.modal-next').style.opacity = photos.length > 1 ? '1' : '0'
}

async function handleDownload() {
  const photo = photos[currentIndex]
  const num = String(photo.week).padStart(2, '0')
  await downloadPhoto(photo.cloudinary_url, `week-${num}.jpg`)
}

export function openModal(allPhotos, index) {
  photos = allPhotos
  currentIndex = index
  render()
  overlay.classList.add('open')
  document.body.style.overflow = 'hidden'
}

export function closeModal() {
  overlay.classList.remove('open')
  document.body.style.overflow = ''
}
