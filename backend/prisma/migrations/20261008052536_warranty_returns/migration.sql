/*
  Warnings:

  - Added the required column `updatedAt` to the `WarrantyClaim` table without a default value. This is not possible if the table is not empty.
  - Made the column `reason` on table `WarrantyClaim` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "WarrantyReplacement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "warrantyId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "replacementDate" DATETIME NOT NULL,
    "replacementReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "inventoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyReplacement_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyReplacement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyReplacement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarrantyReturn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "warrantyId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "inventoryId" INTEGER,
    "returnDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "refundAmount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyReturn_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyReturn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyReturn_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Inventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "batch" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "mrp" REAL NOT NULL DEFAULT 0,
    "gstPercent" REAL NOT NULL DEFAULT 18,
    "supplierId" INTEGER,
    "purchaseDate" DATETIME,
    "expiryDate" DATETIME,
    "manufactureDate" DATETIME,
    "dotNumber" TEXT,
    "serialNumber" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Inventory" ("batch", "createdAt", "dotNumber", "expiryDate", "gstPercent", "id", "manufactureDate", "mrp", "productId", "purchaseDate", "purchasePrice", "quantity", "sellingPrice", "serialNumber", "supplierId", "updatedAt") SELECT "batch", "createdAt", "dotNumber", "expiryDate", "gstPercent", "id", "manufactureDate", "mrp", "productId", "purchaseDate", "purchasePrice", "quantity", "sellingPrice", "serialNumber", "supplierId", "updatedAt" FROM "Inventory";
DROP TABLE "Inventory";
ALTER TABLE "new_Inventory" RENAME TO "Inventory";
CREATE TABLE "new_WarrantyClaim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "warrantyId" INTEGER NOT NULL,
    "claimDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "claimedBy" INTEGER,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarrantyClaim_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarrantyClaim_claimedBy_fkey" FOREIGN KEY ("claimedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WarrantyClaim" ("claimDate", "createdAt", "id", "reason", "resolution", "status", "warrantyId") SELECT "claimDate", "createdAt", "id", "reason", "resolution", "status", "warrantyId" FROM "WarrantyClaim";
DROP TABLE "WarrantyClaim";
ALTER TABLE "new_WarrantyClaim" RENAME TO "WarrantyClaim";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyReplacement_inventoryId_key" ON "WarrantyReplacement"("inventoryId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyReturn_inventoryId_key" ON "WarrantyReturn"("inventoryId");
