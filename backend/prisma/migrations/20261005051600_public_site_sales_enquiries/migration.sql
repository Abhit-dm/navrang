-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "aboutText" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "businessHours" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "commitmentText" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "missionText" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "visionText" TEXT;
ALTER TABLE "BusinessSettings" ADD COLUMN "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "dueDate" DATETIME;

-- CreateTable
CREATE TABLE "ContactEnquiry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "productType" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "size" TEXT,
    "width" TEXT,
    "profile" TEXT,
    "rimSize" TEXT,
    "tyreType" TEXT,
    "vehicleCompatibility" TEXT,
    "speedRating" TEXT,
    "loadIndex" TEXT,
    "tubeType" TEXT,
    "pattern" TEXT,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "mrp" REAL NOT NULL DEFAULT 0,
    "gstPercent" REAL NOT NULL DEFAULT 18,
    "minStockLevel" INTEGER NOT NULL DEFAULT 5,
    "supplierId" INTEGER,
    "warrantyType" TEXT DEFAULT 'No Warranty',
    "warrantyDuration" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "imageUrl" TEXT,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "brand", "category", "createdAt", "gstPercent", "id", "loadIndex", "minStockLevel", "mrp", "name", "pattern", "productType", "profile", "purchasePrice", "rimSize", "sellingPrice", "size", "sku", "speedRating", "status", "supplierId", "tubeType", "tyreType", "updatedAt", "vehicleCompatibility", "warrantyDuration", "warrantyType", "width") SELECT "barcode", "brand", "category", "createdAt", "gstPercent", "id", "loadIndex", "minStockLevel", "mrp", "name", "pattern", "productType", "profile", "purchasePrice", "rimSize", "sellingPrice", "size", "sku", "speedRating", "status", "supplierId", "tubeType", "tyreType", "updatedAt", "vehicleCompatibility", "warrantyDuration", "warrantyType", "width" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleNumber" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "vehicleId" INTEGER,
    "employeeId" INTEGER,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "gstAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "isGst" BOOLEAN NOT NULL DEFAULT true,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("createdAt", "customerId", "discount", "employeeId", "gstAmount", "id", "isGst", "paymentMethod", "saleNumber", "subtotal", "total", "vehicleId") SELECT "createdAt", "customerId", "discount", "employeeId", "gstAmount", "id", "isGst", "paymentMethod", "saleNumber", "subtotal", "total", "vehicleId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
