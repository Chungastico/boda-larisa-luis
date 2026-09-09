import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Larissa & Luis | 4 de octubre de 2026',
  description: 'Invitacion de boda de Larissa y Luis.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Larissa & Luis',
    description: '4 de octubre de 2026',
    images: [{ url: '/og.png', width: 1680, height: 940, alt: 'Larissa y Luis' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Larissa & Luis',
    description: '4 de octubre de 2026',
    images: ['/og.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg?v=2', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.svg?v=2', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/favicon.svg?v=2',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
