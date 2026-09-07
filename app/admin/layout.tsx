'use client';

import { AppClerkProvider } from '@/components/clerk-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppClerkProvider>{children}</AppClerkProvider>;
}
