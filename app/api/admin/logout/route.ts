import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/app/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/admin',
    maxAge: 0,
  });
  return response;
}
