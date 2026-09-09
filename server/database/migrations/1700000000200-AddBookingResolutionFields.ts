import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingResolutionFields1700000000200 implements MigrationInterface {
  name = "AddBookingResolutionFields1700000000200";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "cancelled_by" varchar NULL,
      ADD COLUMN IF NOT EXISTS "cancellation_reason" text NULL,
      ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "resolution_type" varchar NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "reschedule_requested_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "reschedule_requested_by" varchar NULL,
      ADD COLUMN IF NOT EXISTS "previous_slot_id" varchar NULL,
      ADD COLUMN IF NOT EXISTS "previous_slot_datetime" varchar NULL,
      ADD COLUMN IF NOT EXISTS "reschedule_status" varchar NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "proposed_slot_id" varchar NULL,
      ADD COLUMN IF NOT EXISTS "proposed_slot_datetime" varchar NULL,
      ADD COLUMN IF NOT EXISTS "refund_status" varchar NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "refund_requested_by" varchar NULL,
      ADD COLUMN IF NOT EXISTS "refund_requested_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "refund_approved_by" varchar NULL,
      ADD COLUMN IF NOT EXISTS "refund_approved_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "refund_amount" decimal(12,2) NULL,
      ADD COLUMN IF NOT EXISTS "refund_reference" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "refund_reference",
      DROP COLUMN IF EXISTS "refund_amount",
      DROP COLUMN IF EXISTS "refund_approved_at",
      DROP COLUMN IF EXISTS "refund_approved_by",
      DROP COLUMN IF EXISTS "refund_requested_at",
      DROP COLUMN IF EXISTS "refund_requested_by",
      DROP COLUMN IF EXISTS "refund_status",
      DROP COLUMN IF EXISTS "proposed_slot_datetime",
      DROP COLUMN IF EXISTS "proposed_slot_id",
      DROP COLUMN IF EXISTS "reschedule_status",
      DROP COLUMN IF EXISTS "previous_slot_datetime",
      DROP COLUMN IF EXISTS "previous_slot_id",
      DROP COLUMN IF EXISTS "reschedule_requested_by",
      DROP COLUMN IF EXISTS "reschedule_requested_at",
      DROP COLUMN IF EXISTS "resolution_type",
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "cancellation_reason",
      DROP COLUMN IF EXISTS "cancelled_by"
    `);
  }
}
