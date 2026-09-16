-- ---------------------------------------------------------------------------
-- Elecciones a la Presidencia de la Penita 2027
-- Migracion 3: separacion TEST/LIVE, opcion unificada por miembro y
--              solicitudes de correccion de candidatura.
--
-- Requiere PostgreSQL 12 o superior (ALTER TYPE ... ADD VALUE dentro de una
-- transaccion). Neon cumple el requisito.
--
-- Estrategia de datos: no se elimina ningun dato real de forma silenciosa.
-- Si existen papeletas emitidas al modelo antiguo de "opcion de candidatura",
-- la migracion se detiene con un mensaje explicito en lugar de fusionar votos.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Tipos nuevos
-- ---------------------------------------------------------------------------
CREATE TYPE "ElectionMode" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "CandidacyReviewStatus" AS ENUM ('PENDING_REVIEW', 'VALID', 'CORRECTION_REQUESTED', 'INVALID');
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

-- Se anaden valores nuevos y se conservan los antiguos para no perder el
-- historial de auditoria ya escrito.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDACY_MARKED_VALID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANDIDACY_MARKED_INVALID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIMULATION_RESET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIMULATION_FINISHED';

-- ---------------------------------------------------------------------------
-- 2. Modo de eleccion y de ronda
-- ---------------------------------------------------------------------------
ALTER TABLE "Election" ADD COLUMN "mode" "ElectionMode" NOT NULL DEFAULT 'LIVE';
ALTER TABLE "ElectionRound" ADD COLUMN "mode" "ElectionMode" NOT NULL DEFAULT 'LIVE';

UPDATE "ElectionRound" AS r
SET "mode" = e."mode"
FROM "Election" AS e
WHERE e."id" = r."electionId";

CREATE INDEX "Election_mode_idx" ON "Election"("mode");
CREATE INDEX "ElectionRound_electionId_mode_idx" ON "ElectionRound"("electionId", "mode");
CREATE INDEX "ElectionRound_mode_status_idx" ON "ElectionRound"("mode", "status");
CREATE INDEX "ElectionRound_resultsRevealStage_idx" ON "ElectionRound"("resultsRevealStage");
CREATE INDEX "VotingParticipation_memberId_roundId_idx" ON "VotingParticipation"("memberId", "roundId");
CREATE INDEX "ElectionAuditLog_electionId_action_createdAt_idx" ON "ElectionAuditLog"("electionId", "action", "createdAt");
CREATE INDEX "ElectionAuditLog_actorMemberId_createdAt_idx" ON "ElectionAuditLog"("actorMemberId", "createdAt");

-- El modo de una eleccion es inmutable: una simulacion nunca se convierte en
-- eleccion real conservando sus datos.
CREATE OR REPLACE FUNCTION "fn_election_mode_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."mode" <> NEW."mode" THEN
    RAISE EXCEPTION 'El modo de una eleccion no puede cambiarse (eleccion %)', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_election_mode_immutable"
  BEFORE UPDATE ON "Election"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_election_mode_immutable"();

-- El modo de la ronda debe coincidir siempre con el de su eleccion y tampoco
-- puede cambiarse.
CREATE OR REPLACE FUNCTION "fn_round_mode_consistent"()
RETURNS TRIGGER AS $$
DECLARE
  v_election_mode "ElectionMode";
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."mode" <> NEW."mode" THEN
    RAISE EXCEPTION 'El modo de una ronda no puede cambiarse (ronda %)', OLD."id";
  END IF;

  SELECT "mode" INTO v_election_mode FROM "Election" WHERE "id" = NEW."electionId";

  IF v_election_mode IS NULL THEN
    RAISE EXCEPTION 'La ronda % referencia una eleccion inexistente', NEW."id";
  END IF;

  IF v_election_mode <> NEW."mode" THEN
    RAISE EXCEPTION 'El modo de la ronda (%) no coincide con el de su eleccion (%)', NEW."mode", v_election_mode;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_round_mode_consistent"
  BEFORE INSERT OR UPDATE ON "ElectionRound"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_mode_consistent"();

-- La segunda vuelta debe compartir modo con su ronda de origen.
CREATE OR REPLACE FUNCTION "fn_round_lineage_same_mode"()
RETURNS TRIGGER AS $$
DECLARE
  v_source_mode "ElectionMode";
BEGIN
  IF NEW."sourceRoundId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "mode" INTO v_source_mode FROM "ElectionRound" WHERE "id" = NEW."sourceRoundId";

  IF v_source_mode IS DISTINCT FROM NEW."mode" THEN
    RAISE EXCEPTION 'Una segunda vuelta no puede tener un modo distinto al de su ronda de origen';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_round_lineage_same_mode"
  AFTER INSERT OR UPDATE ON "ElectionRound"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_lineage_same_mode"();

