'use client';

import { SignUp } from '@clerk/nextjs';
import { AppClerkProvider } from '@/components/clerk-provider';

export default function SignUpPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <AppClerkProvider>
        <SignUp />
      </AppClerkProvider>
    </main>
  );
}
