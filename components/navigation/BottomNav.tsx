"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

/**
 * Navegacion principal.
 *
 * Solo hay dos pestanas para los miembros y tres para la Junta Electoral.
 * "Cómo funciona", el comparador, los resultados y las pruebas se alcanzan
 * desde dentro: nunca son pestanas principales.
 */
const BASE_ITEMS: NavItem[] = [
  { href: "/eleccion", label: "Elección", icon: "🗳" },
  { href: "/presentar-candidatura", label: "Candidatura", icon: "📝" }
];

const BOARD_ITEM: NavItem = { href: "/junta-electoral", label: "Junta Electoral", icon: "⚖️" };

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
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
