-- Catalogue import: cached product-image thumbnail (additive, nullable). Mirrors Employee.imageThumb.
ALTER TABLE "ProductImage" ADD COLUMN "thumbUrl" TEXT;
