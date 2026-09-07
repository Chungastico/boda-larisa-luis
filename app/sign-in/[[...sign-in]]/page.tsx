'use client';

import { SignIn } from '@clerk/nextjs';
import { AppClerkProvider } from '@/components/clerk-provider';

export default function SignInPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <AppClerkProvider>
        <SignIn />
      </AppClerkProvider>
    </main>
  );
}