-- ---------------------------------------------------------------------------
-- 3. Una ronda LIVE nunca se reinicia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_live_round_no_reset"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."mode" = 'LIVE'
     AND NEW."status" = 'READY_TO_START'
     AND OLD."status" <> 'READY_TO_START' THEN
    RAISE EXCEPTION 'Una ronda real no puede volver al estado inicial (ronda %)', OLD."id";
  END IF;

  IF OLD."mode" = 'LIVE' AND OLD."resultsRevealStage" <> 'HIDDEN' AND NEW."resultsRevealStage" = 'HIDDEN' THEN
    RAISE EXCEPTION 'Las fases de resultados publicadas no pueden ocultarse (ronda %)', OLD."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_live_round_no_reset"
  BEFORE UPDATE ON "ElectionRound"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_live_round_no_reset"();

-- Las papeletas y participaciones reales son inmutables y no se pueden borrar.
CREATE OR REPLACE FUNCTION "fn_live_ballot_no_delete"()
RETURNS TRIGGER AS $$
DECLARE
  v_mode "ElectionMode";
BEGIN
  SELECT "mode" INTO v_mode FROM "ElectionRound" WHERE "id" = OLD."roundId";

  IF v_mode = 'LIVE' THEN
    RAISE EXCEPTION 'Las papeletas de una eleccion real no pueden eliminarse';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_live_ballot_no_delete"
  BEFORE DELETE ON "Ballot"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_live_ballot_no_delete"();

CREATE OR REPLACE FUNCTION "fn_live_participation_no_delete"()
RETURNS TRIGGER AS $$
DECLARE
  v_mode "ElectionMode";
BEGIN
  SELECT "mode" INTO v_mode FROM "ElectionRound" WHERE "id" = OLD."roundId";

  IF v_mode = 'LIVE' THEN
    RAISE EXCEPTION 'Las participaciones de una eleccion real no pueden eliminarse';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_live_participation_no_delete"
  BEFORE DELETE ON "VotingParticipation"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_live_participation_no_delete"();

-- ---------------------------------------------------------------------------
-- 4. Opcion unificada: exactamente una por miembro y ronda
-- ---------------------------------------------------------------------------
ALTER TABLE "RoundBallotOption" DROP CONSTRAINT IF EXISTS "RoundBallotOption_single_source_check";
ALTER TABLE "RoundBallotOption" DROP CONSTRAINT IF EXISTS "RoundBallotOption_type_matches_source_check";

-- La inmutabilidad se restablece al final: el backfill necesita actualizar.
DROP TRIGGER IF EXISTS "trg_round_ballot_option_immutable" ON "RoundBallotOption";

ALTER TABLE "RoundBallotOption"
  ADD COLUMN "memberNameSnapshot" TEXT,
  ADD COLUMN "candidacyNameSnapshot" TEXT,
  ADD COLUMN "sloganSnapshot" TEXT,
  ADD COLUMN "hasFormalCandidacySnapshot" BOOLEAN NOT NULL DEFAULT false;

-- Proteccion explicita: los votos emitidos por separado a una persona y a su
-- candidatura no pueden fusionarse sin alterar el resultado.
DO $$
DECLARE
  v_conflict INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_conflict
  FROM "Ballot" AS b
  JOIN "RoundBallotOption" AS o ON o."id" = b."ballotOptionId"
  WHERE o."optionType" = 'CANDIDACY';

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Migracion detenida: hay % papeletas emitidas a opciones de candidatura del modelo anterior. Archiva o exporta esas rondas antes de migrar (README, apartado "Migracion al modelo de opcion unificada"). No se fusionan votos automaticamente.', v_conflict;
  END IF;
END $$;

-- Sin papeletas asociadas, la opcion de candidatura desaparece: el miembro
-- conserva su unica opcion, ahora enriquecida con su candidatura.
DELETE FROM "RoundBallotOption" WHERE "optionType" = 'CANDIDACY';

UPDATE "RoundBallotOption"
SET "memberNameSnapshot" = "displayNameSnapshot"
WHERE "memberNameSnapshot" IS NULL;

UPDATE "RoundBallotOption" AS o
SET "sourceCandidacyId" = c."id",
    "candidacyNameSnapshot" = c."name",
    "sloganSnapshot" = c."slogan",
    "colorSnapshot" = c."pastelColor",
    "hasFormalCandidacySnapshot" = true
FROM "Candidacy" AS c, "ElectionRound" AS r
WHERE o."roundId" = r."id"
  AND c."electionId" = r."electionId"
  AND c."presidentId" = o."sourceMemberId"
  AND c."isDeleted" = false;

ALTER TABLE "RoundBallotOption"
  ALTER COLUMN "memberNameSnapshot" SET NOT NULL,
  ALTER COLUMN "sourceMemberId" SET NOT NULL;

ALTER TABLE "RoundBallotOption"
  DROP COLUMN "displayNameSnapshot",
  DROP COLUMN "secondaryTextSnapshot",
  DROP COLUMN "presidentNameSnapshot",
  DROP COLUMN "optionType";

DROP TYPE IF EXISTS "BallotOptionType";

CREATE INDEX "RoundBallotOption_sourceMemberId_idx" ON "RoundBallotOption"("sourceMemberId");

