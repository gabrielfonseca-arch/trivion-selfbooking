import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export type Role = "admin" | "coordinator" | "sdr";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  avatarColor: string | null;
};

const COOKIE_NAME = "trivion_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria sessão no banco + cookie assinado (JWT) contendo o id da sessão. */
export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [session] = await db
    .insert(sessions)
    .values({ userId, tokenHash, expiresAt })
    .returning();

  const jwt = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sid = payload.sid as string | undefined;
      if (sid) {
        await db.delete(sessions).where(eq(sessions.id, sid));
      }
    } catch {
      // token inválido - apenas limpa o cookie
    }
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Retorna o usuário autenticado (via cookie + sessão válida no banco) ou null. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let sid: string | undefined;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    sid = payload.sid as string | undefined;
  } catch {
    return null;
  }
  if (!sid) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      avatarColor: users.avatarColor,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active") return null;

  return {
    id: row.userId,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status,
    avatarColor: row.avatarColor,
  };
}

/** Exige usuário autenticado; redireciona para /login caso contrário. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Exige que o usuário autenticado tenha um dos perfis informados. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/");
  }
  return user;
}
