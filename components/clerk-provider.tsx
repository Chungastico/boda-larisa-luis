'use client';

import dynamic from 'next/dynamic';

const BrowserClerkProvider = dynamic(
  () => import('@/components/clerk-provider-browser').then((module) => module.BrowserClerkProvider),
  { ssr: false },
);

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return <BrowserClerkProvider>{children}</BrowserClerkProvider>;
}
