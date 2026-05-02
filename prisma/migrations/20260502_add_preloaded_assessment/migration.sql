-- CreateTable
CREATE TABLE "PreloadedAssessment" (
    "id" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "patientName" TEXT,
    "patientEmail" TEXT,
    "payload" JSONB NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreloadedAssessment_pkey" PRIMARY KEY ("id")
);
