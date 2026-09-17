import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Diagnostico de puesta en marcha.
 *
 * Sirve para saber POR QUE la aplicacion no arranca sin tener que leer los
 * logs del servidor. Es deliberadamente avaro con la informacion:
 *
 *  - de las variables de entorno solo dice si estan definidas, nunca su valor;
 *  - de los errores solo devuelve una causa clasificada, nunca el mensaje
 *    original, porque los errores de conexion de Prisma pueden incluir el
 *    host, el usuario o la base de datos;
 *  - no publica ningun nombre de miembro, candidatura ni resultado.
 */

export type FailureCode =
  | "ENV_DATABASE_URL"
  | "ENV_DIRECT_URL"
  | "SIN_MIGRAR"
  | "SIN_CONEXION"
  | "CREDENCIALES"
  | "SSL"
  | "AUTH_SECRET"
  | "DESCONOCIDO";

export interface Failure {
  code: FailureCode;
  message: string;
  hint: string;
}

const FAILURES: Record<FailureCode, { message: string; hint: string }> = {
  ENV_DATABASE_URL: {
    message: "Falta la variable DATABASE_URL.",
    hint: "Añádela en Vercel (Settings → Environment Variables) con la cadena de Neon con pooling y vuelve a desplegar."
  },
  ENV_DIRECT_URL: {
    message: "Falta la variable DIRECT_URL.",
    hint: "Añade la cadena directa de Neon, sin -pooler. La usan las migraciones."
  },
  SIN_MIGRAR: {
    message: "La base de datos responde, pero no tiene las tablas de la aplicación.",
    hint: "Ejecuta las migraciones contra Neon: npm run prisma:deploy con DIRECT_URL apuntando a producción."
  },
  SIN_CONEXION: {
    message: "No se ha podido conectar con la base de datos.",
    hint: "Revisa que la cadena de conexión sea la de pooling, que incluya ?sslmode=require y que el proyecto de Neon no esté suspendido."
  },
  CREDENCIALES: {
    message: "La base de datos ha rechazado las credenciales.",
    hint: "Vuelve a copiar la cadena de conexión desde Neon: usuario o contraseña no son correctos."
  },
  SSL: {
    message: "La conexión ha fallado por la configuración de TLS.",
    hint: "Añade ?sslmode=require al final de DATABASE_URL y DIRECT_URL."
  },
  AUTH_SECRET: {
    message: "AUTH_SECRET no está configurado o tiene menos de 32 caracteres.",
    hint: 'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
  },
  DESCONOCIDO: {
    message: "La aplicación ha fallado por una causa que no se ha podido identificar.",
    hint: "Consulta los Runtime Logs del despliegue en Vercel para ver el error completo."
  }
};

/** Clasifica un error sin exponer nunca su mensaje original. */
export function classifyFailure(error: unknown): Failure {
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : typeof error === "string" ? error : "";

  const code: FailureCode = /Environment variable not found: DATABASE_URL/i.test(text)
    ? "ENV_DATABASE_URL"
    : /Environment variable not found: DIRECT_URL/i.test(text)
      ? "ENV_DIRECT_URL"
      : /AUTH_SECRET/i.test(text)
        ? "AUTH_SECRET"
        : /P2021|P2022|does not exist in the current database|relation ".*" does not exist|no existe la relación/i.test(text)
          ? "SIN_MIGRAR"
          : /password authentication failed|authentication failed|P1000/i.test(text)
            ? "CREDENCIALES"
            : /self[- ]signed certificate|SSL|TLS|sslmode/i.test(text)
              ? "SSL"
              : /Can't reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timed out|P1001|P1002|P1017/i.test(text)
                ? "SIN_CONEXION"
                : "DESCONOCIDO";

  return { code, ...FAILURES[code] };
}

export interface Diagnostics {
  env: {
    databaseUrl: boolean;
    directUrl: boolean;
    authSecret: boolean;
    authSecretLongEnough: boolean;
    appUrl: boolean;
  };
  database: { reachable: boolean };
  schema: { tablesFound: number; tablesExpected: number; migrationsApplied: number };
  seed: { members: number; liveElection: boolean; testElection: boolean; firstRound: boolean };
  failure: Failure | null;
  ready: boolean;
  /** Impiden funcionar. */
  problems: string[];
  /** Conviene resolverlos, pero la aplicación funciona. */
  warnings: string[];
}

