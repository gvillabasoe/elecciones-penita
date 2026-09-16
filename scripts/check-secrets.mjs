#!/usr/bin/env node
/**
 * Busqueda de secretos antes de publicar o empaquetar el repositorio.
 *
 * Comprueba:
 *  1. Que ninguna contrasena literal del archivo de credenciales aparece en
 *     ningun archivo del repositorio.
 *  2. Que no hay hashes bcrypt escritos a mano en el codigo.
 *  3. Que no existen archivos que nunca deben publicarse.
 *
 * Uso:  node scripts/check-secrets.mjs
 * Salida distinta de cero si encuentra algo.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".tmp"
]);

const SKIP_FILES = new Set([
  "credentials.local.json",
  "package-lock.json",
  "check-secrets.mjs"
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
  ".ttf", ".otf", ".zip", ".pdf", ".mp4", ".webm"
]);

const FORBIDDEN_PATHS = [".env", ".env.local", ".env.production", "node_modules", ".next", ".vercel", ".git"];

function collectFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry)) continue;
      results.push(...collectFiles(absolute));
      continue;
    }

    if (SKIP_FILES.has(entry)) continue;
    if (BINARY_EXTENSIONS.has(path.extname(entry).toLowerCase())) continue;
    results.push(absolute);
  }
  return results;
}

function loadPasswords() {
  const relative = process.env.SEED_CREDENTIALS_FILE ?? "prisma/credentials.local.json";
  const absolute = path.resolve(ROOT, relative);

  if (!existsSync(absolute)) {
    return { available: false, passwords: [], source: relative };
  }

  const parsed = JSON.parse(readFileSync(absolute, "utf8"));
  const passwords = Object.entries(parsed)
    .filter(([key, value]) => !key.startsWith("_") && typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => ({ slug: key, password: value }));

  return { available: true, passwords, source: relative };
}

function main() {
  const problems = [];

  for (const forbidden of FORBIDDEN_PATHS) {
    if (existsSync(path.join(ROOT, forbidden))) {
      problems.push(`Existe "${forbidden}" y no debe formar parte del paquete entregado.`);
    }
  }

  const files = collectFiles(ROOT);
  const { available, passwords, source } = loadPasswords();

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const relative = path.relative(ROOT, file);

    if (/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}/.test(content)) {
      problems.push(`${relative}: contiene lo que parece un hash bcrypt escrito en el codigo.`);
    }

    for (const { slug, password } of passwords) {
      if (content.includes(password)) {
        problems.push(`${relative}: contiene la contrasena inicial de "${slug}".`);
      }
    }
  }

  console.log(`Archivos revisados: ${files.length}`);
  if (available) {
    console.log(`Contrasenas comprobadas: ${passwords.length} (origen: ${source})`);
  } else {
    console.log(`Aviso: no se ha encontrado ${source}. No se ha podido comprobar cada contrasena literal.`);
  }

  if (problems.length > 0) {
    console.error("\nSe han encontrado problemas:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("Sin secretos detectados.");
}

main();
