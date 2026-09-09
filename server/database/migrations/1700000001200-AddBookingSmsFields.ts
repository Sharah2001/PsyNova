import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingSmsFields1700000001200 implements MigrationInterface {
  name = "AddBookingSmsFields1700000001200";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "confirmation_sms_sent" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "confirmation_sms_sent_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "reminder_5_min_sent" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "reminder_5_min_sent_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "reminder_5_min_sent_at",
      DROP COLUMN IF EXISTS "reminder_5_min_sent",
      DROP COLUMN IF EXISTS "confirmation_sms_sent_at",
      DROP COLUMN IF EXISTS "confirmation_sms_sent"
    `);
  }
}
