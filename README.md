# Elecciones a la Presidencia de la Peñita 2027

Aplicación web privada para celebrar las elecciones a la presidencia de la Peñita: presentación de
candidaturas, votación con papeleta congelada, escrutinio por fases con estética televisiva y una
Junta Electoral con control del proceso.

Nombre técnico del proyecto: `elecciones-penita-2027`. Interfaz íntegramente en español.

> **Dos principios que atraviesan todo el diseño**
>
> 1. **Una única opción de voto por miembro.** Una candidatura no es una opción independiente:
>    enriquece la opción de su presidente. Los votos de una persona y de su candidatura no pueden
>    dividirse porque no existen como registros distintos.
> 2. **Separación estricta entre ensayo y elección real.** Cada entidad pertenece a una elección y
>    una ronda con modo `TEST` o `LIVE`. Los datos de prueba y los reales nunca se mezclan.

---

## 1. Qué es y para quién

- 39 miembros con nombre y contraseña propios. No existe registro público: nadie puede crear cuentas.
- Cada miembro puede presentar una candidatura y emitir **un único voto por ronda**.
- La Junta Electoral (presidente y presidente de honor) configura, inicia y publica los resultados.
- Pensada para usarse **desde el móvil**, en persona, durante la cena.

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript estricto |
| Base de datos | PostgreSQL en Neon |
| ORM y migraciones | Prisma (migraciones SQL versionadas) |
| Autenticación | Sesión propia en cookie `httpOnly` firmada con HMAC-SHA256 |
| Hash de contraseñas | bcrypt (`bcryptjs`), coste configurable |
| Validación | Zod, siempre en servidor |
| Estilos | CSS propio con variables (sin framework de utilidades) |
| Pruebas | Vitest sobre funciones puras |
| Despliegue | Vercel |

No se usa Firebase, Supabase, MongoDB, almacenamiento en memoria ni `localStorage` como fuente de verdad.

## 3. Requisitos previos

- Node.js 20.11 o superior (recomendado 22 LTS).
- npm 10 o superior.
- Un proyecto PostgreSQL en Neon, **versión 12 o superior** (las migraciones usan `ALTER TYPE … ADD VALUE`).
- Cuentas de GitHub y Vercel para el despliegue.

## 4. Estructura de rutas

```
/login                              Inicio de sesión
/                                   → /login (sin sesión) o /eleccion (con sesión)
/inicio, /votar                     → /eleccion (redirección de servidor)
/eleccion                           PANTALLA PRINCIPAL: estado, línea temporal,
                                    papeleta, cuentas atrás, participación,
                                    resultados publicados e histórico
/eleccion/comparar                  Comparador neutral de candidaturas
/presentar-candidatura              Candidatura propia y correcciones solicitadas
/candidaturas/[candidacyId]         Ficha pública de una candidatura
/como-funciona                      Explicación del proceso (16 apartados)
/junta-electoral                    Dashboard de la Junta Electoral
/junta-electoral/candidaturas       Revisión, correcciones y plazo
/junta-electoral/censo              Elegibilidad y exclusiones
/junta-electoral/votacion           Duración, inicio, estado e integridad
/junta-electoral/resultados         Publicación por fases (proceso guiado)
/junta-electoral/auditoria          Registro de acciones con filtros
/junta-electoral/pruebas            Simulaciones en modo TEST
/junta-electoral/pruebas/resultados Ensayo de resultados con datos ficticios
/api/election-status                Estado ligero para el refresco (solo LIVE)
/api/participation                  Participación agregada (4 campos)
```

Navegación principal: **Elección** y **Candidatura** para todos; **Junta Electoral** como tercera
pestaña solo para la Junta. El comparador, "Cómo funciona", los resultados y las pruebas se alcanzan
desde dentro: nunca son pestañas principales.

## 5. Estructura del repositorio

