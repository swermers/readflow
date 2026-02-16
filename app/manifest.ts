import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Readflow',
    short_name: 'Readflow',
    description: 'Your personal newsletter sanctuary',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#090d14',
    theme_color: '#090d14',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
