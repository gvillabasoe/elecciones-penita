"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth/session";

/** Cierre de sesion real: borra la cookie y vuelve al login. */
export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
