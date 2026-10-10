
-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'REFUND_REQUESTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DEMO', 'ZALOPAY');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "purchase_id" UUID;

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "price_vnd" INTEGER NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "refunded_at" TIMESTAMPTZ(3),
    "buyer_name" VARCHAR(120),
    "buyer_email" VARCHAR(320),
    "buyer_tax_code" VARCHAR(20),
    "buyer_address" VARCHAR(300),
    "invoice_requested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DEMO',
    "app_trans_id" VARCHAR(64) NOT NULL,
    "provider_trans_id" VARCHAR(64),
    "amount_vnd" INTEGER NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "qr_code" TEXT,
    "order_url" VARCHAR(1000),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "failure_reason" VARCHAR(200),
    "provider_payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchases_user_id_course_id_idx" ON "purchases"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "purchases_status_created_at_idx" ON "purchases"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_app_trans_id_key" ON "payment_attempts"("app_trans_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_trans_id_key" ON "payment_attempts"("provider_trans_id");

-- CreateIndex
CREATE INDEX "payment_attempts_purchase_id_idx" ON "payment_attempts"("purchase_id");

-- CreateIndex
CREATE INDEX "payment_attempts_status_expires_at_idx" ON "payment_attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_purchase_id_key" ON "enrollments"("purchase_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Handwritten: Prisma Schema Language has no CHECK or partial-index syntax
-- (DATA_MODEL.md §SQL viết tay). Do not drop these when regenerating this migration.
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_price_vnd_check" CHECK ("price_vnd" >= 0);
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_amount_vnd_check" CHECK ("amount_vnd" > 0);
CREATE UNIQUE INDEX "purchases_user_course_open_key" ON "purchases" ("user_id", "course_id") WHERE "status" IN ('PENDING','PAID','REFUND_REQUESTED');
