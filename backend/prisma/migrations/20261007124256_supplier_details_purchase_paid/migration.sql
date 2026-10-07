-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Purchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Purchase" ("createdAt", "discount", "gstAmount", "id", "paymentMethod", "paymentStatus", "purchaseDate", "purchaseNumber", "subtotal", "supplierId", "total") SELECT "createdAt", "discount", "gstAmount", "id", "paymentMethod", "paymentStatus", "purchaseDate", "purchaseNumber", "subtotal", "supplierId", "total" FROM "Purchase";
DROP TABLE "Purchase";
ALTER TABLE "new_Purchase" RENAME TO "Purchase";
CREATE UNIQUE INDEX "Purchase_purchaseNumber_key" ON "Purchase"("purchaseNumber");
CREATE TABLE "new_Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "supplierCode" TEXT,
    "companyName" TEXT,
    "altPhone" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Supplier" ("address", "contactPerson", "createdAt", "email", "gstin", "id", "name", "notes", "phone", "state", "updatedAt") SELECT "address", "contactPerson", "createdAt", "email", "gstin", "id", "name", "notes", "phone", "state", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: give existing suppliers a code, and treat already-PAID purchases as fully paid.
UPDATE "Supplier" SET "supplierCode" = 'SUP-' || printf('%04d', "id") WHERE "supplierCode" IS NULL;
UPDATE "Purchase" SET "paidAmount" = "total" WHERE "paymentStatus" = 'PAID';
