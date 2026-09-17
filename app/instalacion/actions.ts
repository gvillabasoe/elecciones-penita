"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { CANONICAL_MEMBERS } from "@/lib/members";
import {
  generatePasswords,
  installDatabase,
  InstallError,
  parseCredentials
} from "@/lib/system/install";
import { installSchema, SchemaInstallError } from "@/lib/system/install-schema";
import type { InstallActionState } from "@/lib/system/install-state";
import { firstIssueMessage } from "@/lib/validation/candidacy";

/**
 * Instalación desde el navegador.
 *
 * Protecciones, por orden de aplicación:
 *  1. Si SETUP_TOKEN no está definido o tiene menos de 16 caracteres, ninguna
 *     acción hace nada: la instalación web está deshabilitada por defecto.
 *  2. El token se compara en tiempo constante.
 *  3. Los datos iniciales solo se cargan si la tabla de miembros está vacía,
 *     así que esta página nunca puede reescribir contraseñas en uso.
 *  4. Ni el token ni las contraseñas se escriben en logs ni en la auditoría.
 */

const tokenSchema = z.object({ token: z.string().min(1, { message: "Escribe el token de instalación." }) });

const dataSchema = tokenSchema.extend({
  mode: z.enum(["random", "json"]),
  credentials: z.string().nullish()
});

function fail(error: string): InstallActionState {
  return { error, success: null, detail: [], passwords: [] };
}

function tokenMatches(provided: string): boolean {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function guard(token: string): InstallActionState | null {
  if ((process.env.SETUP_TOKEN ?? "").length < 16) {
    return fail(
      "La instalación web está deshabilitada. Define SETUP_TOKEN con 16 caracteres o más y vuelve a desplegar."
    );
  }
  if (!tokenMatches(token)) return fail("El token de instalación no es correcto.");
  return null;
}

/** Paso 1: crea las tablas, restricciones y disparadores. */
export async function installSchemaAction(input: unknown): Promise<InstallActionState> {
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const blocked = guard(parsed.data.token);
  if (blocked) return blocked;

  try {
    const result = await installSchema();
    revalidatePath("/instalacion");
    revalidatePath("/estado");

    const detail = [
      ...result.applied.map((name) => `Aplicada: ${name}`),
      ...result.skipped.map((name) => `Ya estaba aplicada: ${name}`)
    ];

    return {
      error: null,
      success:
        result.applied.length > 0
          ? `Esquema creado: ${result.applied.length} migraciones y ${result.statements} sentencias.`
          : "El esquema ya estaba completo: no había nada que aplicar.",
      detail,
      passwords: []
    };
  } catch (error) {
    if (error instanceof SchemaInstallError) return fail(error.message);
    return fail("No se ha podido crear el esquema. Comprueba en /estado que la base de datos responde.");
  }
}

/** Paso 2: crea los 39 miembros, las dos elecciones y el censo. */
export async function installDataAction(input: unknown): Promise<InstallActionState> {
  const parsed = dataSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssueMessage(parsed.error));

  const blocked = guard(parsed.data.token);
  if (blocked) return blocked;

  try {
    const already = await prisma.member.count();
    if (already > 0) {
      return fail(
        `La base de datos ya tiene ${already} miembros. Este paso solo puede ejecutarse sobre una base vacía.`
      );
    }

    const credentials =
      parsed.data.mode === "random"
        ? generatePasswords()
        : parseCredentials(parsed.data.credentials ?? "");

    const result = await installDatabase(credentials);

    revalidatePath("/instalacion");
    revalidatePath("/estado");
    revalidatePath("/login");

    return {
      error: null,
      success: `Instalación completada: ${result.members} miembros y ${result.elections} elecciones.`,
      detail: [
        `Censo creado: ${result.eligibilities} entradas`,
        "Elección real y elección de ensayo, cada una con su primera vuelta pendiente de iniciar"
      ],
      passwords:
        parsed.data.mode === "random"
          ? CANONICAL_MEMBERS.map((member) => ({
              displayName: member.displayName,
              slug: member.slug,
              password: credentials.get(member.slug) ?? ""
            }))
          : []
    };
  } catch (error) {
    if (error instanceof InstallError) return fail(error.message);
    return fail("La instalación ha fallado. Comprueba en /estado en qué punto se ha quedado.");
  }
}
