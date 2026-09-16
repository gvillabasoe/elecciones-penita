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
