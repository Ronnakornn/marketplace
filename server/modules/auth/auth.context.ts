import type { Role, UserStatus } from "#generated/client/enums.ts";
import { auth } from "./auth.ts";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
}

export interface AuthContext {
  user: SessionUser;
}

export async function getAuthContext(headers: Headers): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  return {
    user: session.user as SessionUser,
  };
}
