import { useEffect, useState } from 'react';
import { apiGet } from '../api';

interface GalleryImage {
  imageUrl: string;
  createdAt: number;
}

export function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ images: GalleryImage[] }>('/api/miniapp/gallery')
      .then((data) => setImages(data.images))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">📸 Gallery</h1>
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">📸 Gallery</h1>

      {images.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <p>No photos yet!</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            Ask her for selfies in the chat.
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((img, i) => (
            <div
              key={i}
              className="gallery-item"
              onClick={() => setSelectedImage(img.imageUrl)}
            >
              <img src={img.imageUrl} alt={`Photo ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            ✕
          </button>
          <img src={selectedImage} alt="Full size" />
        </div>
      )}
    </div>
  );
}
