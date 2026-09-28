import { NextRequest, NextResponse } from 'next/server';
import { createUserSession, googleCredentials, OAUTH_STATE_COOKIE, USER_COOKIE, type AuthUser } from '@/app/lib/user-auth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?auth=${encodeURIComponent(reason)}`, url.origin));
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const savedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
    if (!code || !state || !savedState || state !== savedState) return fail('invalid_state');
    const { clientId, clientSecret } = googleCredentials();
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) return fail('token_exchange_failed');
    const tokens = await tokenResponse.json() as { access_token?: string };
    if (!tokens.access_token) return fail('missing_access_token');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) return fail('profile_failed');
    const profile = await profileResponse.json() as AuthUser & { email_verified?: boolean };
    if (!profile.sub || !profile.email || !profile.email_verified) return fail('email_not_verified');
    const session = await createUserSession({ sub: profile.sub, email: profile.email, name: profile.name || profile.email, picture: profile.picture });
    const response = NextResponse.redirect(new URL('/?auth=success', url.origin));
    response.cookies.set(USER_COOKIE, session.value, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: session.maxAge });
    response.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch {
    return fail('login_failed');
  }
}
