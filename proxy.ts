import { clerkMiddleware } from '@clerk/nextjs/server';

function isAdminResource(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
}

export default clerkMiddleware(async (auth, request) => {
  if (isAdminResource(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/sign-in/:path*',
    '/sign-up/:path*',
    '/__clerk/:path*',
  ],
};
