-- CreateTable
CREATE TABLE "TokenBlacklist" (
    "jti" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenBlacklist_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "TokenBlacklist_userId_idx" ON "TokenBlacklist"("userId");
CREATE INDEX "TokenBlacklist_expiresAt_idx" ON "TokenBlacklist"("expiresAt");
