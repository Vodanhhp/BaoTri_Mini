import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  images: string[]
  initialIndex: number
  title?: string
  onClose: () => void
}

export default function ImageLightbox({ images, initialIndex, title = 'Xem ảnh', onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(initialIndex, images.length - 1)))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (images.length > 1 && event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex(index => (index + images.length - 1) % images.length)
      } else if (images.length > 1 && event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex(index => (index + 1) % images.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [images.length, onClose])

  if (!images.length) return null
  const activeImage = images[activeIndex]
  if (!activeImage) return null

  return (
    <div className="image-lightbox-backdrop" onClick={onClose}>
      <section className="image-lightbox-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <button type="button" className="image-lightbox-close" aria-label="Đóng ảnh" title="Đóng (Esc)" onClick={onClose}><X size={22}/></button>
        {images.length > 1 && <button type="button" className="image-lightbox-nav image-lightbox-prev" aria-label="Ảnh trước" title="Ảnh trước (←)" onClick={() => setActiveIndex(index => (index + images.length - 1) % images.length)}><ChevronLeft size={26}/></button>}
        <div className="image-lightbox-image-wrap">
          <img className="image-lightbox-image" src={activeImage} alt={title + ' ' + (activeIndex + 1)} />
        </div>
        {images.length > 1 && <button type="button" className="image-lightbox-nav image-lightbox-next" aria-label="Ảnh tiếp theo" title="Ảnh tiếp theo (→)" onClick={() => setActiveIndex(index => (index + 1) % images.length)}><ChevronRight size={26}/></button>}
        <div className="image-lightbox-caption">{title} · {activeIndex + 1}/{images.length}</div>
      </section>
    </div>
  )
}
