# Registro de cambios

Todas las versiones relevantes de **Elecciones a la Presidencia de la Peñita 2027**.
Formato basado en Keep a Changelog. Versionado semántico.

## [0.2.1] — 2026-09-16

Corrección de tres errores que impedían compilar en Vercel.

### Corregido
- `components/board/BoardAction.tsx` importaba el tipo `BoardActionState` del archivo de Server
  Actions, que tras la 0.2.0 exportaba ese contrato con otro nombre. El tipo pasa a vivir en
  `lib/election/action-state.ts`, fuera de los archivos `"use server"`, que solo deberían exportar
  funciones asíncronas. `CandidacyActionState` se mueve al mismo módulo.
- `lib/election/candidacy.ts` reexportaba `PROPOSAL_LABELS` desde `proposal-labels.ts`, pero además
  lo usa en los mensajes de validación: un reexport no introduce el nombre en el ámbito del módulo.
  Ahora se importa y se reexporta, así que la referencia existe en tiempo de ejecución.
- `lib/validation/candidacy.ts` declaraba `electionModeSchema` después de `durationSchema` y
  `resultsCountdownSchema`, que lo usan. Además de romper el tipado, habría fallado al importar el
  módulo. La declaración se mueve arriba.

### Cambiado
- `components/candidacy/CandidacyForm.tsx` comprueba si una sección opcional tiene contenido con un
  ayudante explícito, sin depender de la inferencia de `Object.values`.

## [0.2.0] — 2026-09-16

Actualización estructural del sistema electoral. Sustituye requisitos anteriores incompatibles.

### Cambiado

**Una única opción de voto por miembro**
- `RoundBallotOption` pasa a representar exactamente una opción por miembro y ronda:
  `sourceMemberId` obligatorio, `sourceCandidacyId` opcional y snapshots de nombre, candidatura,
  eslogan, color y existencia de candidatura formal.
- Una candidatura ya no es una opción de voto independiente: enriquece la opción de su presidente.
  Desaparece el enum `BallotOptionType` y con él las opciones duplicadas, los contadores separados,
  la clasificación visual Persona/Candidatura y las selecciones `member:<id>` / `candidacy:<id>`.
- La papeleta usa un único grupo de radios con el texto exigido y confirmación con miembro,
  candidatura, eslogan y avisos de voto único e irreversibilidad.
- Los miembros sin candidatura reciben un color estable y determinista por miembro.
- Todos los resultados se contabilizan por miembro, con un único total por ronda.

**Separación estricta TEST / LIVE**
- Nuevo `ElectionMode` en `Election` y, denormalizado e inmutable, en `ElectionRound`.
- El seed crea dos elecciones: la real y la de ensayo, cada una con su ronda y su censo.
- Toda Server Action declara el modo y se verifica dos veces (elección y ronda real).
- Modo de prueba exclusivo de la Junta, con banda permanente de aviso, “Reiniciar simulación” y
  “Finalizar simulación”.

**La elección real no se reinicia ni se cierra antes de hora**
- Eliminados el botón, la Server Action y el componente de reinicio de una ronda real, y el cierre
  manual anticipado. Una ronda real termina exclusivamente al alcanzar su hora de cierre.
- Disparadores que impiden borrar papeletas o participaciones de una ronda `LIVE` y devolverla al
  estado inicial.

**Resultados: proceso guiado en lugar de switches**
- Nuevo stepper con estados Pendiente, Disponible, Bloqueado, En ejecución, Completado y No
  aplicable, con botones explícitos, idempotencia, confirmación sin datos ocultos y sin reversión.
- Nueva máscara de resultados en servidor: al cliente solo viajan los grupos ya publicados.
- La Junta Electoral pierde toda vista previa: se eliminan el recuento agregado privado, el ranking
  privado y el podio privado. Solo dispone de verificaciones de integridad sin resultados.
- La segunda vuelta se habilita únicamente cuando el empate en primera posición ya es público.

**Rutas**
- La pestaña “Votar” pasa a llamarse “Elección” y la pantalla principal es `/eleccion`.
- `/votar`, `/inicio`, `/` y el login redirigen a `/eleccion`; no queda implementación duplicada.
- La Junta Electoral se divide en `/junta-electoral` (dashboard) más las subpáginas de candidaturas,
  censo, votación, resultados, auditoría y pruebas.

**Candidaturas**
- La Junta ya no edita el contenido: solicita correcciones motivadas, valida, marca no válida o
  elimina. Nuevo modelo `CandidacyCorrectionRequest` y estado `CandidacyReviewStatus`.
- Una candidatura marcada no válida deja de enriquecer la opción de su presidente.

**Tiempo**
- `settleExpiredRounds` y todas las transiciones críticas usan `NOW()` de PostgreSQL; las páginas
  obtienen el instante con `serverNow()` y lo propagan al cliente solo para pintar la cuenta atrás.

### Añadido
- `/como-funciona`: 16 apartados con índice, incluido el texto literal sobre privacidad.
- Línea temporal de siete fases derivada de la máquina de estados, con segunda vuelta condicional.
- `/eleccion/comparar`: comparador neutral con 12 categorías en orden fijo y “No incluida en esta
  candidatura.”, sin puntuar, recomendar ni mostrar popularidad.
- Participación agregada y anónima con cache de cinco minutos y endpoint `/api/participation`
  limitado a cuatro campos.
- `/junta-electoral/pruebas/resultados`: 15 escenarios ficticios con las mismas funciones puras de
  ranking y máscara, reinicio, avance por fases, repetición de animaciones y movimiento reducido.
