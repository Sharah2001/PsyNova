import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import type {
  BookingStatus,
  CancellationActor,
  PaymentStatus,
  RefundStatus,
  RescheduleStatus,
  ResolutionType,
} from "../../../lib/types";
import { UserRole } from "../../../lib/types";

export interface StatusHistoryEntryJson {
  status: string;
  timestamp: string;
  updatedBy: string;
  reason?: string;
  note?: string;
}

export interface GatewayResponseJson {
  merchantId?: string;
  orderId?: string;
  payhereAmount?: number;
  payhereCurrency?: string;
  statusCode?: number;
  statusMessage?: string;
  method?: string;
  raw?: Record<string, any>;
}

export interface BookingCreatorJson {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

@Entity("bookings")
export class BookingEntity {
  @PrimaryColumn("varchar")
  id!: string;

  @Column("varchar", { name: "doctor_id" })
  doctorId!: string;

  @Column("varchar", { name: "doctor_name" })
  doctorName!: string;

  @Column({ name: "patient_id" })
  patientId!: string;

  @Column("varchar", { name: "patient_name" })
  patientName!: string;

  @Column("varchar", { name: "patient_email" })
  patientEmail!: string;

  @Column("varchar", { name: "patient_contact" })
  patientContact!: string;

  @Column("varchar", { name: "slot_id" })
  slotId!: string;

  @Column("varchar", { name: "slot_datetime" })
  slotDatetime!: string;

  @Column("varchar")
  status!: BookingStatus;

  @Column("varchar", { name: "payment_status" })
  paymentStatus!: PaymentStatus;

  @Column("boolean", { name: "confirmation_sms_sent", default: false })
  confirmationSmsSent!: boolean;

  @Column("timestamptz", { name: "confirmation_sms_sent_at", nullable: true })
  confirmationSmsSentAt!: Date | null;

  @Column("boolean", { name: "reminder_5_min_sent", default: false })
  reminder5MinSent!: boolean;

  @Column("timestamptz", { name: "reminder_5_min_sent_at", nullable: true })
  reminder5MinSentAt!: Date | null;

  @Column("integer", { name: "fee_lkr" })
  feeLkr!: number;

  @Column("integer", { name: "platform_commission_lkr" })
  platformCommissionLkr!: number;

  @Column("integer", { name: "net_doctor_earning_lkr" })
  netDoctorEarningLkr!: number;

  @Column("varchar", { name: "payhere_ref", nullable: true })
  payhereRef!: string | null;

  @Column("jsonb", { name: "booked_by", nullable: true })
  bookedBy!: BookingCreatorJson | null;

  @Column("varchar", { name: "video_link", nullable: true })
  videoLink!: string | null;

  // JSONB column for status transition audit trail
  @Column("jsonb", { name: "status_history", default: () => "'[]'::jsonb" })
  statusHistory!: StatusHistoryEntryJson[];
  @Column("varchar", {
    name: "cancelled_by",
    nullable: true,
  })
  cancelledBy!: CancellationActor | null;

  @Column("text", {
    name: "cancellation_reason",
    nullable: true,
  })
  cancellationReason!: string | null;

  @Column("timestamptz", {
    name: "cancelled_at",
    nullable: true,
  })
  cancelledAt!: Date | null;

  @Column("varchar", {
    name: "resolution_type",
    default: "none",
  })
  resolutionType!: ResolutionType;

  @Column("varchar", {
    name: "reschedule_status",
    default: "none",
  })
  rescheduleStatus!: RescheduleStatus;

  @Column("timestamptz", {
    name: "reschedule_requested_at",
    nullable: true,
  })
  rescheduleRequestedAt!: Date | null;

  @Column("varchar", {
    name: "reschedule_requested_by",
    nullable: true,
  })
  rescheduleRequestedBy!: string | null;

  @Column("varchar", {
    name: "previous_slot_id",
    nullable: true,
  })
  previousSlotId!: string | null;

  @Column("varchar", {
    name: "previous_slot_datetime",
    nullable: true,
  })
  previousSlotDatetime!: string | null;

  @Column("varchar", {
    name: "proposed_slot_id",
    nullable: true,
  })
  proposedSlotId!: string | null;

  @Column("varchar", {
    name: "proposed_slot_datetime",
    nullable: true,
  })
  proposedSlotDatetime!: string | null;

  @Column("varchar", {
    name: "refund_requested_by",
    nullable: true,
  })
  refundRequestedBy!: string | null;

  @Column("timestamptz", {
    name: "refund_requested_at",
    nullable: true,
  })
  refundRequestedAt!: Date | null;

  @Column("varchar", {
    name: "refund_approved_by",
    nullable: true,
  })
  refundApprovedBy!: string | null;

  @Column("timestamptz", {
    name: "refund_approved_at",
    nullable: true,
  })
  refundApprovedAt!: Date | null;

  @Column("decimal", {
    name: "refund_amount",
    precision: 12,
    scale: 2,
    nullable: true,
  })
  refundAmount!: number | null;

  @Column("varchar", {
    name: "refund_reference",
    nullable: true,
  })
  refundReference!: string | null;

  @Column("varchar", {
    name: "refund_status",
    default: "none",
  })
  refundStatus!: RefundStatus;

  // JSONB column for payment gateway payload audit
  @Column("jsonb", { name: "gateway_response", nullable: true })
  gatewayResponse!: GatewayResponseJson | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
