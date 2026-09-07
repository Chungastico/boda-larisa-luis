import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <SignIn />
    </main>
  );
}
