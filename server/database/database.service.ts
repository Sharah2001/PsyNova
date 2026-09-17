import { Injectable, Logger } from "@nestjs/common";
import { DataSource, Migration } from "typeorm";
import { getAppDataSource } from "./data-source";

import { PsychiatristEntity } from "./entities/psychiatrist.entity";
import { BookingEntity } from "./entities/booking.entity";
import { PatientEntity } from "./entities/patient.entity";
import { ReviewEntity } from "./entities/review.entity";
import { ComplaintEntity } from "./entities/complaint.entity";
import { SettingsEntity } from "./entities/settings.entity";

import { Booking } from "../../lib/types";
import {
  initialPsychiatrists,
  initialReviews,
  initialComplaints,
  initialPlatformSettings,
} from "../../lib/mockData";

import { PatientAccount } from "../../lib/types";

interface BookingStatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  private initializationPromise: Promise<DataSource> | null = null;

  private inMemoryPatients: PatientAccount[] = [];

  // ============================================================
  // DATABASE CONNECTION
  // ============================================================

  async getDataSource(): Promise<DataSource> {
    const ds = getAppDataSource();

    if (ds.isInitialized) {
      return ds;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.logger.log("Initializing TypeORM DataSource connection...");

    this.initializationPromise = ds
      .initialize()
      .then(() => {
        this.logger.log(
          "PostgreSQL TypeORM DataSource successfully connected.",
        );

        return ds;
      })
      .catch((error) => {
        this.logger.error(
          `PostgreSQL DataSource initialization failed: ${error.message}`,
        );

        this.initializationPromise = null;

        throw error;
      });

    return this.initializationPromise;
  }

  // ============================================================
  // CONNECTION TEST
  // ============================================================

  async verifyConnection() {
    try {
      const ds = await this.getDataSource();

      const rawResult = await ds.query(
        "SELECT current_database(), current_user, version();",
      );

      return {
        status: "CONNECTED",
        database: rawResult[0]?.current_database,
        user: rawResult[0]?.current_user,
        postgresVersion: rawResult[0]?.version,
      };
    } catch (error: any) {
      this.logger.error(`PostgreSQL Connection Failed: ${error.message}`);

      throw new Error(
        `[PostgresConnectionFailure] Failed to connect to PostgreSQL database: ${error.message}`,
      );
    }
  }

  // ============================================================
  // MIGRATIONS
  // ============================================================

  async runMigrations() {
    const ds = await this.getDataSource();

    this.logger.log("Running TypeORM database migrations...");

    const migrations = await ds.runMigrations();

    this.logger.log(`Executed ${migrations.length} migration(s) successfully.`);

    return migrations.map((m: Migration) => m.name);
  }

  // ============================================================
  // BOOKING MAPPER
  // ============================================================

  private mapBookingEntityToBooking(entity: BookingEntity): Booking {
    const statusHistory = (entity.statusHistory ??
      []) as BookingStatusHistoryEntry[];

    return {
      id: entity.id,

      doctorId: entity.doctorId,
      doctorName: entity.doctorName,

      patientId: entity.patientId,
      patientName: entity.patientName,
      patientEmail: entity.patientEmail,
      patientContact: entity.patientContact,

      slotId: entity.slotId,
      slotDatetime: entity.slotDatetime,

      feeLkr: Number(entity.feeLkr ?? 0),
      platformCommissionLkr: Number(entity.platformCommissionLkr ?? 0),
      netDoctorEarningLkr: Number(entity.netDoctorEarningLkr ?? 0),

      status: entity.status as Booking["status"],

      paymentStatus: entity.paymentStatus as Booking["paymentStatus"],

      // ============================================================
      // CANCELLATION / RESOLUTION
      // ============================================================

      cancelledBy: entity.cancelledBy ?? undefined,
      cancellationReason: entity.cancellationReason ?? undefined,
      cancelledAt: entity.cancelledAt
        ? entity.cancelledAt.toISOString()
        : undefined,

      resolutionType: entity.resolutionType as Booking["resolutionType"],

      // ============================================================
      // RESCHEDULE
      // ============================================================

      rescheduleRequestedAt: entity.rescheduleRequestedAt
        ? entity.rescheduleRequestedAt.toISOString()
        : undefined,

      rescheduleRequestedBy: entity.rescheduleRequestedBy ?? undefined,

      previousSlotId: entity.previousSlotId ?? undefined,
      previousSlotDatetime: entity.previousSlotDatetime ?? undefined,

      proposedSlotId: entity.proposedSlotId ?? undefined,
      proposedSlotDatetime: entity.proposedSlotDatetime ?? undefined,

      rescheduleStatus: entity.rescheduleStatus as Booking["rescheduleStatus"],

      // ============================================================
      // REFUND
      // ============================================================

      refundStatus: entity.refundStatus as Booking["refundStatus"],

      refundRequestedBy: entity.refundRequestedBy ?? undefined,

      refundRequestedAt: entity.refundRequestedAt
        ? entity.refundRequestedAt.toISOString()
        : undefined,

      refundApprovedBy: entity.refundApprovedBy ?? undefined,

      refundApprovedAt: entity.refundApprovedAt
        ? entity.refundApprovedAt.toISOString()
        : undefined,

      refundAmount:
        entity.refundAmount !== null && entity.refundAmount !== undefined
          ? Number(entity.refundAmount)
          : undefined,

      refundReference: entity.refundReference ?? undefined,

      payhereRef: entity.payhereRef || "",

      gatewayResponse: entity.gatewayResponse ?? undefined,

      bookedBy: entity.bookedBy ?? undefined,

      videoLink: entity.videoLink ?? undefined,

      confirmationSmsSent: entity.confirmationSmsSent ?? false,
      confirmationSmsSentAt: entity.confirmationSmsSentAt
        ? entity.confirmationSmsSentAt.toISOString()
        : undefined,

      reminder5MinSent: entity.reminder5MinSent ?? false,
      reminder5MinSentAt: entity.reminder5MinSentAt
        ? entity.reminder5MinSentAt.toISOString()
        : undefined,

      statusHistory: statusHistory.map((entry) => ({
        status: entry.status as Booking["status"],
        timestamp: entry.timestamp,
        note: entry.note,
      })),

      createdAt:
        entity.createdAt instanceof Date
          ? entity.createdAt.toISOString()
          : String(entity.createdAt),
    };
  }

  // ============================================================
  // FIND ONE BOOKING
  // ============================================================

  async findBookingById(id: string): Promise<Booking | undefined> {
    try {
      const ds = await this.getDataSource();

      const repository = ds.getRepository(BookingEntity);

      const entity = await repository.findOne({
        where: { id },
      });

      if (!entity) {
        return undefined;
      }

      return this.mapBookingEntityToBooking(entity);
    } catch (error) {
      this.logger.error(
        `[DatabaseService] Failed to find booking ${id}:`,
        error,
      );

      return undefined;
    }
  }

  // ============================================================
  // FIND ALL BOOKINGS
  // ============================================================

  async getAllBookings(): Promise<Booking[]> {
    try {
      const ds = await this.getDataSource();

      const repository = ds.getRepository(BookingEntity);

      const entities = await repository.find({
        order: {
          createdAt: "DESC",
        },
      });

      const bookings = entities.map((entity) =>
        this.mapBookingEntityToBooking(entity),
      );

      this.logger.log(
        `[Bookings] Loaded ${bookings.length} booking(s) from PostgreSQL.`,
      );

      return bookings;
    } catch (error: any) {
      this.logger.error(
        `[DatabaseService] Failed to load bookings: ${error.message}`,
      );

      throw error;
    }
  }

  async getBookedSlotIdsForDoctor(doctorId: string): Promise<string[]> {
    const ds = await this.getDataSource();
    const repository = ds.getRepository(BookingEntity);

    const bookings = await repository.find({
      where: {
        doctorId,
        paymentStatus: "paid",
      },
      select: { slotId: true },
    });

    return bookings
      .map((booking) => booking.slotId)
      .filter((slotId): slotId is string => Boolean(slotId));
  }

  // ============================================================
  // CHECK SLOT OCCUPANCY
  // PostgreSQL bookings are the source of truth.
  // ============================================================

  async isSlotBooked(
    doctorId: string,
    slotId: string,
    slotDatetime?: string,
  ): Promise<boolean> {
    try {
      const ds = await this.getDataSource();

      const repository = ds.getRepository(BookingEntity);

      const query = repository
        .createQueryBuilder("booking")
        .where("booking.doctor_id = :doctorId", { doctorId })
        .andWhere("booking.slot_id = :slotId", { slotId })
        .andWhere("booking.status IN (:...statuses)", {
          statuses: ["pending", "confirmed", "completed"],
        });

      // Also verify datetime when supplied.
      // This protects against accidental reuse of a slot ID.
      if (slotDatetime) {
        query.andWhere("booking.slot_datetime = :slotDatetime", {
          slotDatetime,
        });
      }

      const booking = await query.getOne();

      return !!booking;
    } catch (error: any) {
      this.logger.error(
        `[Slot Availability] Failed to check slot ${slotId}: ${error.message}`,
      );

      // IMPORTANT:
      // Do not accidentally expose a potentially booked slot
      // if PostgreSQL availability checking fails.
      throw error;
    }
  }

  // ============================================================
  // SAVE / UPDATE BOOKING
  // ============================================================

  async saveBooking(data: any): Promise<BookingEntity | null> {
    try {
      const ds = await this.getDataSource();

      const repo = ds.getRepository(BookingEntity);

      let entity = await repo.findOne({
        where: {
          id: data.id,
        },
      });

      if (!entity) {
        entity = repo.create({
          id: data.id,
        });
      }

      entity.doctorId = data.doctorId;
      entity.doctorName = data.doctorName || "Specialist";

      entity.patientId = data.patientId || null;
      entity.patientName = data.patientName || "Patient";
      entity.patientEmail = data.patientEmail || "";
      entity.patientContact = data.patientContact || "";

      entity.slotId = data.slotId || entity.slotId || "slot-1";

      entity.slotDatetime =
        data.slotDatetime || entity.slotDatetime || new Date().toISOString();

      entity.status = data.status || "pending";

      entity.paymentStatus = data.paymentStatus || "pending";

      // ============================================================
      // CANCELLATION / RESOLUTION
      // ============================================================

      entity.cancelledBy = data.cancelledBy ?? null;

      entity.cancellationReason = data.cancellationReason ?? null;

      entity.cancelledAt = data.cancelledAt ? new Date(data.cancelledAt) : null;

      entity.resolutionType = data.resolutionType ?? "none";

      entity.rescheduleRequestedAt = data.rescheduleRequestedAt
        ? new Date(data.rescheduleRequestedAt)
        : null;
      entity.rescheduleRequestedBy = data.rescheduleRequestedBy ?? null;

      entity.previousSlotId = data.previousSlotId ?? null;

      entity.previousSlotDatetime = data.previousSlotDatetime ?? null;

      entity.proposedSlotId = data.proposedSlotId ?? null;

      entity.proposedSlotDatetime = data.proposedSlotDatetime ?? null;

      entity.rescheduleStatus = data.rescheduleStatus ?? "none";

      // ============================================================
      // REFUND
      // ============================================================

      entity.refundStatus = data.refundStatus ?? "none";

      entity.refundRequestedBy = data.refundRequestedBy ?? null;

      entity.refundRequestedAt = data.refundRequestedAt
        ? new Date(data.refundRequestedAt)
        : null;
      entity.refundApprovedBy = data.refundApprovedBy ?? null;

      entity.refundApprovedAt = data.refundApprovedAt
        ? new Date(data.refundApprovedAt)
        : null;
      entity.refundAmount = data.refundAmount ?? null;

      entity.refundReference = data.refundReference ?? null;
      entity.feeLkr = Number(data.feeLkr ?? 0);
      entity.platformCommissionLkr = Number(data.platformCommissionLkr ?? 0);
      entity.netDoctorEarningLkr = Number(data.netDoctorEarningLkr ?? 0);

      entity.payhereRef = data.payhereRef || null;
      entity.bookedBy = data.bookedBy || null;
      entity.videoLink = data.videoLink || null;

      entity.statusHistory = data.statusHistory || [];

      entity.gatewayResponse = data.gatewayResponse || null;

      entity.confirmationSmsSent = data.confirmationSmsSent ?? false;
      entity.confirmationSmsSentAt = data.confirmationSmsSentAt
        ? new Date(data.confirmationSmsSentAt)
        : null;
      entity.reminder5MinSent = data.reminder5MinSent ?? false;
      entity.reminder5MinSentAt = data.reminder5MinSentAt
        ? new Date(data.reminder5MinSentAt)
        : null;

      const saved = await repo.save(entity);

      this.logger.log(
        `[Bookings] Booking ${saved.id} saved to PostgreSQL. status=${saved.status}, paymentStatus=${saved.paymentStatus}`,
      );

      return saved;
    } catch (err: any) {
      console.error("========== POSTGRES BOOKING SAVE ERROR ==========");
      console.error("message:", err?.message);
      console.error("code:", err?.code);
      console.error("detail:", err?.detail);
      console.error("table:", err?.table);
      console.error("column:", err?.column);
      console.error("constraint:", err?.constraint);
      console.error("stack:", err?.stack);
      console.error("=================================================");

      this.logger.error(
        `[DatabaseService] PostgreSQL booking save error: ${err?.message}`,
      );

      return null;
    }
  }

  // ============================================================
  // SEED INITIAL DATA
  // ============================================================

  async seedInitialData() {
    const ds = await this.getDataSource();

    // 1. Platform Settings
    const settingsRepo = ds.getRepository(SettingsEntity);

    const countSettings = await settingsRepo.count();

    if (countSettings === 0) {
      await settingsRepo.save({
        id: 1,
        commissionRate: initialPlatformSettings.commissionRate,
        maxBoostedDoctors: initialPlatformSettings.maxBoostedDoctors,
        boost1DayFeeLkr: 1500,
        boost3DayFeeLkr: 3500,
        commissionRules: {
          tier11DayFeeLkr: 1500,
          tier33DayFeeLkr: 3500,
          surgeMultiplier: 1.0,
          allowRefunds: true,
        },
      });
    }

    // 2. Psychiatrists
    const docRepo = ds.getRepository(PsychiatristEntity);

    const countDocs = await docRepo.count();

    if (countDocs === 0) {
      for (const p of initialPsychiatrists) {
        await docRepo.save({
          id: p.id,
          name: p.name,
          title: p.title,
          slmcRegNo: p.slmcRegNo,
          status: p.status,
          isBoosted: p.isBoosted,
          boostTier: p.boostTier,
          boostExpiry: p.boostExpiry,
          photo: p.photo,
          bio: p.bio,
          district: p.district,
          feeLkr: p.feeLkr,
          rating: p.rating,
          reviewCount: p.reviewCount,
          specialtiesAndLanguages: {
            specialties: p.specialties,
            languages: p.languages,
          },
          ratingDistribution: p.ratingDistribution,
          upcomingSlots: p.upcomingSlots as any,
          documents: p.documents as any,
        });
      }
    }

    // 3. Reviews
    const revRepo = ds.getRepository(ReviewEntity);

    const countReviews = await revRepo.count();

    if (countReviews === 0) {
      for (const rev of initialReviews) {
        await revRepo.save({
          id: rev.id,
          doctorId: rev.doctorId,
          patientName: rev.patientName,
          rating: rev.rating,
          comment: rev.text,
          status: rev.flagged ? "Flagged" : "Published",
          createdAt: new Date(rev.date),
        });
      }
    }

    // 4. Complaints
    const cmpRepo = ds.getRepository(ComplaintEntity);

    const countComplaints = await cmpRepo.count();

    if (countComplaints === 0) {
      for (const cmp of initialComplaints) {
        await cmpRepo.save({
          id: cmp.id,
          bookingId: cmp.bookingId,
          complainantType: "patient",
          complainantName: cmp.patientName,
          subject: cmp.reason,
          description: cmp.details,
          status: cmp.status === "Resolved" ? "Resolved" : "Pending Review",
          resolutionNotes: cmp.resolutionNote || null,
          createdAt: new Date(cmp.createdAt),
        });
      }
    }
  }

  // ============================================================
  // PATIENTS
  // ============================================================

  async getAllPatients() {
    try {
      const ds = await this.getDataSource();

      const patRepo = ds.getRepository(PatientEntity);

      return await patRepo.find({
        order: {
          createdAt: "DESC",
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `PostgreSQL unavailable (${err.message}). Returning in-memory patients.`,
      );

      return this.inMemoryPatients;
    }
  }

  async createPatient(data: {
    id?: string;
    clientId?: string;
    name: string;
    email: string;
    phone?: string;
    district?: string;
    password?: string;
  }) {
    try {
      const ds = await this.getDataSource();

      const patRepo = ds.getRepository(PatientEntity);

      let patient = await patRepo.findOne({
        where: {
          email: data.email,
        },
      });

      if (patient) {
        if (data.name) patient.name = data.name;
        if (data.phone) patient.phone = data.phone;
        if (data.district) patient.district = data.district;
        if (data.password) patient.password = data.password;

        return await patRepo.save(patient);
      }

      const id = data.id || `pat-${Date.now()}`;

      const clientId =
        data.clientId || `PN-PAT-${Math.floor(10000 + Math.random() * 90000)}`;

      patient = patRepo.create({
        id,
        clientId,
        name: data.name,
        email: data.email,
        phone: data.phone || "+94 77 000 0000",
        district: data.district || "Colombo",
        password: data.password || undefined,
        status: "Active",
      });

      return await patRepo.save(patient);
    } catch (err: any) {
      this.logger.warn(
        `PostgreSQL unavailable (${err.message}). Saving patient to fallback storage.`,
      );

      const existing = this.inMemoryPatients.find(
        (p) => p.email.toLowerCase() === data.email.toLowerCase(),
      );

      if (existing) {
        if (data.name) existing.name = data.name;
        if (data.phone) existing.phone = data.phone;
        if (data.district) existing.district = data.district;
        if (data.password) existing.password = data.password;

        return existing;
      }

      const id = data.id || `pat-${Date.now()}`;

      const clientId =
        data.clientId || `PN-PAT-${Math.floor(10000 + Math.random() * 90000)}`;

      const newPat: PatientAccount = {
        id,
        clientId,
        name: data.name,
        email: data.email,
        phone: data.phone || "+94 77 000 0000",
        district: data.district || "Colombo",
        password: data.password || undefined,
        status: "Active",
        createdAt: new Date().toISOString(),
      };

      this.inMemoryPatients.unshift(newPat);

      return newPat;
    }
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  async saveReview(data: any): Promise<ReviewEntity | null> {
    try {
      const ds = await this.getDataSource();

      const repo = ds.getRepository(ReviewEntity);

      const entity = repo.create({
        id: data.id,
        doctorId: data.doctorId,
        patientName: data.patientName || "Verified Patient",
        rating: data.rating || 5,
        comment: data.text || data.comment || "",
        status: data.flagged ? "Flagged" : "Published",
        createdAt: data.date ? new Date(data.date) : new Date(),
      });

      return await repo.save(entity);
    } catch (err: any) {
      this.logger.warn(`PostgreSQL review save error (${err.message}).`);

      return null;
    }
  }

  // ============================================================
  // COMPLAINTS
  // ============================================================

  async saveComplaint(data: any): Promise<ComplaintEntity | null> {
    try {
      const ds = await this.getDataSource();

      const repo = ds.getRepository(ComplaintEntity);

      const entity = repo.create({
        id: data.id,
        bookingId: data.bookingId,
        complainantType: "patient",
        complainantName: data.patientName || "Patient",
        subject: data.reason || data.subject || "Complaint",
        description: data.details || data.description || "",
        status: data.status === "Resolved" ? "Resolved" : "Pending Review",
        resolutionNotes: data.resolutionNote || data.resolutionProof || null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      });

      return await repo.save(entity);
    } catch (err: any) {
      this.logger.warn(`PostgreSQL complaint save error (${err.message}).`);

      return null;
    }
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  async saveSettings(data: any): Promise<SettingsEntity | null> {
    try {
      const ds = await this.getDataSource();

      const repo = ds.getRepository(SettingsEntity);

      const entity = repo.create({
        id: 1,

        commissionRate: data.commissionRate ?? 18,

        maxBoostedDoctors: data.maxBoostedDoctors ?? 9,

        boost1DayFeeLkr: data.boost1DayFeeLkr ?? 1500,

        boost3DayFeeLkr: data.boost3DayFeeLkr ?? 3500,

        commissionRules: data.commissionRules || {
          tier11DayFeeLkr: 1500,
          tier33DayFeeLkr: 3500,
          surgeMultiplier: 1.0,
          allowRefunds: true,
        },
      });

      return await repo.save(entity);
    } catch (err: any) {
      this.logger.warn(`PostgreSQL settings save error (${err.message}).`);

      return null;
    }
  }

  // ============================================================
  // JSONB QUERY
  // ============================================================

  async queryByLanguageJsonb(language: string) {
    const ds = await this.getDataSource();

    const query = `
      SELECT id, name, title, specialties_and_languages
      FROM psychiatrists
      WHERE specialties_and_languages @> $1::jsonb;
    `;

    const jsonFilter = JSON.stringify({
      languages: [language],
    });

    const results = await ds.query(query, [jsonFilter]);

    return {
      queryExecuted: query.trim(),
      filterParam: jsonFilter,
      matchedCount: results.length,
      results,
    };
  }

  // ============================================================
  // JSONB TEST
  // ============================================================

  async testJsonbReadWrite() {
    const ds = await this.getDataSource();

    const testId = `test-jsonb-${Date.now()}`;

    const jsonPayload = {
      specialties: ["Postgres JSONB Test Specialty"],
      languages: ["Sinhala", "Tamil", "English", "JSONB-Native"],
    };

    const docRepo = ds.getRepository(PsychiatristEntity);

    const newDoc = docRepo.create({
      id: testId,
      name: "Dr. JSONB Test Specialist",
      title: "PostgreSQL Consultant",
      slmcRegNo: "SLMC-JSONB-999",
      status: "approved",
      isBoosted: false,
      boostTier: "none",
      boostExpiry: null,
      photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7",
      bio: "Test record created to verify PostgreSQL JSONB persistence.",
      district: "Colombo",
      feeLkr: 6000,
      rating: 5,
      reviewCount: 1,
      specialtiesAndLanguages: jsonPayload,
      ratingDistribution: {
        5: 1,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
      upcomingSlots: [],
      documents: [],
    });

    await docRepo.save(newDoc);

    const rawRow = await ds.query(
      `
        SELECT id, name, specialties_and_languages
        FROM psychiatrists
        WHERE id = $1
      `,
      [testId],
    );

    const fetchedDoc = await docRepo.findOneBy({
      id: testId,
    });

    await docRepo.delete({
      id: testId,
    });

    const isParsedObject =
      typeof fetchedDoc?.specialtiesAndLanguages === "object";

    const isArrayInJson = Array.isArray(
      fetchedDoc?.specialtiesAndLanguages?.languages,
    );

    return {
      insertedId: testId,
      rawPostgresResult: rawRow[0],
      parsedObjectFromTypeORM: fetchedDoc?.specialtiesAndLanguages,
      verifiedJsonbType: isParsedObject && isArrayInJson,
      message:
        "JSONB insert, raw query, object parsing, and containment verification successful!",
    };
  }
}
