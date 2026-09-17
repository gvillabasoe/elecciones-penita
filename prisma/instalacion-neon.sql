-- ---------------------------------------------------------------------------
-- Elecciones a la Presidencia de la Penita 2027
-- Instalacion del esquema para el editor SQL de Neon.
--
-- Uso: Neon -> tu proyecto -> SQL Editor -> pega todo -> Run.
-- Equivale a `npm run prisma:deploy`. NO carga miembros: eso lo hace
-- `npm run seed` o el paso 2 de la pagina /instalacion.
--
-- ARCHIVO GENERADO con: npm run build:install-sql
-- Migraciones incluidas (3):
--   20260916120000_init
--   20260916120100_election_integrity
--   20260916140000_unified_options_and_modes
-- ---------------------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- ===========================================================================
-- 20260916120000_init
-- ===========================================================================

-- Elecciones a la Presidencia de la Penita 2027
-- Migracion inicial: enums, tablas, claves e indices.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'PRESIDENT', 'HONORARY_PRESIDENT');
CREATE TYPE "RoundStatus" AS ENUM ('READY_TO_START', 'VOTING_OPEN', 'VOTING_CLOSED', 'RESULTS_WAITING', 'RESULTS_REVEALING', 'RESULTS_PUBLISHED');
CREATE TYPE "ResultsRevealStage" AS ENUM ('HIDDEN', 'LOWER_RANKS_REVEALED', 'FOURTH_FIFTH_REVEALED', 'PODIUM_REVEALED');
CREATE TYPE "ExclusionReason" AS ENUM ('PREVIOUS_PRESIDENT', 'ABSENT_CHRISTMAS_DINNER');
CREATE TYPE "ProposalType" AS ENUM ('ANNUAL_GROUP_PLAN', 'SEMANA_GRANDE_DINNER', 'CHRISTMAS_DINNER', 'PARTY', 'EVENT', 'RURAL_HOUSE', 'TRIP', 'WEEKEND_GETAWAY');
CREATE TYPE "BallotOptionType" AS ENUM ('MEMBER', 'CANDIDACY');
CREATE TYPE "AuditAction" AS ENUM ('CANDIDACY_DEADLINE_UPDATED', 'CANDIDACY_CREATED', 'CANDIDACY_UPDATED_BY_BOARD', 'CANDIDACY_DELETED', 'MEMBER_EXCLUDED', 'MEMBER_REINSTATED', 'VOTING_DURATION_CONFIGURED', 'VOTING_STARTED', 'VOTING_CLOSED_MANUALLY', 'RESULTS_COUNTDOWN_STARTED', 'LOWER_RESULTS_REVEALED', 'FOURTH_FIFTH_REVEALED', 'PODIUM_REVEALED', 'RUNOFF_CREATED', 'ROUND_RESET');

