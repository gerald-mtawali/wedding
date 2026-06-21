import { getGalleryImages } from "../../lib/gallery";

const SLOT_COUNT = 3;

export default function Gallery() {
  const images = getGalleryImages().slice(0, SLOT_COUNT);

  // Pad with empty slots so the layout stays balanced before the couple
  // drops in real photos.
  const slots: (string | null)[] = [...images];
  while (slots.length < SLOT_COUNT) slots.push(null);

  return (
    <section className="w-full px-4 sm:px-6 pt-2 pb-12 md:pb-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {slots.map((src, i) =>
          src ? (
            <figure
              key={src}
              className="overflow-hidden bg-beige/20 aspect-[3/4] shadow-sm rounded-2xl"
            >
              <img
                src={src}
                alt={`Gerald & Donella — photo ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-700 ease-out"
              />
            </figure>
          ) : (
            <div
              key={`placeholder-${i}`}
              className="aspect-[3/4] bg-beige/40 border border-beige/60 rounded-2xl flex items-center justify-center text-brown/60 text-xs uppercase tracking-widest"
            >
              Photo
            </div>
          ),
        )}
      </div>

      {images.length === 0 && (
        <p className="mt-6 text-center text-brown/60 text-xs italic">
          Drop three photos into <code>web/src/assets/gallery/</code> to fill
          this section.
        </p>
      )}
    </section>
  );
}
