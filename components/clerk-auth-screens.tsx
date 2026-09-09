'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { BrowserClerkProvider } from '@/components/clerk-provider-browser';

export function BrowserSignIn() {
  return (
    <BrowserClerkProvider>
      <SignIn />
    </BrowserClerkProvider>
  );
}

export function BrowserSignUp() {
  return (
    <BrowserClerkProvider>
      <SignUp />
    </BrowserClerkProvider>
  );
}