- Mensajes explícitos de posiciones inexistentes y podio dinámico sin tarjetas vacías.
- Superficies sólidas (`.solido`) para todas las funciones críticas.
- Pruebas nuevas: máscara de resultados, línea temporal, escenarios y color determinista; ranking
  ampliado a los cinco patrones de competición; validación con modo obligatorio.

### Base de datos
- Migración `20260916140000_unified_options_and_modes`, reproducible y sin borrados silenciosos: si
  existen papeletas emitidas a opciones de candidatura del modelo anterior, se detiene con un
  mensaje explícito en lugar de fusionar votos.
- Índices nuevos por modo, ronda, miembro y ronda, fase de revelación, candidaturas activas y
  auditoría por fecha y tipo.

### Notas
- Efecto colateral documentado: al blindar los datos reales, una ronda `LIVE` con votos tampoco
  puede eliminarse en cascada.
- El stepper no muestra “No aplicable” en fases sin publicar, porque revelaría si existen los
  puestos 4 y 5.

## [0.1.0] — 2026-09-16

Primera versión funcional completa del repositorio.

### Añadido

**Modelo de datos y base de datos**
- Esquema Prisma para PostgreSQL (Neon) con miembros, elección, rondas, elegibilidad, motivos de
  exclusión, candidaturas, propuestas, premisas, opciones congeladas de papeleta, participación,
  papeletas, auditoría e intentos de acceso.
- Migración `20260916120000_init` con tablas, índices y claves ajenas.
- Migración `20260916120100_election_integrity` con las restricciones que Prisma no expresa:
  papeleta congelada inmutable, voto solo con la votación abierta y en plazo, coherencia entre
  exclusión y motivos, linaje de la segunda vuelta y una candidatura activa por presidente.
- Seed idempotente de los 39 miembros con su grafía exacta, sus posiciones oficiales y sus roles.

**Autenticación y permisos**
- Inicio de sesión sin registro público, con selector buscable tolerante a tildes, comillas y
  guiones, y mensaje de error genérico.
- Sesión propia en cookie `httpOnly` firmada con HMAC-SHA256; rol releído de base de datos en cada
  petición.
- Contraseñas con bcrypt y comparación contra hash señuelo para no filtrar la existencia del nombre.
- Límite de intentos persistido en base de datos, sin IP ni user agent.

**Candidaturas**
- Formulario con tres propuestas obligatorias y seis secciones opcionales con switch, aviso antes de
  descartar datos y conservación temporal mientras el formulario sigue abierto.
- Lista de "Otras premisas" reordenable.
- Color pastel aleatorio persistente por candidatura, generado en servidor.
- Plazo de edición configurable; la Junta puede editar después del plazo, nunca tras iniciar la
  votación.
- Ficha pública de candidatura y eliminación por la Junta antes de la votación.

**Exclusiones**
- Dos motivos exclusivos, sin categoría genérica, con exigencia de al menos un motivo.
- Reinclusión antes de iniciar la votación; el excluido conserva su derecho a votar.

**Votación**
- Inicio manual con hora de servidor y congelación de la papeleta.
- Una sola variable de selección, confirmación previa y un voto por miembro y ronda.
- Cierre por temporizador o manual, con consolidación perezosa de rondas vencidas sin cron.
- Anonimato total: papeleta sin votante, sesión, IP, user agent ni marca temporal; participación y
  papeleta creadas en la misma transacción sin identificador común.

**Resultados**
- Recuento exclusivamente por agregación de papeletas.
- Ranking de competición con empates compartidos y reparto por fases.
- Tres switches irreversibles: resto de resultados, puestos 4 y 5, podio.
- Cuenta atrás de resultados que habilita el primer switch sin publicar nada.
- Segunda vuelta solo con empate en primera posición y al menos un voto, como ronda independiente.

**Junta Electoral**
- Panel con siete secciones: estado, candidaturas, miembros votables, temporizadores, resultados,
  auditoría y herramientas de prueba.
- Recuento agregado privado antes de revelar.
- Reinicio de votación con doble confirmación y escritura literal de `REINICIAR`.
- Auditoría de acciones administrativas sin secretos ni votos.

**Interfaz**
- Sistema de diseño en CSS propio: blanco, cristal translúcido al estilo iOS 26/27 y estética de
  escrutinio televisivo, con la paleta y los tramos de cuenta atrás exigidos.
- Mobile-first de 320 a 430 px, objetivos táctiles de 44 px, áreas seguras y sin scroll horizontal.
- Accesibilidad: `role="switch"`, `aria-pressed`, diálogos modales con foco gestionado, anuncios solo
  en hitos y respeto de `prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast`.
- Refresco ligero por sondeo de estado cada 5 segundos, sin websockets.

**Calidad**
- Pruebas con Vitest de los tramos de cuenta atrás, ranking y fases, empates, búsqueda tolerante,
  rangos de fechas, confirmación literal y colores pastel.
- Script `check:secrets` que falla si aparece alguna contraseña o hash en el repositorio.
- Script `verify` que agrupa validación de Prisma, tipos, lint, pruebas y comprobación de secretos.

### Seguridad
- Las contraseñas iniciales no viajan en el repositorio: el seed las lee de un archivo externo
  incluido en `.gitignore`.
- Cabeceras de seguridad en `next.config.mjs`.

### Notas
- `package-lock.json` se genera en la primera ejecución de `npm install` y debe subirse al
  repositorio.
- El anonimato es completo frente a la aplicación, no frente a quien tenga acceso SQL directo a la
  base de datos.
