'use client';

import dynamic from 'next/dynamic';

const BrowserSignUp = dynamic(
  () => import('@/components/clerk-auth-screens').then((module) => module.BrowserSignUp),
  { ssr: false },
);

export default function SignUpPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <BrowserSignUp />
    </main>
  );
}