ALTER TABLE "RoundBallotOption"
  ADD CONSTRAINT "RoundBallotOption_candidacy_snapshot_check"
  CHECK (
    (
      "sourceCandidacyId" IS NULL
      AND "hasFormalCandidacySnapshot" = false
      AND "candidacyNameSnapshot" IS NULL
      AND "sloganSnapshot" IS NULL
    )
    OR (
      "sourceCandidacyId" IS NOT NULL
      AND "hasFormalCandidacySnapshot" = true
      AND "candidacyNameSnapshot" IS NOT NULL
      AND "sloganSnapshot" IS NOT NULL
    )
  );

ALTER TABLE "RoundBallotOption"
  ADD CONSTRAINT "RoundBallotOption_colorSnapshot_format_check"
  CHECK ("colorSnapshot" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "RoundBallotOption"
  ADD CONSTRAINT "RoundBallotOption_memberName_not_blank_check"
  CHECK (length(btrim("memberNameSnapshot")) > 0);

-- Una candidatura solo puede enriquecer la opcion de su presidente, y solo
-- dentro de su misma eleccion.
CREATE OR REPLACE FUNCTION "fn_round_ballot_option_candidacy_owner"()
RETURNS TRIGGER AS $$
DECLARE
  v_president UUID;
  v_candidacy_election UUID;
  v_round_election UUID;
BEGIN
  IF NEW."sourceCandidacyId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "presidentId", "electionId" INTO v_president, v_candidacy_election
  FROM "Candidacy" WHERE "id" = NEW."sourceCandidacyId";

  IF v_president IS NULL THEN
    RAISE EXCEPTION 'La candidatura asociada a la opcion no existe';
  END IF;

  IF v_president <> NEW."sourceMemberId" THEN
    RAISE EXCEPTION 'Una candidatura solo puede enriquecer la opcion de su presidente';
  END IF;

  SELECT "electionId" INTO v_round_election FROM "ElectionRound" WHERE "id" = NEW."roundId";

  IF v_round_election IS DISTINCT FROM v_candidacy_election THEN
    RAISE EXCEPTION 'La candidatura pertenece a otra eleccion';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_round_ballot_option_candidacy_owner"
  BEFORE INSERT ON "RoundBallotOption"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_ballot_option_candidacy_owner"();

-- Se restablece la inmutabilidad de la papeleta congelada.
CREATE TRIGGER "trg_round_ballot_option_immutable"
  BEFORE UPDATE ON "RoundBallotOption"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_ballot_option_immutable"();

-- ---------------------------------------------------------------------------
-- 5. Revision de candidaturas y solicitudes de correccion
-- ---------------------------------------------------------------------------
ALTER TABLE "Candidacy"
  ADD COLUMN "reviewStatus" "CandidacyReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW';

CREATE INDEX "Candidacy_electionId_isDeleted_reviewStatus_idx"
  ON "Candidacy"("electionId", "isDeleted", "reviewStatus");

CREATE TABLE "CandidacyCorrectionRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidacyId" UUID NOT NULL,
    "requestedByMemberId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByMemberId" UUID,

    CONSTRAINT "CandidacyCorrectionRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidacyCorrectionRequest_reason_not_blank_check" CHECK (length(btrim("reason")) > 0),
    CONSTRAINT "CandidacyCorrectionRequest_resolved_fields_check" CHECK (
      ("status" = 'OPEN' AND "resolvedAt" IS NULL AND "resolvedByMemberId" IS NULL)
      OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL)
    )
);

CREATE INDEX "CandidacyCorrectionRequest_candidacyId_status_idx"
  ON "CandidacyCorrectionRequest"("candidacyId", "status");
CREATE INDEX "CandidacyCorrectionRequest_status_createdAt_idx"
  ON "CandidacyCorrectionRequest"("status", "createdAt");

ALTER TABLE "CandidacyCorrectionRequest"
  ADD CONSTRAINT "CandidacyCorrectionRequest_candidacyId_fkey"
  FOREIGN KEY ("candidacyId") REFERENCES "Candidacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CandidacyCorrectionRequest"
  ADD CONSTRAINT "CandidacyCorrectionRequest_requestedByMemberId_fkey"
  FOREIGN KEY ("requestedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CandidacyCorrectionRequest"
  ADD CONSTRAINT "CandidacyCorrectionRequest_resolvedByMemberId_fkey"
  FOREIGN KEY ("resolvedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Una candidatura no puede recibir solicitudes de correccion despues de que su
-- eleccion haya iniciado la votacion.
CREATE OR REPLACE FUNCTION "fn_correction_request_before_voting"()
RETURNS TRIGGER AS $$
DECLARE
  v_started INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_started
  FROM "Candidacy" AS c
  JOIN "ElectionRound" AS r ON r."electionId" = c."electionId" AND r."roundNumber" = 1
  WHERE c."id" = NEW."candidacyId" AND r."status" <> 'READY_TO_START';

  IF v_started > 0 THEN
    RAISE EXCEPTION 'No se pueden crear solicitudes de correccion despues de iniciar la votacion';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_correction_request_before_voting"
  BEFORE INSERT ON "CandidacyCorrectionRequest"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_correction_request_before_voting"();
