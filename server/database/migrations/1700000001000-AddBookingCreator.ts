import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingCreator1700000001000 implements MigrationInterface {
  name = "AddBookingCreator1700000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "booked_by" JSONB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "booked_by";
    `);
  }
}
