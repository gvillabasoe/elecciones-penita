import { redirect } from "next/navigation";

/** Ruta de compatibilidad: la pantalla principal es /eleccion. */
export default function InicioPage() {
  redirect("/eleccion");
}