```
app/                      Rutas (App Router)
components/
  board/                  Junta Electoral: navegación, votación, stepper,
                          revisión de candidaturas, simulación, ensayo
  candidacy/              Formulario, ficha, tarjeta y comparador
  election/               Cuenta atrás, línea temporal, banda de modo, refresco
  results/                Tablero de resultados y podio dinámico
  voting/                 Papeleta
  ui/                     Switch, hoja de confirmación, botón de envío
lib/
  auth/                   Sesión, contraseñas, miembro actual
  authorization/          Junta Electoral por rol de base de datos
  election/               Estado y modo, rondas, candidaturas, correcciones,
                          exclusiones, participación, línea temporal, auditoría
  results/                Ranking, recuento, máscara por fases, integridad
  testing/                Escenarios ficticios para el ensayo
  theme/                  Paleta, cuenta atrás, pasteles, color de miembro
  time/                   Zona horaria, formatos y presets
  validation/             Esquemas Zod y normalización de texto
  voting/                 Emisión del voto
prisma/                   Esquema, tres migraciones SQL y seed
scripts/check-secrets.mjs Verificación de que no hay secretos en el repo
tests/                    Pruebas unitarias
```

## 6. Variables de entorno

Copia `.env.example` como `.env` y rellena los valores:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión de Neon **con pooling**, usada en runtime |
| `DIRECT_URL` | Sí | Conexión directa de Neon, usada por las migraciones |
| `NEXT_PUBLIC_APP_URL` | Sí | URL pública de la aplicación |
| `AUTH_SECRET` | Sí | Secreto de firma de la cookie de sesión, mínimo 32 caracteres |
| `SESSION_MAX_AGE_SECONDS` | No | Duración de la sesión. Por defecto 43200 (12 h) |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | No | Intentos permitidos por ventana. Por defecto 8 |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | No | Ventana del límite. Por defecto 900 |
| `BCRYPT_COST` | No | Coste de bcrypt. Por defecto 12 |
| `SEED_CREDENTIALS_FILE` | Solo para el seed | Ruta al archivo de credenciales iniciales |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 7. Instalación, migraciones y seed

```bash
npm install                # genera package-lock.json en la primera ejecución
npm run prisma:generate
npm run prisma:deploy      # aplica las tres migraciones con DIRECT_URL
cp prisma/credentials.example.json prisma/credentials.local.json
#   → rellena la contraseña inicial de cada miembro
npm run seed
npm run dev
```

Las migraciones necesitan la **conexión directa**: con pooling fallan los `CREATE TRIGGER`.

El seed crea los 39 miembros con su grafía exacta y **dos elecciones**: la real (`LIVE`) y la de
ensayo (`TEST`), cada una con su primera vuelta en estado pendiente de iniciar y su censo. Es
idempotente y nunca imprime ni almacena contraseñas en claro. Borra
`prisma/credentials.local.json` cuando termines.

## 8. Migraciones

1. `20260916120000_init`: tablas, índices y claves ajenas.
2. `20260916120100_election_integrity`: restricciones y disparadores que Prisma no expresa.
3. `20260916140000_unified_options_and_modes`: modos `TEST`/`LIVE`, opción unificada por miembro y
   solicitudes de corrección.

### Migración al modelo de opción unificada

La tercera migración transforma `RoundBallotOption` en una fila por miembro y ronda:

- Añade `memberNameSnapshot`, `candidacyNameSnapshot`, `sloganSnapshot` y
  `hasFormalCandidacySnapshot`; hace `sourceMemberId` obligatorio; elimina `optionType`,
  `displayNameSnapshot`, `secondaryTextSnapshot` y `presidentNameSnapshot`, y borra el enum
  `BallotOptionType`.
- Rellena los snapshots del miembro y enriquece la fila con su candidatura activa.
- Elimina las opciones de candidatura **que no tienen ninguna papeleta**: el miembro conserva su
  única opción.
- **Protección explícita:** si existe alguna papeleta emitida a una opción de candidatura del modelo
  anterior, la migración se **detiene** con un mensaje claro y no modifica nada. Fusionar esos votos
  alteraría el resultado, así que la decisión es humana: exporta y archiva esa ronda antes de
  migrar. No se borra ningún dato real de forma silenciosa.

## 9. Una única opción de voto por miembro

- Cada miembro elegible aparece **exactamente una vez** en la papeleta de cada ronda.
- Si tiene candidatura activa y válida, su opción muestra nombre del miembro, nombre de la
  candidatura, eslogan, la indicación “Con candidatura”, el color persistente de la candidatura y un
  enlace a su detalle.
- Si no tiene candidatura, aparece igualmente con la indicación “Sin candidatura formal” y un color
  **estable y determinista** derivado de su identificador (`lib/theme/member-color.ts`), que no
  cambia durante la ronda.
