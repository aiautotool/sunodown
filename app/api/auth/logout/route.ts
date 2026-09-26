import { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE } from '@/app/lib/user-auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_COOKIE, '', { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
