import { cookies } from "next/headers";
import { authenticate, type Authenticated } from "./auth";
import { COOKIE } from "./http";

/** The signed-in user for a server-rendered page, or null. */
export async function currentUser(): Promise<Authenticated | null> {
  const jar = await cookies();
  return authenticate(jar.get(COOKIE)?.value, "web");
}
