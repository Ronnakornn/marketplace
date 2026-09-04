-- Restore the legacy label before the immutable publication migration runs.
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
