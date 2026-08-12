import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { hashToken, randomToken } from "./crypto";

export const SESSION_COOKIE = "cth_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
};

export async function createMagicLink(email: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Invalid email");
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
  await query(
    `INSERT INTO auth_magic_links (email, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [normalized, tokenHash, expiresAt.toISOString()]
  );
  return { token, expiresAt };
}

export async function consumeMagicLink(token: string): Promise<AuthUser | null> {
  const tokenHash = hashToken(token);
  const row = await queryOne<{
    id: string;
    email: string;
    expires_at: string;
    consumed_at: string | null;
  }>(
    `SELECT id, email, expires_at, consumed_at FROM auth_magic_links WHERE token_hash = $1`,
    [tokenHash]
  );
  if (!row || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE auth_magic_links SET consumed_at = now() WHERE id = $1`, [row.id]);

  let user = await queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM app_users WHERE email = $1`,
    [row.email]
  );
  if (!user) {
    user = await queryOne<{ id: string; email: string }>(
      `INSERT INTO app_users (email) VALUES ($1) RETURNING id, email`,
      [row.email]
    );
    if (user) {
      await query(
        `INSERT INTO alert_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [user.id]
      );
      await query(
        `INSERT INTO user_workspace (user_id, payload) VALUES ($1, '{}'::jsonb)
         ON CONFLICT DO NOTHING`,
        [user.id]
      );
    }
  }
  return user;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESSION_DAYS);
  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );
  return token;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = await queryOne<{ id: string; email: string; expires_at: string }>(
      `SELECT u.id, u.email, s.expires_at
       FROM auth_sessions s
       JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [tokenHash]
    );
    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    return { id: row.id, email: row.email };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return;
    await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [hashToken(token)]);
  } catch {
    /* ignore */
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