- La papeleta es un único grupo de radios: cero o exactamente una opción, nunca más de una. No
  existen selecciones del tipo `member:<id>` ni `candidacy:<id>`.
- Texto principal de la papeleta: *“Selecciona a un miembro. Si ha presentado candidatura, podrás
  consultar también su candidatura y sus propuestas.”*
- La base de datos lo garantiza: `sourceMemberId` obligatorio, único `(roundId, sourceMemberId)`,
  y un disparador que impide que una candidatura enriquezca la opción de otra persona o de otra
  elección.
- Una candidatura marcada como **no válida** por la Junta deja de enriquecer la opción: su
  presidente aparece como miembro sin candidatura formal.

## 10. Modos TEST y LIVE

`ElectionMode` vive en `Election` y, denormalizado e inmutable, en `ElectionRound`. Todo lo demás
(papeletas, participaciones, opciones, temporizadores, fases, auditoría) pertenece a una ronda y
hereda su modo.

| | `LIVE` | `TEST` |
|---|---|---|
| Quién la usa | Todos los miembros | Solo la Junta Electoral |
| Votos | Reales | Ficticios, nunca cuentan |
| Reinicio | **No existe** | “Reiniciar simulación” |
| Cierre anticipado | **No existe** | “Finalizar simulación” |
| Aviso permanente | No | “MODO DE PRUEBA — Los datos mostrados no pertenecen a la elección real.” |

Garantías:

- El modo de una elección y de una ronda es **inmutable** (disparador): una simulación no puede
  convertirse en elección real conservando sus datos.
- Toda Server Action declara el modo y se comprueba **dos veces**: contra la elección correspondiente
  y, en la capa de dominio, contra el modo real de la ronda. Una acción de prueba con el `roundId` de
  una ronda real se rechaza.
- Disparadores adicionales impiden borrar papeletas o participaciones de una ronda `LIVE` y volver una
  ronda `LIVE` al estado inicial.
- Los usuarios ordinarios solo consultan `LIVE`: `/eleccion`, `/api/election-status` y
  `/api/participation` filtran por modo.

**Efecto colateral documentado:** al bloquear el borrado de papeletas y participaciones reales, una
ronda `LIVE` con votos tampoco puede eliminarse en cascada. Los datos reales son de solo añadir.

## 11. Candidaturas

- Nombre, eslogan y presidente (de la sesión, de solo lectura).
- Tres propuestas obligatorias: Plan de grupo anual (con título), Cena de la Semana Grande y Cena de
  Navidad. Seis secciones opcionales con switch: Fiesta, Evento, Casa Rural, Viaje, Escapada de fin
  de semana y Otras premisas.
- Las secciones desactivadas avisan antes de descartar datos, los conservan mientras el formulario
  siga abierto y no se guardan.
- Las fechas son fechas de calendario sin hora: no se desplazan de día por zona horaria.
- Color pastel aleatorio persistente por candidatura (saturación 45–70 %, luminosidad 76–88 %).

### La Junta Electoral no edita candidaturas

Se ha eliminado la edición administrativa del contenido. Antes de iniciar la votación la Junta puede:

- **Solicitar una corrección** motivada (mínimo 10 caracteres), que queda registrada con estado,
  motivo, actor, fecha y acción requerida.
- **Marcar válida** o **marcar no válida**.
- **Eliminar** la candidatura.

El cambio material lo hace siempre el candidato. Si existe una solicitud abierta, el candidato puede
corregir **aunque el plazo ordinario haya terminado** (siempre antes de iniciar la votación); al
guardar, la solicitud queda resuelta y la candidatura vuelve a “Pendiente de revisión”.

## 12. Exclusiones y censo

Dos motivos exclusivos, sin categoría genérica: **presidente anterior** y **ausente de la cena**.
Toda exclusión exige al menos un motivo. Un miembro excluido deja de ser opción votable pero
**conserva su derecho a votar**. La reinclusión es posible mientras la votación no haya empezado.

## 13. Votación

- Inicio **manual**: la fecha configurada no abre la votación por sí sola.
- Al iniciar se congela la papeleta: una opción por miembro votable, con nombre, candidatura,
  eslogan y color copiados en ese instante.
