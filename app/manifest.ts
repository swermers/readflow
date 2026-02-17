import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Readflow Library',
    short_name: 'Readflow',
    description: 'Your personal newsletter sanctuary',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff', // Matches your clean white background
    theme_color: '#1A1A1A',      // Matches your brand charcoal
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-touch-readflow-1.png', // The PNGs you created
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
