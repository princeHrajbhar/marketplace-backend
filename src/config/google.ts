// src/config/google.ts
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { env } from './env';

let googleClient: OAuth2Client | null = null;

export const getGoogleClient = (): OAuth2Client => {
  if (!googleClient) {
    googleClient = new OAuth2Client(env.google.clientId, env.google.clientSecret);
  }
  return googleClient;
};

/**
 * Verifies a Google ID token sent from the frontend.
 * Frontend gets this via: const { credential } = google.accounts.id.initialize(...)
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<TokenPayload> => {
  if (!env.google.clientId) {
    throw new Error('Google OAuth is not configured on this server');
  }

  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Invalid Google token — no payload');
  if (!payload.email) throw new Error('Google account must have an email address');

  return payload;
};
