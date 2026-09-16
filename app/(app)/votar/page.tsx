import { redirect } from "next/navigation";

/**
 * Redireccion de servidor.
 *
 * La pantalla principal es /eleccion. Esta ruta se mantiene solo para no
 * romper enlaces antiguos y no contiene ninguna implementacion propia.
 */
export default function VotarPage() {
  redirect("/eleccion");
}
