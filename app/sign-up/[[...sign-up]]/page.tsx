import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10">
      <SignUp />
    </main>
  );
}
