import Link from "next/link";
import { requireMember } from "@/lib/auth/current-member";
import { isBoardRole } from "@/lib/authorization/board";

export const dynamic = "force-dynamic";

const SECCIONES = [
  {
    id: "que-se-elige",
    titulo: "1. Qué se elige",
    cuerpo: [
      "Se elige a la persona que ocupará la Presidencia de la Peñita en 2027.",
      "La elección tiene una primera vuelta y, solo si hay empate en primera posición, una segunda vuelta."
    ]
  },
  {
    id: "quien-vota",
    titulo: "2. Quién puede votar",
    cuerpo: [
      "Los 39 miembros de la Peñita, cada uno con su nombre y su contraseña.",
      "Cada miembro emite un único voto por ronda. No hay registro público: nadie puede crear cuentas nuevas."
    ]
  },
  {
    id: "quien-es-opcion",
    titulo: "3. Quién puede aparecer como opción",
    cuerpo: [
      "Cualquier miembro que no haya sido excluido por la Junta Electoral.",
      "Los dos motivos de exclusión son haber sido presidente anteriormente o no asistir a la cena anual de Navidad.",
      "Quien está excluido como opción conserva su derecho a votar."
    ]
  },
  {
    id: "opcion-unica",
    titulo: "4. Cómo se integra la candidatura",
    cuerpo: [
      "Cada miembro votable aparece exactamente una vez en la papeleta.",
      "Si ha presentado candidatura, su opción muestra también el nombre de la candidatura y su eslogan, y permite abrir el detalle con todas sus propuestas.",
      "Una candidatura nunca es una opción de voto independiente: por eso los votos de una persona y de su candidatura no pueden dividirse."
    ]
  },
  {
    id: "sin-candidatura",
    titulo: "5. Miembros sin candidatura",
    cuerpo: [
      "Siguen siendo votables y aparecen igual que el resto, con la indicación “Sin candidatura formal”.",
      "Reciben un color estable propio, que no cambia durante la ronda."
    ]
  },
  {
    id: "primera-vuelta",
    titulo: "6. Cómo funciona la primera vuelta",
    cuerpo: [
      "La Junta Electoral configura la duración y la inicia manualmente: la fecha por sí sola no abre la votación.",
      "La votación se cierra automáticamente al alcanzar su hora de cierre. No existe cierre anticipado.",
      "La hora que decide todo es la del servidor de base de datos, no la de tu móvil."
    ]
  },
  {
    id: "segunda-vuelta",
    titulo: "7. Cuándo hay segunda vuelta",
    cuerpo: [
      "Solo si, una vez publicado el podio, hay empate en primera posición con al menos un voto.",
      "La segunda vuelta es una ronda independiente con las opciones empatadas. La primera vuelta se conserva intacta."
    ]
  },
  {
    id: "presentar",
    titulo: "8. Cómo se presenta una candidatura",
    cuerpo: [
      "Desde la pestaña “Candidatura”: nombre, eslogan y tres propuestas obligatorias (plan de grupo anual, cena de la Semana Grande y cena de Navidad).",
      "Hay seis apartados opcionales: fiesta, evento, casa rural, viaje, escapada de fin de semana y otras premisas.",
      "La Junta Electoral no edita tu texto: si algo hay que corregir, te lo solicita y el cambio lo haces tú."
    ]
  },
  {
    id: "congelacion",
    titulo: "9. Cuándo se congelan las opciones",
    cuerpo: [
      "En el momento exacto de iniciar la votación.",
      "Se guarda una copia del nombre, la candidatura, el eslogan y el color. Cambios posteriores no alteran la papeleta."
    ]
  },
  {
    id: "participacion",
    titulo: "10. Cómo se registra la participación",
    cuerpo: [
      "Se guarda que un miembro ya ha votado, para impedir un segundo voto.",
      "Los totales se muestran de forma agregada, por ejemplo “Han participado 31 de 39 miembros”, y se actualizan con retardo.",
      "Nunca se publica quién ha votado, quién no, en qué orden ni a qué hora. Tampoco lo ve la Junta Electoral."
    ]
  },
  {
    id: "anonimato",
    titulo: "11. Cómo se protege el anonimato",
    cuerpo: [
      "La aplicación registra si un miembro ya ha participado para impedir votos duplicados, pero la papeleta se guarda por separado y no contiene ninguna referencia al votante.",
      "El recuento se obtiene sumando papeletas por opción: no existe ninguna consulta que relacione votante y voto."
    ]
  },
  {
    id: "no-se-guarda",
    titulo: "12. Qué datos no se almacenan",
    cuerpo: [
      "La papeleta no guarda votante, sesión, dirección IP, dispositivo ni marca temporal.",
      "El registro de participación no guarda la opción elegida.",
      "La auditoría recoge acciones administrativas, nunca votos ni contraseñas."
    ]
  },
  {
    id: "revelacion",
    titulo: "13. Cómo funciona la revelación progresiva",
    cuerpo: [
      "Primero se publican las posiciones a partir de la sexta, después los puestos 4 y 5, y por último el podio.",
      "Cada fase es irreversible: una vez publicada no puede ocultarse.",
      "Hasta que una fase se publica, nadie ve esos datos, tampoco la Junta Electoral."
    ]
  },
  {
    id: "empates",
    titulo: "14. Cómo se tratan los empates",
    cuerpo: [
      "Se usa ranking de competición: si dos opciones empatan en primera posición, comparten el puesto 1 y no existe puesto 2.",
      "Las opciones empatadas se revelan siempre juntas y reciben el mismo tratamiento visual.",
      "Si no existe una posición, se explica expresamente en lugar de mostrar huecos vacíos."
    ]
  },
  {
    id: "junta",
    titulo: "15. Qué funciones tiene la Junta Electoral",
    cuerpo: [
      "Fija el plazo de candidaturas, revisa candidaturas y censo, configura e inicia la votación y publica los resultados por fases.",
      "No puede editar candidaturas, ni cerrar la votación antes de hora, ni reiniciar la elección real, ni ver resultados antes de publicarlos."
    ]
  },
  {
    id: "modos",
    titulo: "16. Diferencia entre prueba y elección real",
    cuerpo: [
      "Existe una elección de ensayo, de uso exclusivo de la Junta Electoral, para probar el proceso completo.",
      "Sus datos están separados de los reales: sus votos no cuentan, su participación no te bloquea y su reinicio no afecta a la elección real.",
      "Cuando algo pertenece al ensayo, aparece siempre con el aviso “MODO DE PRUEBA”."
    ]
  }
] as const;

