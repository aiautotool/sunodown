import { NextRequest, NextResponse } from 'next/server';
import { googleCredentials, OAUTH_STATE_COOKIE } from '@/app/lib/user-auth';

export async function GET(request: NextRequest) {
  try {
    const { clientId } = googleCredentials();
    const state = crypto.randomUUID();
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    const response = NextResponse.redirect(authorize);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: origin.startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL('/?auth=configuration_error', request.url));
  }
}
