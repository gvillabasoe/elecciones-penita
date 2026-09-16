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