/** Explicación del proceso. Ruta privada y no es una pestaña principal. */
export default async function ComoFuncionaPage() {
  const member = await requireMember();

  return (
    <div className="stack">
      <div className="seccion__titulo">
        <h1>Cómo funciona</h1>
        <span className="chip chip--neutro">{SECCIONES.length} apartados</span>
      </div>

      <nav className="solido tarjeta stack stack--s" aria-label="Índice">
        <span style={{ fontWeight: 600 }}>Índice</span>
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {SECCIONES.map((seccion) => (
            <li key={seccion.id}>
              <Link href={`#${seccion.id}`}>{seccion.titulo}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {SECCIONES.map((seccion) => (
        <section key={seccion.id} id={seccion.id} className="solido tarjeta stack stack--s">
          <h2 style={{ margin: 0 }}>{seccion.titulo}</h2>
          {seccion.cuerpo.map((parrafo) => (
            <p key={parrafo} style={{ margin: 0 }}>
              {parrafo}
            </p>
          ))}
        </section>
      ))}

      <div className="fila">
        <Link href="/eleccion" className="btn btn--principal btn--pequeno">
          Volver a Elección
        </Link>
        <Link href="/eleccion/comparar" className="btn btn--fantasma btn--pequeno">
          Comparar candidaturas
        </Link>
        {isBoardRole(member.role) ? (
          <Link href="/junta-electoral" className="btn btn--fantasma btn--pequeno">
            Junta Electoral
          </Link>
        ) : null}
      </div>
    </div>
  );
}
