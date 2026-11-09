"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "voto" | "candidatura" | "junta";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** Iconos de línea (24x24). Sustituyen a los emoji: tamaño y trazo consistentes. */
function NavIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      {name === "voto" ? (
        <>
          <path d="M4 14h16l-1.4 6H5.4L4 14Z" />
          <path d="M8 14V7.5L13 3l4.5 4.5L13 12" />
          <path d="m10.5 9 4 4" />
        </>
      ) : null}
      {name === "candidatura" ? (
        <>
          <path d="M6 3h9l4 4v14H6V3Z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h7M9 17h5" />
        </>
      ) : null}
      {name === "junta" ? (
        <>
          <path d="M12 3v18M7 21h10" />
          <path d="M5 7h14" />
          <path d="m5 7-3 7a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7Z" />
        </>
      ) : null}
    </svg>
  );
}

/**
 * Navegacion principal.
 *
 * Solo hay dos pestanas para los miembros y tres para la Junta Electoral.
 * "Cómo funciona", el comparador, los resultados y las pruebas se alcanzan
 * desde dentro: nunca son pestanas principales.
 */
const BASE_ITEMS: NavItem[] = [
  { href: "/eleccion", label: "Elección", icon: "voto" },
  { href: "/presentar-candidatura", label: "Candidatura", icon: "candidatura" }
];

const BOARD_ITEM: NavItem = { href: "/junta-electoral", label: "Junta Electoral", icon: "junta" };

export function BottomNav({ isBoard }: { isBoard: boolean }) {
  const pathname = usePathname();
  const items = isBoard ? [...BASE_ITEMS, BOARD_ITEM] : BASE_ITEMS;

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="bottom-nav__enlace"
            aria-current={active ? "page" : undefined}
          >
            <span className="bottom-nav__icono" aria-hidden="true">
              <NavIcon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
