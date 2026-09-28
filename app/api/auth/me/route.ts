import { NextRequest, NextResponse } from 'next/server';
import { readUserSession } from '@/app/lib/user-auth';

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: await readUserSession(request) }, { headers: { 'cache-control': 'no-store' } });
}