- Un miembro, un voto por ronda, garantizado por una restricción única en base de datos.
- **En `LIVE` no existe cierre anticipado**: la ronda termina exclusivamente al alcanzar su hora de
  cierre. No hay botón, ni Server Action, ni Route Handler para cerrarla antes.
- La confirmación del voto muestra miembro, candidatura, eslogan y los avisos de voto único e
  irreversibilidad.

## 14. Anonimato del voto

- `Ballot` guarda **solo** ronda, opción e identificador aleatorio: sin votante, sesión, IP, user
  agent ni marca temporal.
- `VotingParticipation` guarda solo ronda y miembro, y existe únicamente para impedir un segundo
  voto. No contiene la opción elegida.
- Ambas filas se crean en la misma transacción, sin ningún identificador común.
- El recuento se obtiene por agregación sobre las papeletas. No existe ninguna consulta que
  relacione votante y voto, ni para la Junta Electoral.

Texto que se muestra al miembro: *“La aplicación registra si un miembro ya ha participado para
impedir votos duplicados, pero la papeleta se guarda por separado y no contiene ninguna referencia al
votante.”*

**Limitación conocida y honesta:** quien tenga acceso SQL directo podría intentar correlacionar el
orden físico de las filas o metadatos internos de PostgreSQL. El anonimato es completo frente a la
aplicación, no frente a un administrador de la base de datos.

## 15. Participación agregada

- Formato: “Han participado 31 de 39 miembros.”
- Numerador: filas de `VotingParticipation`. Denominador: miembros activos con **derecho a votar**
  (no se confunde con la elegibilidad para ser elegido).
- Mientras la votación está abierta se sirve de una cache con ventana mínima de **cinco minutos**,
  para que nadie pueda correlacionar una conexión con un incremento. Al cerrar, el total es exacto y
  definitivo.
- Nunca se publican nombres, ausentes, orden de participación ni horas individuales. Tampoco los ve
  la Junta.
- `/api/participation` devuelve exclusivamente `participationCount`, `eligibleVoterCount`,
  `participationPercentage` e `isFinal`.

## 16. Resultados: proceso guiado e irreversible

Los switches quedan reservados a funciones reversibles (las secciones opcionales de una candidatura).
La publicación usa un **stepper** con estado explícito —Pendiente, Disponible, Bloqueado, En
ejecución, Completado, No aplicable— y un botón propio por fase:

1. **Mostrar resultados inferiores** (posiciones 6 y siguientes).
2. **Revelar puestos 4 y 5** (primero el 5, después el 4).
3. **Revelar podio** (tercero, segundo, primero).
4. **Resultado completo publicado.**

Cada acción está protegida en servidor, valida el estado y el paso anterior, es idempotente, usa
actualizaciones condicionales para impedir ejecuciones concurrentes, exige confirmación, registra
actor y fecha, sustituye el botón por “Completado” y **no puede revertirse**.

Texto de confirmación: *“Se publicará la siguiente fase de resultados. Esta acción es irreversible y
no podrá ocultarse de nuevo.”* La confirmación **no** muestra nombres, posiciones, votos,
porcentajes ni el orden futuro.

## 17. Los resultados también están ocultos para la Junta Electoral

No existe ninguna vista previa, ranking privado, top 5 privado, podio privado ni exportación
anticipada. `lib/results/mask.ts` aplica la máscara **en servidor**: al cliente solo viajan los
grupos de la fase ya publicada, nunca ocultos con CSS, props o JSON.

Antes de publicar, la Junta solo dispone de verificaciones de integridad, por ejemplo:

> Recuento completado. Se han registrado 34 participaciones y 34 papeletas válidas.

Incluye ronda cerrada, opciones congeladas, participaciones, papeletas, coincidencia de totales,
papeletas huérfanas y estado de la máquina de revelación. Ningún dato de resultado.

La segunda vuelta solo se habilita cuando el podio **ya es público** y el empate en primera posición
es, por tanto, información publicada: nunca se decide desde una vista privada.

**Nota deliberada:** el stepper no marca “No aplicable” en una fase todavía sin publicar, porque eso
revelaría si existen los puestos 4 y 5. El estado “No aplicable” aparece en el ensayo con datos
ficticios y, ya publicada la fase, en los mensajes de posiciones inexistentes.

## 18. Empates, ranking y posiciones inexistentes

