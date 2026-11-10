-- Lead list layout: a WhatsApp number, a unique human code (leadNo, backfilled separately), and a
-- lead<->product interest link. All additive; no existing data changed.
ALTER TABLE "Lead" ADD COLUMN "whatsapp" TEXT;

-- leadNo is backfilled (LD-0001..) by backfillLeadNo.ts; the unique index tolerates the current NULLs.
CREATE UNIQUE INDEX "Lead_leadNo_key" ON "Lead"("leadNo");

CREATE TABLE "LeadProduct" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" TIMESTAMP(3),
    CONSTRAINT "LeadProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadProduct_leadId_productId_key" ON "LeadProduct"("leadId", "productId");
CREATE INDEX "LeadProduct_leadId_idx" ON "LeadProduct"("leadId");
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