const EXPECTED_TABLES = [
  "Member",
  "Election",
  "ElectionRound",
  "ElectionEligibility",
  "Candidacy",
  "RoundBallotOption",
  "VotingParticipation",
  "Ballot",
  "ElectionAuditLog"
];

export async function collectDiagnostics(): Promise<Diagnostics> {
  const secret = process.env.AUTH_SECRET ?? "";

  const diagnostics: Diagnostics = {
    env: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      directUrl: Boolean(process.env.DIRECT_URL),
      authSecret: secret.length > 0,
      authSecretLongEnough: secret.length >= 32,
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL)
    },
    database: { reachable: false },
    schema: { tablesFound: 0, tablesExpected: EXPECTED_TABLES.length, migrationsApplied: 0 },
    seed: { members: 0, liveElection: false, testElection: false, firstRound: false },
    failure: null,
    ready: false,
    problems: [],
    warnings: []
  };

  if (!diagnostics.env.databaseUrl) {
    diagnostics.failure = classifyFailure("Environment variable not found: DATABASE_URL");
  } else {
    try {
      await prisma.$queryRaw(Prisma.sql`SELECT 1`);
      diagnostics.database.reachable = true;

      const tables = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
        SELECT table_name AS "name"
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${Prisma.join(EXPECTED_TABLES)})
      `);
      diagnostics.schema.tablesFound = tables.length;

      if (tables.length < EXPECTED_TABLES.length) {
        diagnostics.failure = classifyFailure("P2021");
      } else {
        const applied = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
          SELECT COUNT(*) AS total FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL
        `);
        diagnostics.schema.migrationsApplied = Number(applied[0]?.total ?? 0);

        const [members, elections] = await Promise.all([
          prisma.member.count(),
          prisma.election.findMany({ select: { mode: true, rounds: { select: { roundNumber: true } } } })
        ]);

        diagnostics.seed.members = members;
        diagnostics.seed.liveElection = elections.some((election) => election.mode === "LIVE");
        diagnostics.seed.testElection = elections.some((election) => election.mode === "TEST");
        diagnostics.seed.firstRound = elections.some(
          (election) => election.mode === "LIVE" && election.rounds.some((round) => round.roundNumber === 1)
        );
      }
    } catch (error) {
      diagnostics.failure = classifyFailure(error);
    }
  }

  if (!diagnostics.env.databaseUrl) diagnostics.problems.push("Define DATABASE_URL en el entorno.");
  if (!diagnostics.env.directUrl) {
    // La aplicación no la usa en runtime: solo hace falta para migrar con la
    // CLI de Prisma. No bloquea el funcionamiento.
    diagnostics.warnings.push(
      "DIRECT_URL no está definida. Solo la necesitas si migras con la CLI de Prisma."
    );
  }
  if (!diagnostics.env.authSecret) diagnostics.problems.push("Define AUTH_SECRET: sin él no se puede iniciar sesión.");
  else if (!diagnostics.env.authSecretLongEnough) {
    diagnostics.problems.push("AUTH_SECRET debe tener al menos 32 caracteres.");
  }
  if (diagnostics.database.reachable && diagnostics.schema.tablesFound < EXPECTED_TABLES.length) {
    diagnostics.problems.push("Aplica las migraciones: npm run prisma:deploy.");
  }
  if (diagnostics.schema.tablesFound === EXPECTED_TABLES.length && diagnostics.seed.members === 0) {
    diagnostics.problems.push(
      "Carga los miembros: npm run seed, o abre /instalacion si prefieres hacerlo desde el navegador."
    );
  }
  if (diagnostics.seed.members > 0 && !diagnostics.seed.firstRound) {
    diagnostics.problems.push("La elección real no tiene primera vuelta: vuelve a ejecutar el seed.");
  }

  diagnostics.ready =
    diagnostics.failure === null &&
    diagnostics.problems.length === 0 &&
    diagnostics.seed.members > 0 &&
    diagnostics.seed.firstRound;

  return diagnostics;
}