Ranking de competición, equivalente a `RANK()`, nunca `DENSE_RANK()`: `1, 1, 3` · `1, 2, 2, 4` ·
`1, 1, 1, 4` · `1, 1, 1, 1` · `1, 2, 3, 3, 5`.

- Los empates comparten posición, fase y tratamiento visual, y se revelan juntos.
- El alfabeto solo ordena visualmente opciones que **ya** comparten posición.
- Si un empate cruza el límite del top 5, todo el grupo queda oculto en la primera fase: un empate
  nunca se divide entre dos fases.
- Solo aparecen opciones con al menos un voto.

Cuando una posición no existe se dice expresamente, sin tarjetas vacías ni ganadores inventados:

- “No existe segundo puesto debido al empate en primera posición.”
- “No existe tercer puesto debido al empate en segunda posición.”
- “No hay opciones clasificadas en cuarto puesto.” / “…en quinto puesto.”
- “Todas las opciones de esta fase ya se han revelado.”
- “No existen resultados que revelar en esta fase.”

**Podio dinámico:** posición 1 oro `#D4AF37`, 2 plata `#AEB6BF`, 3 bronce `#CD7F32`. Si varias
opciones comparten posición, todas reciben el mismo metal, aparecen al mismo nivel y se muestra
“Empate en primera posición” sin declarar un ganador único. Las fases se determinan por posiciones,
no por número de tarjetas.

## 19. Línea temporal

Visible en `/eleccion` y en el dashboard de la Junta. Siete fases derivadas de la máquina de estados
real (no hay estado visual paralelo): presentación de candidaturas, revisión, primera vuelta,
preparación de resultados, revelación, segunda vuelta **condicional** y resultado final.

Cada fase muestra icono, texto y estado —Completada, En curso, Pendiente, Bloqueada, Condicional, No
necesaria— y la próxima acción. La segunda vuelta solo pasa a “No necesaria” cuando el resultado
público descarta el empate; antes es “Condicional”. Las fechas proceden de PostgreSQL y se muestran
en `Europe/Madrid`. Funciona a 320 px, sin scroll horizontal y sin depender del color.

## 20. Comparador neutral

`/eleccion/comparar`, privado aunque se comparta la URL. Permite elegir dos candidaturas,
sustituirlas y abrir su detalle. Orden fijo de 12 categorías: nombre, eslogan, presidente, plan de
grupo anual, cena de la Semana Grande, cena de Navidad, fiesta, evento, casa rural, viaje, escapada
de fin de semana y otras premisas.

Cuando una sección opcional no existe, la categoría sigue apareciendo con el texto **“No incluida en
esta candidatura.”**. Se muestra el contenido original, sin resumir. No puntúa, no recomienda, no
ordena por calidad ni popularidad, no muestra likes, encuestas ni intención de voto, y no destaca
ninguna candidatura. En móvil la comparación es vertical, con acordeones y sin tablas anchas.

## 21. Ensayo de resultados con datos ficticios

`/junta-electoral/pruebas/resultados` reproduce 15 escenarios con nombres inventados (Opción A,
Candidatura Norte, Centro, Sur): resultado normal, empates en primera, segunda y tercera posición,
empate múltiple, menos de cinco opciones, una sola opción, ninguna opción con votos, ausencia de
cuarto y de quinto puesto, segunda vuelta, segunda vuelta empatada, muchas opciones, textos largos y
movimiento reducido.

Usa **las mismas funciones puras** de ranking y máscara que la elección real, calculadas en memoria.
No lee papeletas reales, no copia tablas `LIVE`, no escribe en la auditoría real y no crea ninguna
segunda vuelta. Permite avanzar por fases, reiniciar, repetir la animación y activar movimiento
reducido.

## 22. Hora autoritativa de PostgreSQL

Todas las decisiones temporales críticas usan `NOW()` de PostgreSQL, obtenido dentro de la misma
transacción: plazo de candidaturas, inicio de ronda, cálculo de `votingClosesAt`, aceptación o
rechazo de votos, cierre, cuenta atrás de resultados, habilitación de fases, auditoría y
transiciones de estado. El cierre de rondas vencidas se aplica con una única sentencia condicional
`UPDATE … WHERE "votingClosesAt" <= NOW()`, idempotente y segura frente a concurrencia.

