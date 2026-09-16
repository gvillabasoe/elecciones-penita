import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/current-member";

export const dynamic = "force-dynamic";

export default async function RaizPage() {
  const member = await getCurrentMember();
  redirect(member ? "/eleccion" : "/login");
}
