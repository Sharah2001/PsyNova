import { randomUUID } from "crypto";
import { Booking } from "../../lib/types";
import { initialBookings, initialPlatformSettings } from "../../lib/mockData";

import { PsychiatristsService } from "../psychiatrists/psychiatrists.service";
import { DatabaseService } from "../database/database.service";

export class BookingsService {
  private bookings: Booking[] = [...initialBookings];

  constructor(
    private readonly psychiatristsService: PsychiatristsService,
    private readonly databaseService?: DatabaseService,
  ) {}

  // ============================================================
  // GET ALL BOOKINGS
  // PostgreSQL is the source of truth.
  // ============================================================

  async findAll(): Promise<Booking[]> {
    console.log(
      "[BookingsService] findAll() called. databaseService:",
      !!this.databaseService,
    );

    if (this.databaseService) {
      try {
        const dbBookings = await this.databaseService.getAllBookings();

        console.log(
          "[BookingsService] PostgreSQL returned:",
          dbBookings.length,
          "booking(s)",
        );

        this.bookings = dbBookings;
        return dbBookings;
      } catch (error) {
        console.error(
          "[BookingsService] Failed to load bookings from PostgreSQL. Using memory fallback.",
          error,
        );
      }
    }

    console.log(
      "[BookingsService] Returning memory bookings:",
      this.bookings.length,
    );

    return this.bookings;
  }

  // ============================================================
  // GET ONE BOOKING
  // Always prefer PostgreSQL.
  // ============================================================

  async findOne(id: string): Promise<Booking> {
    if (this.databaseService) {
      try {
        const dbBooking = await this.databaseService.findBookingById(id);

        if (dbBooking) {
          this.bookings = [
            dbBooking,
            ...this.bookings.filter((b) => b.id !== id),
          ];

          return dbBooking;
        }
      } catch (error) {
        console.error(
          `[BookingsService] Database lookup failed for ${id}:`,
          error,
        );
      }
    }

    const booking = this.bookings.find((b) => b.id === id);

    if (booking) {
      return booking;
    }

    throw new Error(`Booking ${id} not found`);
  }

  // ============================================================
  // CREATE PENDING BOOKING
  // ============================================================