No se usa como fuente autoritativa la hora del navegador, `Date.now()` del cliente, el reloj del
dispositivo, la hora local de una instancia de Vercel, el contador visual ni valores enviados por el
cliente. Los instantes se almacenan en UTC y se muestran en `Europe/Madrid`.

El cliente recibe la hora de referencia y la hora objetivo del servidor y solo corrige su propio
desfase para **pintar** la cuenta atrás. La cuenta atrás visual no concede permisos: al llegar a
cero se bloquea la acción y se revalida contra el servidor, que rechaza el voto cuando
`databaseNow >= votingClosesAt`.

### Tramos de color de la cuenta atrás

| Tiempo restante | Color |
|---|---|
| más de 5:00 | `#00AD8C` |
| 5:00 a más de 2:00 | `#F7BD63` |
| 2:00 a más de 1:00 | `#F89D55` |
| 1:00 a más de 0:30 | `#F2664A` |
| 0:30 a 0:00 | `#7B3F50` |

Los límites son exactos: el segundo 300 ya es amarillo y el 30 ya es granate. A los lectores de
pantalla solo se anuncian los hitos de 5 min, 2 min, 1 min, 30 s y el final.

## 23. Transiciones atómicas

Bloqueo de fila (`SELECT … FOR UPDATE`) y transacción en cada transición, más actualizaciones
condicionales. Protege contra dos inicios o dos cierres simultáneos, un voto coincidente con el
cierre, dos revelaciones simultáneas, diferencias horarias entre instancias, navegadores adelantados
o atrasados, creación duplicada de segunda vuelta y acciones `TEST` sobre datos `LIVE`.

## 24. Independencia de animaciones y transparencias

Las animaciones son una mejora visual: nunca calculan posiciones, determinan fases, guardan
resultados, validan estados, desbloquean acciones, ocultan información ni deciden qué está
publicado. Todos los resultados tienen versión estática y se respeta `prefers-reduced-motion`.

Liquid Glass es secundario. La papeleta, la confirmación del voto, los formularios, la información de
anonimato, la auditoría, los resultados numéricos, los errores y las acciones administrativas usan
**superficies sólidas** (`.solido`). La ausencia de `backdrop-filter`, blur, transparencia, reflejos o
gradientes no afecta a legibilidad, contraste, jerarquía, navegación ni ejecución de acciones. Se
respetan también `prefers-reduced-transparency` y `prefers-contrast`.

## 25. Diseño y accesibilidad

Fondo blanco, cristal translúcido al estilo iOS 26/27 y estética de escrutinio televisivo. Paleta:
principal `#1A4756`, switch activo `#00AD8C`, exclusiones `#7B3F50`, switch inactivo `#DDE3E5`.
Mobile-first de 320 a 430 px, objetivos táctiles de 44 px o más, áreas seguras respetadas y sin
scroll horizontal.

Switches con `role="switch"` y `aria-checked`; motivos de exclusión con `aria-pressed`; papeleta como
grupo de radios con leyenda; diálogos con `role="dialog"`, `aria-modal`, foco gestionado y cierre con
Escape; avisos con `role="alert"` y estados con `role="status"`; campos a 17 px para evitar el zoom
de iOS.

## 26. Refresco de la pantalla

Sin websockets: `/api/election-status` se consulta cada 5 segundos y solo recarga los datos del
servidor cuando cambia el estado de la ronda o la fase de resultados. Ese endpoint consolida además
el cierre de las rondas vencidas, de modo que no se depende de ningún cron.

## 27. Roles y permisos

| Rol | Quién | Permisos |
|---|---|---|
| `PRESIDENT` | Iñigo Gomeza | Junta Electoral |
| `HONORARY_PRESIDENT` | Gonzalo Villabaso | Junta Electoral |
| `MEMBER` | Los otros 37 | Presentar candidatura y votar |

Los permisos se derivan **siempre del rol almacenado en base de datos**, releído en cada petición.
Todas las rutas de la Junta se protegen en servidor y cada Server Action vuelve a verificar sesión,
rol, modo, elección, ronda y estado: ocultar enlaces o deshabilitar botones nunca es suficiente.

## 28. Pruebas y verificación

```bash
npm run test          # Vitest
npm run typecheck     # TypeScript en modo estricto
npm run lint          # ESLint
npm run prisma:validate
npm run check:secrets # ninguna contraseña ni hash en el repositorio
npm run verify        # todo lo anterior seguido
```

