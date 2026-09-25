import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  createAdminSession,
  verifyAdminPassword,
} from '@/app/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = (await request.json()) as { password?: unknown };
    if (typeof password !== 'string' || !(await verifyAdminPassword(password))) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const session = await createAdminSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, session.value, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/admin',
      maxAge: session.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
