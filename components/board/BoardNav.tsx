"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Navegacion interna de la Junta Electoral. No anade pestanas principales. */
const ITEMS = [
  { href: "/junta-electoral", label: "Resumen" },
  { href: "/junta-electoral/candidaturas", label: "Candidaturas" },
  { href: "/junta-electoral/censo", label: "Censo" },
  { href: "/junta-electoral/votacion", label: "Votación" },
  { href: "/junta-electoral/resultados", label: "Resultados" },
  { href: "/junta-electoral/auditoria", label: "Auditoría" },
  { href: "/junta-electoral/pruebas", label: "Pruebas" }
] as const;

export function BoardNav() {
  const pathname = usePathname();

  return (
    <nav className="sub-nav" aria-label="Secciones de la Junta Electoral">
      {ITEMS.map((item) => {
        const active =
          item.href === "/junta-electoral"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "sub-nav__enlace sub-nav__enlace--activo" : "sub-nav__enlace"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