-- CreateTable
CREATE TABLE "Member" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Election" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "candidacyEditDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionRound" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "sourceRoundId" UUID,
    "status" "RoundStatus" NOT NULL DEFAULT 'READY_TO_START',
    "votingDurationSeconds" INTEGER,
    "votingOpenedAt" TIMESTAMP(3),
    "votingClosesAt" TIMESTAMP(3),
    "votingClosedAt" TIMESTAMP(3),
    "votingStartedByMemberId" UUID,
    "votingClosedByMemberId" UUID,
    "resultsCountdownDurationSeconds" INTEGER,
    "resultsCountdownStartedAt" TIMESTAMP(3),
    "resultsRevealAt" TIMESTAMP(3),
    "resultsRevealStage" "ResultsRevealStage" NOT NULL DEFAULT 'HIDDEN',
    "lowerResultsRevealedAt" TIMESTAMP(3),
    "lowerResultsRevealedByMemberId" UUID,
    "fourthFifthRevealedAt" TIMESTAMP(3),
    "fourthFifthRevealedByMemberId" UUID,
    "podiumRevealedAt" TIMESTAMP(3),
    "podiumRevealedByMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionEligibility" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "excludedByMemberId" UUID,
    "excludedAt" TIMESTAMP(3),
    "reinstatedByMemberId" UUID,
    "reinstatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionEligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionExclusionReason" (
    "id" UUID NOT NULL,
    "eligibilityId" UUID NOT NULL,
    "reason" "ExclusionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionExclusionReason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Candidacy" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "presidentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slogan" TEXT NOT NULL,
    "pastelColor" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedByMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidacy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidacyProposal" (
    "id" UUID NOT NULL,
    "candidacyId" UUID NOT NULL,
    "type" "ProposalType" NOT NULL,
    "title" TEXT,
    "place" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidacyProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidacyPromise" (
    "id" UUID NOT NULL,
    "candidacyId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidacyPromise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoundBallotOption" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "optionType" "BallotOptionType" NOT NULL,
    "sourceMemberId" UUID,
    "sourceCandidacyId" UUID,
    "displayNameSnapshot" TEXT NOT NULL,
    "secondaryTextSnapshot" TEXT,
    "presidentNameSnapshot" TEXT,
    "colorSnapshot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "RoundBallotOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VotingParticipation" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "memberId" UUID NOT NULL,

    CONSTRAINT "VotingParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ballot" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "ballotOptionId" UUID NOT NULL,

    CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionAuditLog" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "roundId" UUID,
    "actorMemberId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "slugKey" TEXT NOT NULL,
    "memberId" UUID,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_slug_key" ON "Member"("slug");
CREATE UNIQUE INDEX "Member_sortOrder_key" ON "Member"("sortOrder");
CREATE INDEX "Member_normalizedName_idx" ON "Member"("normalizedName");
CREATE INDEX "Member_sortOrder_idx" ON "Member"("sortOrder");

CREATE UNIQUE INDEX "Election_slug_key" ON "Election"("slug");

CREATE UNIQUE INDEX "ElectionRound_sourceRoundId_key" ON "ElectionRound"("sourceRoundId");
CREATE UNIQUE INDEX "ElectionRound_electionId_roundNumber_key" ON "ElectionRound"("electionId", "roundNumber");
CREATE INDEX "ElectionRound_electionId_status_idx" ON "ElectionRound"("electionId", "status");

CREATE UNIQUE INDEX "ElectionEligibility_electionId_memberId_key" ON "ElectionEligibility"("electionId", "memberId");
CREATE INDEX "ElectionEligibility_electionId_isEligible_idx" ON "ElectionEligibility"("electionId", "isEligible");

CREATE UNIQUE INDEX "ElectionExclusionReason_eligibilityId_reason_key" ON "ElectionExclusionReason"("eligibilityId", "reason");

CREATE INDEX "Candidacy_electionId_isDeleted_idx" ON "Candidacy"("electionId", "isDeleted");

CREATE UNIQUE INDEX "CandidacyProposal_candidacyId_type_key" ON "CandidacyProposal"("candidacyId", "type");
CREATE INDEX "CandidacyProposal_candidacyId_sortOrder_idx" ON "CandidacyProposal"("candidacyId", "sortOrder");

CREATE UNIQUE INDEX "CandidacyPromise_candidacyId_sortOrder_key" ON "CandidacyPromise"("candidacyId", "sortOrder");
CREATE INDEX "CandidacyPromise_candidacyId_idx" ON "CandidacyPromise"("candidacyId");

CREATE UNIQUE INDEX "RoundBallotOption_roundId_sourceMemberId_key" ON "RoundBallotOption"("roundId", "sourceMemberId");
CREATE UNIQUE INDEX "RoundBallotOption_roundId_sourceCandidacyId_key" ON "RoundBallotOption"("roundId", "sourceCandidacyId");
CREATE UNIQUE INDEX "RoundBallotOption_roundId_sortOrder_key" ON "RoundBallotOption"("roundId", "sortOrder");
CREATE INDEX "RoundBallotOption_roundId_idx" ON "RoundBallotOption"("roundId");

CREATE UNIQUE INDEX "VotingParticipation_roundId_memberId_key" ON "VotingParticipation"("roundId", "memberId");
CREATE INDEX "VotingParticipation_roundId_idx" ON "VotingParticipation"("roundId");

CREATE INDEX "Ballot_roundId_ballotOptionId_idx" ON "Ballot"("roundId", "ballotOptionId");

CREATE INDEX "ElectionAuditLog_electionId_createdAt_idx" ON "ElectionAuditLog"("electionId", "createdAt");
CREATE INDEX "ElectionAuditLog_roundId_createdAt_idx" ON "ElectionAuditLog"("roundId", "createdAt");

CREATE INDEX "LoginAttempt_slugKey_createdAt_idx" ON "LoginAttempt"("slugKey", "createdAt");

-- AddForeignKey
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_sourceRoundId_fkey" FOREIGN KEY ("sourceRoundId") REFERENCES "ElectionRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_votingStartedByMemberId_fkey" FOREIGN KEY ("votingStartedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_votingClosedByMemberId_fkey" FOREIGN KEY ("votingClosedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_lowerResultsRevealedByMemberId_fkey" FOREIGN KEY ("lowerResultsRevealedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_fourthFifthRevealedByMemberId_fkey" FOREIGN KEY ("fourthFifthRevealedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_podiumRevealedByMemberId_fkey" FOREIGN KEY ("podiumRevealedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_excludedByMemberId_fkey" FOREIGN KEY ("excludedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_reinstatedByMemberId_fkey" FOREIGN KEY ("reinstatedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionExclusionReason" ADD CONSTRAINT "ElectionExclusionReason_eligibilityId_fkey" FOREIGN KEY ("eligibilityId") REFERENCES "ElectionEligibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Candidacy" ADD CONSTRAINT "Candidacy_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidacy" ADD CONSTRAINT "Candidacy_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Candidacy" ADD CONSTRAINT "Candidacy_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CandidacyProposal" ADD CONSTRAINT "CandidacyProposal_candidacyId_fkey" FOREIGN KEY ("candidacyId") REFERENCES "Candidacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidacyPromise" ADD CONSTRAINT "CandidacyPromise_candidacyId_fkey" FOREIGN KEY ("candidacyId") REFERENCES "Candidacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoundBallotOption" ADD CONSTRAINT "RoundBallotOption_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ElectionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundBallotOption" ADD CONSTRAINT "RoundBallotOption_sourceMemberId_fkey" FOREIGN KEY ("sourceMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoundBallotOption" ADD CONSTRAINT "RoundBallotOption_sourceCandidacyId_fkey" FOREIGN KEY ("sourceCandidacyId") REFERENCES "Candidacy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VotingParticipation" ADD CONSTRAINT "VotingParticipation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ElectionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VotingParticipation" ADD CONSTRAINT "VotingParticipation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ElectionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_ballotOptionId_fkey" FOREIGN KEY ("ballotOptionId") REFERENCES "RoundBallotOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ElectionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES (gen_random_uuid()::text, '5671b76159bb63cb523313cf875d2bfc9555ccd0a503ecb7ca937f039fc71fb3', now(), '20260916120000_init', now(), 74)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 20260916120100_election_integrity
-- ===========================================================================

-- Elecciones a la Presidencia de la Penita 2027
-- Restricciones de integridad que Prisma no puede expresar en el schema.
-- Toda la logica electoral critica queda garantizada tambien en base de datos.

-- ---------------------------------------------------------------------------
-- 1. Rondas: como maximo dos, la segunda siempre ligada a la primera.
-- ---------------------------------------------------------------------------
ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_roundNumber_range_check"
  CHECK ("roundNumber" IN (1, 2));

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_lineage_check"
  CHECK (
    ("roundNumber" = 1 AND "sourceRoundId" IS NULL)
    OR ("roundNumber" = 2 AND "sourceRoundId" IS NOT NULL)
  );

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_no_self_source_check"
  CHECK ("sourceRoundId" IS NULL OR "sourceRoundId" <> "id");

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_duration_check"
  CHECK ("votingDurationSeconds" IS NULL OR ("votingDurationSeconds" BETWEEN 10 AND 604800));

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_results_duration_check"
  CHECK ("resultsCountdownDurationSeconds" IS NULL OR ("resultsCountdownDurationSeconds" BETWEEN 5 AND 604800));

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_closes_after_opens_check"
  CHECK ("votingClosesAt" IS NULL OR "votingOpenedAt" IS NULL OR "votingClosesAt" > "votingOpenedAt");

ALTER TABLE "ElectionRound"
  ADD CONSTRAINT "ElectionRound_open_requires_window_check"
  CHECK (
    "status" = 'READY_TO_START'
    OR ("votingOpenedAt" IS NOT NULL AND "votingClosesAt" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 2. Candidaturas: una por presidente y eleccion mientras no este eliminada.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Candidacy_one_active_per_president_key"
  ON "Candidacy" ("electionId", "presidentId")
  WHERE "isDeleted" = false;

ALTER TABLE "Candidacy"
  ADD CONSTRAINT "Candidacy_pastelColor_format_check"
  CHECK ("pastelColor" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "Candidacy"
  ADD CONSTRAINT "Candidacy_deleted_fields_check"
  CHECK (
    ("isDeleted" = false AND "deletedAt" IS NULL)
    OR ("isDeleted" = true AND "deletedAt" IS NOT NULL)
  );

ALTER TABLE "CandidacyProposal"
  ADD CONSTRAINT "CandidacyProposal_date_range_check"
  CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "CandidacyPromise"
  ADD CONSTRAINT "CandidacyPromise_text_not_blank_check"
  CHECK (length(btrim("text")) > 0);

-- ---------------------------------------------------------------------------
-- 3. Opciones de papeleta: exactamente una persona o una candidatura.
-- ---------------------------------------------------------------------------
ALTER TABLE "RoundBallotOption"
  ADD CONSTRAINT "RoundBallotOption_single_source_check"
  CHECK (("sourceMemberId" IS NOT NULL) <> ("sourceCandidacyId" IS NOT NULL));

ALTER TABLE "RoundBallotOption"
  ADD CONSTRAINT "RoundBallotOption_type_matches_source_check"
  CHECK (
    ("optionType" = 'MEMBER' AND "sourceMemberId" IS NOT NULL)
    OR ("optionType" = 'CANDIDACY' AND "sourceCandidacyId" IS NOT NULL)
  );

-- Las opciones congeladas son inmutables: solo se crean y se borran.
CREATE OR REPLACE FUNCTION "fn_round_ballot_option_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Las opciones de papeleta estan congeladas y no pueden modificarse (opcion %)', OLD."id";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_round_ballot_option_immutable"
  BEFORE UPDATE ON "RoundBallotOption"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_ballot_option_immutable"();

-- No se puede borrar una opcion que ya tiene papeletas.
CREATE OR REPLACE FUNCTION "fn_round_ballot_option_delete_guard"()
RETURNS TRIGGER AS $$
DECLARE
  v_ballots INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_ballots FROM "Ballot" WHERE "ballotOptionId" = OLD."id";
  IF v_ballots > 0 THEN
    RAISE EXCEPTION 'No se puede borrar una opcion con papeletas asociadas (opcion %)', OLD."id";
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_round_ballot_option_delete_guard"
  BEFORE DELETE ON "RoundBallotOption"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_ballot_option_delete_guard"();

-- ---------------------------------------------------------------------------
-- 4. Una ronda abierta o cerrada debe tener papeleta congelada.
--    Se comprueba al final de la transaccion (creacion e inicio son atomicos).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_round_requires_options"()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_options INTEGER;
BEGIN
  SELECT "status"::TEXT INTO v_status FROM "ElectionRound" WHERE "id" = NEW."id";
  IF v_status IS NULL OR v_status = 'READY_TO_START' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(*) INTO v_options FROM "RoundBallotOption" WHERE "roundId" = NEW."id";
  IF v_options = 0 THEN
    RAISE EXCEPTION 'Una ronda iniciada no puede tener una papeleta vacia (ronda %)', NEW."id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_round_requires_options"
  AFTER INSERT OR UPDATE ON "ElectionRound"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "fn_round_requires_options"();

-- ---------------------------------------------------------------------------
-- 5. Exclusiones: nunca sin motivo, nunca con motivos si el miembro es elegible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_eligibility_reasons_consistent"()
RETURNS TRIGGER AS $$
DECLARE
  v_eligibility_id UUID;
  v_is_eligible BOOLEAN;
  v_reasons INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'ElectionEligibility' THEN
    v_eligibility_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    v_eligibility_id := OLD."eligibilityId";
  ELSE
    v_eligibility_id := NEW."eligibilityId";
  END IF;

  SELECT "isEligible" INTO v_is_eligible
    FROM "ElectionEligibility" WHERE "id" = v_eligibility_id;

  IF v_is_eligible IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_reasons
    FROM "ElectionExclusionReason" WHERE "eligibilityId" = v_eligibility_id;

  IF v_is_eligible = false AND v_reasons = 0 THEN
    RAISE EXCEPTION 'Toda exclusion debe tener al menos un motivo (elegibilidad %)', v_eligibility_id;
  END IF;

  IF v_is_eligible = true AND v_reasons > 0 THEN
    RAISE EXCEPTION 'Un miembro elegible no puede conservar motivos de exclusion (elegibilidad %)', v_eligibility_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_eligibility_reasons_consistent"
  AFTER INSERT OR UPDATE ON "ElectionEligibility"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "fn_eligibility_reasons_consistent"();

CREATE CONSTRAINT TRIGGER "trg_exclusion_reason_consistent"
  AFTER INSERT OR UPDATE OR DELETE ON "ElectionExclusionReason"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION "fn_eligibility_reasons_consistent"();

-- ---------------------------------------------------------------------------
-- 6. Votos y participaciones: solo con la ronda abierta y dentro de plazo.
--    La hora de referencia es siempre la del servidor de base de datos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fn_participation_window_guard"()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_closes TIMESTAMP(3);
BEGIN
  SELECT "status"::TEXT, "votingClosesAt" INTO v_status, v_closes
    FROM "ElectionRound" WHERE "id" = NEW."roundId";

  IF v_status IS DISTINCT FROM 'VOTING_OPEN' THEN
    RAISE EXCEPTION 'La votacion no esta abierta en esta ronda (ronda %)', NEW."roundId";
  END IF;

  IF v_closes IS NULL OR (NOW() AT TIME ZONE 'UTC') >= v_closes THEN
    RAISE EXCEPTION 'El plazo de votacion ha finalizado (ronda %)', NEW."roundId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_participation_window_guard"
  BEFORE INSERT ON "VotingParticipation"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_participation_window_guard"();

CREATE OR REPLACE FUNCTION "fn_ballot_window_guard"()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
  v_closes TIMESTAMP(3);
  v_option_round UUID;
BEGIN
  SELECT "status"::TEXT, "votingClosesAt" INTO v_status, v_closes
    FROM "ElectionRound" WHERE "id" = NEW."roundId";

  IF v_status IS DISTINCT FROM 'VOTING_OPEN' THEN
    RAISE EXCEPTION 'La votacion no esta abierta en esta ronda (ronda %)', NEW."roundId";
  END IF;

  IF v_closes IS NULL OR (NOW() AT TIME ZONE 'UTC') >= v_closes THEN
    RAISE EXCEPTION 'El plazo de votacion ha finalizado (ronda %)', NEW."roundId";
  END IF;

  SELECT "roundId" INTO v_option_round
    FROM "RoundBallotOption" WHERE "id" = NEW."ballotOptionId";

  IF v_option_round IS NULL OR v_option_round <> NEW."roundId" THEN
    RAISE EXCEPTION 'La opcion elegida no pertenece a la papeleta congelada de esta ronda';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_ballot_window_guard"
  BEFORE INSERT ON "Ballot"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_ballot_window_guard"();

-- Las papeletas son inmutables: solo se crean y se borran en un reinicio.
CREATE OR REPLACE FUNCTION "fn_ballot_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Las papeletas no pueden modificarse';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_ballot_immutable"
  BEFORE UPDATE ON "Ballot"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_ballot_immutable"();

CREATE TRIGGER "trg_participation_immutable"
  BEFORE UPDATE ON "VotingParticipation"
  FOR EACH ROW
  EXECUTE FUNCTION "fn_ballot_immutable"();

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES (gen_random_uuid()::text, '700ea3b723cc3aaad9440cce960414b701adb5c266cfb049264d7500c8a139fb', now(), '20260916120100_election_integrity', now(), 30)
ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 20260916140000_unified_options_and_modes
-- ===========================================================================

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

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES (gen_random_uuid()::text, '072247105d80a4c9ba71b41472d6e53c8c9a69c5a1f0c85309c1afc362e4c84c', now(), '20260916140000_unified_options_and_modes', now(), 59)
ON CONFLICT DO NOTHING;

COMMIT;

-- Comprobacion: debe devolver 9.
SELECT COUNT(*) AS "tablas_creadas"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Member', 'Election', 'ElectionRound', 'ElectionEligibility', 'Candidacy', 'RoundBallotOption', 'VotingParticipation', 'Ballot', 'ElectionAuditLog');
