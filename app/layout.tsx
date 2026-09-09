import type { Metadata } from 'next';
import './globals.css';

const localSiteUrl = 'http://localhost:3000';
const vercelProductionSiteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;
const vercelDeploymentSiteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : localSiteUrl;

function getMetadataBase() {
  try {
    return new URL(
      vercelProductionSiteUrl || process.env.APP_URL || vercelDeploymentSiteUrl,
    );
  } catch {
    return new URL(vercelProductionSiteUrl || vercelDeploymentSiteUrl);
  }
}

export const metadata: Metadata = {
  title: 'Larissa & Luis | 4 de octubre de 2026',
  description: 'Invitacion de boda de Larissa y Luis.',
  metadataBase: getMetadataBase(),
  openGraph: {
    title: 'Larissa & Luis',
    description: '4 de octubre de 2026',
    images: [{ url: '/footer.png', width: 499, height: 378, alt: 'Larissa y Luis' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Larissa & Luis',
    description: '4 de octubre de 2026',
    images: ['/footer.png'],
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