Cubren: tramos exactos de la cuenta atrás; ranking de competición con los cinco patrones y sin
`DENSE_RANK`; visibilidad por fases y empate que cruza el top 5; máscara de resultados (nada oculto
viaja al cliente, ni siquiera serializado); posiciones inexistentes y sus mensajes; empate en primera
posición; línea temporal y su segunda vuelta condicional sin filtraciones; los 15 escenarios
ficticios; color determinista de miembro; búsqueda tolerante a tildes; rangos de fechas; opción
unificada en la papeleta (se rechazan las selecciones por tipo del modelo anterior); y el modo
obligatorio en cada acción, con reinicio limitado a `TEST`.

## 29. Seguridad

- bcrypt de coste 12 y comparación en tiempo constante frente a un hash señuelo.
- Cookie de sesión `httpOnly`, `secure`, `sameSite=lax`, firmada con HMAC-SHA256.
- Validación con Zod en todas las Server Actions, además de la del cliente.
- Cabeceras de seguridad en `next.config.mjs`.
- Bloqueos de fila y transacciones en todas las transiciones.
- Restricciones y disparadores en base de datos como última línea de defensa.

**Recomendación importante:** las contraseñas iniciales siguen un patrón derivable de los nombres
públicos. Cambia a contraseñas aleatorias en cuanto todos hayan entrado por primera vez.

## 30. Despliegue en Vercel

1. Sube el repositorio a GitHub, con `package-lock.json` incluido.
2. Importa el proyecto en Vercel; el framework se detecta automáticamente.
3. Define las variables del apartado 6 en Production y Preview.
4. El comando de build ya ejecuta `prisma generate`.
5. Aplica las migraciones contra Neon con `npm run prisma:deploy` y `DIRECT_URL` de producción.
6. Ejecuta el seed una sola vez, desde tu máquina y con el archivo de credenciales local.

## 31. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `No existe la elección…` | Falta el seed: ejecuta `npm run seed` |
| Error de migración con triggers | Estás usando la cadena con pooling: usa `DIRECT_URL` |
| `Migracion detenida: hay N papeletas…` | Hay votos del modelo antiguo: archiva esa ronda (apartado 8) |
| `El modo de una eleccion no puede cambiarse` | Correcto: `TEST` y `LIVE` son inmutables |
| `Esta acción solo puede aplicarse a una ronda de prueba.` | Se intentó una acción `TEST` sobre datos reales |
| `Las papeletas de una eleccion real no pueden eliminarse` | Correcto: en `LIVE` no hay reinicio |
| El primer paso del stepper no se activa | La votación sigue abierta o la cuenta atrás no ha terminado |
| “Crear segunda vuelta” no aparece | El podio aún no es público, o no hay empate, o ya existe |
| La papeleta no refleja una exclusión | Se hizo después de iniciar: la papeleta está congelada |
| `AUTH_SECRET` demasiado corto | Genera uno de al menos 32 caracteres |
| `Demasiados intentos` al entrar | Límite de intentos: espera la ventana configurada |

## 32. Checklist de entrega

- [x] Una opción por miembro
- [x] Candidatura integrada
- [x] Sin división de votos
- [x] TEST separado
- [x] LIVE sin reinicio
- [x] Sin switches irreversibles
- [x] Ruta `/eleccion`
- [x] `/votar` redirige
- [x] Pantalla Cómo funciona
- [x] Línea temporal
- [x] Comparador neutral
- [x] Participación agregada
- [x] Simulaciones ficticias
- [x] Junta en subpáginas
- [x] Resultados ocultos para Junta
- [x] Empates tratados correctamente
- [x] Hora autoritativa PostgreSQL
- [x] Sin cierre anticipado LIVE
- [x] Funciones independientes de animaciones
- [x] Funciones independientes de transparencias
- [x] README actualizado
- [x] Pruebas actualizadas
- [x] Requisitos incompatibles eliminados

## 33. Versionado y privacidad

Versionado semántico; la versión vive en `package.json`, `CHANGELOG.md` y el nombre del ZIP de
entrega. Aplicación privada de uso interno: contiene nombres de personas reales, así que no publiques
la base de datos, los volcados ni el archivo de credenciales.
