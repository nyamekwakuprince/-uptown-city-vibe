import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { EventRow, GalleryImage } from '../lib/types'

export default function Gallery() {
  const { eventId } = useParams()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'uptown-city-vibe').single()
      if (!org) return
      const [{ data: imageData }, { data: eventData }] = await Promise.all([
        supabase
          .from('gallery_images')
          .select('*')
          .eq('organization_id', org.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*')
          .eq('organization_id', org.id)
          .is('deleted_at', null)
          .lt('start_datetime', new Date().toISOString())
          .order('start_datetime', { ascending: false }),
      ])
      setImages((imageData as GalleryImage[]) ?? [])
      setEvents((eventData as EventRow[]) ?? [])
    }
    load()
  }, [])

  const eventGalleries = events
    .map((event) => ({ event, images: images.filter((image) => image.event_id === event.id) }))
    .filter((gallery) => gallery.images.length > 0)
  const selectedGallery = eventGalleries.find((gallery) => gallery.event.id === eventId)
  const activeGallery = eventGalleries.find((gallery) => gallery.event.id === activeEventId)
  const activeImage = activeGallery?.images[activeIndex]

  function openPhoto(eventId: string, imageIndex: number) {
    setActiveEventId(eventId)
    setActiveIndex(imageIndex)
  }

  function closeGallery() {
    setActiveEventId(null)
    setActiveIndex(0)
  }

  function movePhoto(direction: number) {
    if (!activeGallery) return
    setActiveIndex((current) => (current + direction + activeGallery.images.length) % activeGallery.images.length)
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="display text-3xl text-paper">Past Events</h1>
      <p className="mt-2 text-muted">Moments from our events.</p>

      {selectedGallery ? (
        <section className="mt-8">
          <h2 className="display text-3xl text-paper">{selectedGallery.event.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {new Date(selectedGallery.event.start_datetime).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {selectedGallery.images.map((image, index) => (
              <button key={image.id} onClick={() => openPhoto(selectedGallery.event.id, index)} className="aspect-square overflow-hidden rounded-xl bg-surface">
                <img src={image.image_url} alt={image.caption ?? selectedGallery.event.title} className="h-full w-full object-cover transition hover:scale-105" />
              </button>
            ))}
          </div>
        </section>
      ) : <p className="mt-8 text-muted">Event photos not found.</p>}

      {activeImage && activeGallery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={closeGallery}>
            <div className="relative flex w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
              {activeGallery.images.length > 1 && (
                <button type="button" onClick={() => movePhoto(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/70 text-4xl leading-none text-white shadow-lg transition hover:bg-flame hover:text-ink sm:left-4">‹</button>
              )}
              <div className="max-w-3xl px-2 text-center">
                <img src={activeImage.image_url} alt={activeImage.caption ?? activeGallery.event.title} className="max-h-[78vh] rounded-lg object-contain" />
                <p className="mt-3 text-sm text-muted">{activeGallery.event.title} · {activeIndex + 1} of {activeGallery.images.length}</p>
                {activeImage.caption && <p className="mt-1 text-paper">{activeImage.caption}</p>}
              </div>
              {activeGallery.images.length > 1 && (
                <button type="button" onClick={() => movePhoto(1)} aria-label="Next photo" className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/70 text-4xl leading-none text-white shadow-lg transition hover:bg-flame hover:text-ink sm:right-4">›</button>
              )}
            </div>
          </div>
      )}
    </div>
  )
}