  async createPendingBooking(data: {
    orderId?: string;
    doctorId: string;
    slotId: string;
    slotDatetime: string;
    patientName: string;
    patientEmail: string;
    patientContact: string;
    patientId: string;
    bookedBy?: Booking["bookedBy"];
  }): Promise<{
    success: boolean;
    booking: Booking;
  }> {
    if (!data.patientId) {
      throw new Error(
        "Patient ID is required to create a booking. Please log in again and retry.",
      );
    }

    if (!data.doctorId) {
      throw new Error("Doctor ID is required.");
    }

    if (!data.slotId) {
      throw new Error("Slot ID is required.");
    }

    if (!data.slotDatetime) {
      throw new Error(
        "Past dates are not allowed for booking. Please select a future date and time.",
      );
    }

    if (new Date(data.slotDatetime) <= new Date()) {
      throw new Error(
        "Past dates are not allowed for booking. Please select a future date and time.",
      );
    }

    const doctor = await this.psychiatristsService.findOne(data.doctorId);

    if (!doctor) {
      throw new Error(`Doctor ${data.doctorId} not found.`);
    }

    const slot = doctor.upcomingSlots.find((s) => s.id === data.slotId);

    if (!slot || slot.status === "booked") {
      throw new Error("This consultation slot is no longer available.");
    }

    const fee = doctor.feeLkr;

    const commission = Math.round(
      fee * (initialPlatformSettings.commissionRate / 100),
    );

    const netDoctor = fee - commission;

    const bookingId =
      data.orderId ||
      `BK-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const now = new Date().toISOString();

    const pendingBooking: Booking = {
      id: bookingId,

      patientId: data.patientId,
      patientName: data.patientName || "Patient",
      patientEmail: data.patientEmail || "patient@example.lk",
      patientContact: data.patientContact,

      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorPhoto: doctor.photo,

      slotDatetime: data.slotDatetime,

      feeLkr: fee,
      platformCommissionLkr: commission,
      netDoctorEarningLkr: netDoctor,

      status: "pending",
      paymentStatus: "pending",

      payhereRef: "AWAITING_PAYHERE_WEBHOOK",

      bookedBy: data.bookedBy,

      videoLink: `https://meet.psynova.lk/room/PN-CONF-${Math.floor(
        1000 + Math.random() * 9000,
      )}`,

      confirmationSmsSent: false,
      reminder5MinSent: false,

      createdAt: now,

      statusHistory: [
        {
          status: "pending",
          timestamp: now,
          note: "Awaiting PayHere gateway payment notification",
        },
      ],
    };

    this.bookings = [
      pendingBooking,
      ...this.bookings.filter((b) => b.id !== bookingId),
    ];

    if (this.databaseService) {
      const saved = await this.databaseService.saveBooking(pendingBooking);

      if (!saved) {
        throw new Error("Booking could not be saved to PostgreSQL.");
      }
    }

    return {
      success: true,
      booking: pendingBooking,
    };
  }

  // ============================================================
  // PAYHERE VERIFICATION
  // ============================================================

  async verifyAndConfirmPayHerePayment(
    orderId: string,
    payherePaymentId: string | null,
    statusCode: number | string,
    note?: string,
    gateway?: {
      merchantId?: string;
      amount?: number | string;
      currency?: string;
      raw?: Record<string, any>;
    },
  ): Promise<{
    success: boolean;
    statusText: "success" | "pending" | "failed";
    isNewlyConfirmed: boolean;
    booking: Booking;
  }> {
    const codeNum = Number(statusCode);

    // IMPORTANT:
    // Always try PostgreSQL first so webhook processing
    // works even if another server instance received the
    // original booking creation request.

    let booking: Booking | undefined;

    if (this.databaseService) {
      booking = await this.databaseService.findBookingById(orderId);

      if (booking) {
        this.bookings = [
          booking,
          ...this.bookings.filter((b) => b.id !== orderId),
        ];
      }
    }

    if (!booking) {
      booking = this.bookings.find((b) => b.id === orderId);
    }

    if (!booking) {
      throw new Error(
        `PayHere callback received for unknown booking ${orderId}`,
      );
    }

    // Never confirm a payment for the wrong merchant, currency, or amount.
    // The MD5 proves the notification came from PayHere; this check proves
    // the notification also matches the booking we created.
    if (
      gateway?.merchantId &&
      gateway.merchantId !== process.env.PAYHERE_MERCHANT_ID
    ) {
      throw new Error(
        "PayHere merchant ID does not match the configured merchant.",
      );
    }

    if (gateway?.currency && gateway.currency !== "LKR") {
      throw new Error(`Unsupported PayHere currency: ${gateway.currency}`);
    }

    if (gateway?.amount !== undefined) {
      const paidAmount = Number(gateway.amount);
      if (
        !Number.isFinite(paidAmount) ||
        Math.abs(paidAmount - Number(booking.feeLkr)) > 0.01
      ) {
        throw new Error(
          `PayHere amount mismatch for ${orderId}: expected ${Number(booking.feeLkr).toFixed(2)}, received ${String(gateway.amount)}`,
        );
      }
    }

    // ==========================================================
    // SUCCESS
    // ==========================================================

    if (codeNum === 2) {
      const isNewlyConfirmed =
        booking.status !== "confirmed" || booking.paymentStatus !== "paid";

      // Do not repeatedly append confirmation history
      // for duplicate PayHere callbacks.

      const alreadyConfirmed =
        booking.status === "confirmed" && booking.paymentStatus === "paid";

      const updatedBooking: Booking = {
        ...booking,

        status: "confirmed",
        paymentStatus: "paid",

        payhereRef:
          payherePaymentId || booking.payhereRef || "PAYHERE-UNAVAILABLE",

        gatewayResponse: gateway
          ? {
              merchantId: gateway.merchantId,
              orderId,
              payhereAmount: Number(gateway.amount),
              payhereCurrency: gateway.currency,
              statusCode: codeNum,
              statusMessage: note,
              raw: gateway.raw,
            }
          : booking.gatewayResponse,

        statusHistory: alreadyConfirmed
          ? booking.statusHistory
          : [
              ...booking.statusHistory,
              {
                status: "confirmed",
                timestamp: new Date().toISOString(),
                note:
                  note ||
                  `Payment verified via PayHere webhook (status_code 2, Ref: ${
                    payherePaymentId ?? "N/A"
                  })`,
              },
            ],
      };

      // Mark slot as booked.
      try {
        const doctor = await this.psychiatristsService.findOne(
          booking.doctorId,
        );

        const matchingSlot = doctor.upcomingSlots.find(
          (s) =>
            new Date(s.datetime).getTime() ===
            new Date(booking!.slotDatetime).getTime(),
        );

        if (matchingSlot) {
          this.psychiatristsService.markSlotBooked(doctor.id, matchingSlot.id);
        }
      } catch (error) {
        console.warn("[PayHere] Slot booking status update warning:", error);
      }

      this.bookings = [
        updatedBooking,
        ...this.bookings.filter((b) => b.id !== orderId),
      ];

      if (this.databaseService) {
        const saved = await this.databaseService.saveBooking(updatedBooking);

        if (!saved) {
          throw new Error(
            `Booking ${orderId} was confirmed but could not be persisted to PostgreSQL.`,
          );
        }
      }

      console.log(`[PayHere] Booking ${orderId} CONFIRMED and PAID.`);

      return {
        success: true,
        statusText: "success",
        isNewlyConfirmed,
        booking: updatedBooking,
      };
    }

    // ==========================================================
    // PENDING
    // ==========================================================

    if (codeNum === 0) {
      const updatedBooking: Booking = {
        ...booking,

        status: "pending",
        paymentStatus: "pending",

        gatewayResponse: gateway
          ? {
              merchantId: gateway.merchantId,
              orderId,
              payhereAmount: Number(gateway.amount),
              payhereCurrency: gateway.currency,
              statusCode: codeNum,
              statusMessage: note,
              raw: gateway.raw,
            }
          : booking.gatewayResponse,

        statusHistory: [
          ...booking.statusHistory,
          {
            status: "pending",
            timestamp: new Date().toISOString(),
            note:
              note || "PayHere payment pending authorization (status_code 0)",
          },
        ],
      };

      this.bookings = [
        updatedBooking,
        ...this.bookings.filter((b) => b.id !== orderId),
      ];

      if (this.databaseService) {
        await this.databaseService.saveBooking(updatedBooking);
      }

      return {
        success: false,
        statusText: "pending",
        isNewlyConfirmed: false,
        booking: updatedBooking,
      };
    }

    // ==========================================================
    // FAILED / CANCELLED
    // ==========================================================

    if (codeNum === -1 || codeNum === -2 || codeNum === -3) {
      const statusNote =
        codeNum === -1
          ? `PayHere payment cancelled (status_code ${statusCode})`
          : codeNum === -2
            ? `PayHere payment failed (status_code ${statusCode})`
            : `PayHere payment chargeback received (status_code ${statusCode})`;

      const updatedBooking: Booking = {
        ...booking,

        status: "cancelled",
        paymentStatus: "failed",

        gatewayResponse: gateway
          ? {
              merchantId: gateway.merchantId,
              orderId,
              payhereAmount: Number(gateway.amount),
              payhereCurrency: gateway.currency,
              statusCode: codeNum,
              statusMessage: note,
              raw: gateway.raw,
            }
          : booking.gatewayResponse,

        statusHistory: [
          ...booking.statusHistory,
          {
            status: "cancelled",
            timestamp: new Date().toISOString(),
            note: note || statusNote,
          },
        ],
      };

      this.bookings = [
        updatedBooking,
        ...this.bookings.filter((b) => b.id !== orderId),
      ];

      if (this.databaseService) {
        await this.databaseService.saveBooking(updatedBooking);
      }

      console.log(`[PayHere] Booking ${orderId} payment status ${statusCode}.`);

      return {
        success: false,
        statusText: "failed",
        isNewlyConfirmed: false,
        booking: updatedBooking,
      };
    }

    throw new Error(
      `Unknown PayHere status code ${statusCode} for booking ${orderId}`,
    );
  }

  // ============================================================
  // LEGACY DIRECT BOOKING
  // ============================================================

  async createBooking(data: {
    doctorId: string;
    slotId: string;
    slotDatetime: string;
    patientName: string;
    patientEmail: string;
    patientContact: string;
    patientId: string;
    bookedBy?: Booking["bookedBy"];
  }): Promise<{
    success: boolean;
    booking: Booking;
  }> {
    if (new Date(data.slotDatetime) <= new Date()) {
      throw new Error(
        "Past dates are not allowed for booking. Please select a future date and time.",
      );
    }

    const doctor = await this.psychiatristsService.findOne(data.doctorId);

    const slot = doctor.upcomingSlots.find((s) => s.id === data.slotId);

    if (!slot || slot.status === "booked") {
      throw new Error("This consultation slot is no longer available.");
    }

    const fee = doctor.feeLkr;

    const commission = Math.round(
      fee * (initialPlatformSettings.commissionRate / 100),
    );

    const netDoctor = fee - commission;

    const now = new Date().toISOString();

    const newBooking: Booking = {
      id: `BK-${Math.floor(10000 + Math.random() * 90000)}`,

      patientId: data.patientId,

      patientName: data.patientName || "Patient",

      patientEmail: data.patientEmail || "patient@example.lk",

      patientContact: data.patientContact,

      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorPhoto: doctor.photo,

      slotDatetime: data.slotDatetime,

      feeLkr: fee,
      platformCommissionLkr: commission,
      netDoctorEarningLkr: netDoctor,

      status: "confirmed",
      paymentStatus: "paid",

      payhereRef: `PAYHERE-${Math.floor(1000000 + Math.random() * 9000000)}`,

      bookedBy: data.bookedBy,

      videoLink: `https://meet.psynova.lk/room/PN-CONF-${Math.floor(
        1000 + Math.random() * 9000,
      )}`,

      confirmationSmsSent: false,
      reminder5MinSent: false,

      createdAt: now,

      statusHistory: [
        {
          status: "pending",
          timestamp: now,
        },
        {
          status: "confirmed",
          timestamp: now,
          note: "Payment verified via PayHere (LKR)",
        },
      ],
    };

    this.psychiatristsService.markSlotBooked(doctor.id, data.slotId);

    this.bookings = [
      newBooking,
      ...this.bookings.filter((b) => b.id !== newBooking.id),
    ];

    if (this.databaseService) {
      await this.databaseService.saveBooking(newBooking);
    }

    return {
      success: true,
      booking: newBooking,
    };
  }

  // ============================================================
  // DOCTOR CANCELS BOOKING + REQUESTS RESOLUTION
  // ============================================================

  async cancelBookingByDoctor(
    id: string,
    resolutionType: "reschedule" | "refund",
    note?: string,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status !== "confirmed") {
      throw new Error(
        "Only confirmed bookings can be cancelled by the doctor.",
      );
    }

    const now = new Date().toISOString();

    const updated: Booking = {
      ...booking,

      status: "cancelled",

      cancelledBy: "DOCTOR",
      cancellationReason: note || "Session cancelled by doctor.",
      cancelledAt: now,

      resolutionType,

      ...(resolutionType === "reschedule"
        ? {
            rescheduleRequestedAt: now,
            rescheduleRequestedBy: booking.doctorId,
            rescheduleStatus: "pending_patient" as const,
          }
        : {}),

      ...(resolutionType === "refund"
        ? {
            refundStatus: "requested" as const,
            refundRequestedBy: booking.doctorId,
            refundRequestedAt: now,
            refundAmount: booking.feeLkr,
          }
        : {}),

      statusHistory: [
        ...booking.statusHistory,
        {
          status: "cancelled",
          timestamp: now,
          note:
            resolutionType === "reschedule"
              ? "Cancelled by doctor. Reschedule requested; waiting for patient acceptance."
              : "Cancelled by doctor. Refund requested; waiting for admin approval.",
        },
      ],
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  // ============================================================
  // ADMIN APPROVES REFUND REQUEST
  // ============================================================

  async approveRefund(
    id: string,
    adminId: string,
    note?: string,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.resolutionType !== "refund") {
      throw new Error("This booking does not have a refund resolution.");
    }

    if (booking.refundStatus !== "requested") {
      throw new Error(
        `Refund cannot be approved from status "${booking.refundStatus || "none"}".`,
      );
    }

    const now = new Date().toISOString();

    const updated: Booking = {
      ...booking,

      refundStatus: "approved",
      refundApprovedBy: adminId,
      refundApprovedAt: now,

      statusHistory: [
        ...booking.statusHistory,
        {
          status: "cancelled",
          timestamp: now,
          note:
            note ||
            `Refund approved by admin ${adminId}. Awaiting refund processing.`,
        },
      ],
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  // ============================================================
  // ADMIN REJECTS REFUND REQUEST
  // ============================================================

  async rejectRefund(
    id: string,
    adminId: string,
    note?: string,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.resolutionType !== "refund") {
      throw new Error("This booking does not have a refund resolution.");
    }

    if (booking.refundStatus !== "requested") {
      throw new Error(
        `Refund cannot be rejected from status "${booking.refundStatus || "none"}".`,
      );
    }

    const now = new Date().toISOString();

    const updated: Booking = {
      ...booking,

      refundStatus: "rejected",
      refundApprovedBy: adminId,
      refundApprovedAt: now,

      statusHistory: [
        ...booking.statusHistory,
        {
          status: "cancelled",
          timestamp: now,
          note: note || `Refund rejected by admin ${adminId}.`,
        },
      ],
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }
  // ============================================================
  // COMPLETE
  // ============================================================

  async completeBooking(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    const updated: Booking = {
      ...booking,

      status: "completed",

      paymentStatus:
        booking.paymentStatus === "paid"
          ? "payout_pending"
          : booking.paymentStatus,

      statusHistory: [
        ...booking.statusHistory,
        {
          status: "completed",
          timestamp: new Date().toISOString(),
          note: "Consultation marked completed",
        },
      ],
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  // ============================================================
  // PAYOUT
  // ============================================================

  async markPayoutPaid(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    const updated: Booking = {
      ...booking,

      paymentStatus: "payout_completed",
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  // ============================================================
  // SMS FLAGS
  // ============================================================

  async markConfirmationSmsSent(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    const updated: Booking = {
      ...booking,

      confirmationSmsSent: true,

      confirmationSmsSentAt: new Date().toISOString(),
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  async markReminder5MinSent(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    const updated: Booking = {
      ...booking,

      reminder5MinSent: true,

      reminder5MinSentAt: new Date().toISOString(),
    };

    this.bookings = [updated, ...this.bookings.filter((b) => b.id !== id)];

    if (this.databaseService) {
      await this.databaseService.saveBooking(updated);
    }

    return updated;
  }

  // ============================================================
  // 5-MINUTE REMINDER SCANNER
  // ============================================================

  async scanAndDispatch5MinReminders(smsService: any): Promise<{
    dispatchedCount: number;
    details: any[];
  }> {
    // Always refresh from PostgreSQL before scanning.
    if (this.databaseService) {
      try {
        this.bookings = await this.databaseService.getAllBookings();
      } catch (error) {
        console.error("[Reminder Scanner] Failed to refresh bookings:", error);
      }
    }

    const now = Date.now();

    // Reminder should be sent approximately 5 minutes
    // before the consultation.
    const fiveMinutesMs = 5 * 60 * 1000;

    // Allow the scheduler a 1-minute execution window.
    const windowMs = 60 * 1000;

    const details: any[] = [];

    let count = 0;

    for (let i = 0; i < this.bookings.length; i++) {
      const booking = this.bookings[i];

      // Only confirmed + successfully paid bookings
      // are eligible for the reminder.
      if (
        booking.status !== "confirmed" ||
        booking.paymentStatus !== "paid" ||
        booking.reminder5MinSent ||
        !booking.patientContact
      ) {
        continue;
      }

      if (!booking.slotDatetime) {
        console.warn(
          `[Reminder Scanner] Booking ${booking.id} has no slotDatetime.`,
        );
        continue;
      }

      const slotTime = new Date(booking.slotDatetime).getTime();

      if (!Number.isFinite(slotTime)) {
        console.error(
          `[Reminder Scanner] Invalid slotDatetime for ${booking.id}:`,
          booking.slotDatetime,
        );
        continue;
      }

      const diff = slotTime - now;

      // Target:
      //
      // appointment - now ≈ 5 minutes
      //
      // Accept approximately:
      // 4 minutes → 6 minutes
      //
      if (diff < fiveMinutesMs - windowMs || diff > fiveMinutesMs + windowMs) {
        continue;
      }

      console.log(
        `[Automated 5-Min Reminder] Sending reminder for ${booking.id}`,
      );

      console.log(
        `[Automated 5-Min Reminder] slotDatetime: ${booking.slotDatetime}`,
      );

      console.log(
        `[Automated 5-Min Reminder] minutes until session: ${diff / 60000}`,
      );

      try {
        const smsRes = await smsService.send5MinReminder(booking);

        if (!smsRes?.success || smsRes.status !== "DELIVERED") {
          details.push({
            bookingId: booking.id,
            patient: booking.patientName,
            recipient: booking.patientContact,
            success: false,
            res: smsRes,
          });

          continue;
        }

        const updated: Booking = {
          ...booking,

          reminder5MinSent: true,

          reminder5MinSentAt: new Date().toISOString(),
        };

        this.bookings[i] = updated;

        if (this.databaseService) {
          const saved = await this.databaseService.saveBooking(updated);

          if (!saved) {
            console.error(
              `[Automated 5-Min Reminder] Failed to save reminder flag for ${booking.id}`,
            );
            continue;
          }
        }

        count++;

        details.push({
          bookingId: booking.id,
          patient: booking.patientName,
          recipient: booking.patientContact,
          success: true,
          res: smsRes,
        });

        console.log(
          `[Automated 5-Min Reminder] Successfully sent for ${booking.id}`,
        );
      } catch (error) {
        console.error(
          `[Automated 5-Min Reminder] Error sending for ${booking.id}:`,
          error,
        );
      }
    }

    return {
      dispatchedCount: count,
      details,
    };
  }
}
