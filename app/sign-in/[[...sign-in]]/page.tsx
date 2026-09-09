'use client';

import dynamic from 'next/dynamic';

const BrowserSignIn = dynamic(
  () => import('@/components/clerk-auth-screens').then((module) => module.BrowserSignIn),
  { ssr: false },
);

export default function SignInPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <BrowserSignIn />
    </main>
  );
}
