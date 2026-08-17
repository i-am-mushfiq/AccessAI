import type { MetadataRoute } from 'next';

/** App Router manifest; service-worker registration remains opt-in from Settings. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AccessAI',
    short_name: 'AccessAI',
    description: "Bangladesh's opportunity and benefits assistant",
    start_url: '/bn/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#176b4d',
    lang: 'bn',
  };
}
