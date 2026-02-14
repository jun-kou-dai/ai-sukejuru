const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';

interface TokenInfo {
  accessToken: string;
  expiresAt: number;
}

let tokenInfo: TokenInfo | null = null;

export function getAccessToken(): string | null {
  if (!tokenInfo) return null;
  if (Date.now() >= tokenInfo.expiresAt) {
    tokenInfo = null;
    return null;
  }
  return tokenInfo.accessToken;
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function startLogin(): void {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    prompt: 'consent',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function handleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');

  if (accessToken && expiresIn) {
    tokenInfo = {
      accessToken,
      expiresAt: Date.now() + parseInt(expiresIn, 10) * 1000,
    };
    // Clean hash from URL
    window.history.replaceState(null, '', window.location.pathname);
    return true;
  }
  return false;
}

export function logout(): void {
  tokenInfo = null;
}
