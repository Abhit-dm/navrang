ALTER TABLE "Warranty" ADD COLUMN "saleItemId" INTEGER REFERENCES "SaleItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Warranty" ADD COLUMN "warrantyYears" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Warranty" ADD COLUMN "warrantyMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Warranty" ADD COLUMN "warrantyDays" INTEGER NOT NULL DEFAULT 0;

UPDATE "Warranty"
SET "warrantyYears" = CAST("warrantyDuration" / 12 AS INTEGER),
    "warrantyMonths" = "warrantyDuration" % 12
WHERE "warrantyDuration" > 0;

CREATE UNIQUE INDEX "Warranty_saleItemId_key" ON "Warranty"("saleItemId");
