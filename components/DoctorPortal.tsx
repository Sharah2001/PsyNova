"use client";

import React, { useRef, useState } from "react";
import { usePsyNova } from "@/lib/store";
import { BoostTier, Booking } from "@/lib/types";
import { JitsiVideoModal } from "@/components/JitsiVideoModal";
import {
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  Crown,
  Video,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  XCircle,
} from "lucide-react";

export const DoctorPortal: React.FC = () => {
  const {
    user,
    psychiatrists,
    bookings,
    uploadDoctorDoc,
    deleteDoctorDoc,
    addDoctorSlot,
    boostPsychiatrist,
    unboostPsychiatrist,
    platformSettings,
  } = usePsyNova();

  // Find the logged-in psychiatrist only.
  const currentDoc = psychiatrists.find(
    (d) => d.id === user.doctorId || d.slmcRegNo === user.slmcRegNo,
  );

  // Prevent rendering another doctor's profile if the logged-in doctor
  // cannot be matched.
  if (!currentDoc) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <div className="p-8 rounded-[28px] bg-[#F7F5EF] border border-red-200 shadow-md">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <div>
              <h2 className="font-bold">Doctor profile not found</h2>
              <p className="text-xs mt-1 text-red-700">
                Your psychiatrist account could not be matched with a registered
                psychiatrist profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // DOCUMENT STATE
  // ---------------------------------------------------------

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [newDocName, setNewDocName] = useState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [docUploadSuccess, setDocUploadSuccess] = useState(false);

  // ---------------------------------------------------------
  // JITSI
  // ---------------------------------------------------------

  const [activeJitsiBooking, setActiveJitsiBooking] =
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState<Booking | null>(null);

  // ---------------------------------------------------------
  // SMS TESTING
  // ---------------------------------------------------------

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [testSmsPhone, setTestSmsPhone] = useState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [testSmsMsg, setTestSmsMsg] = useState(
    "PsyNova LK: Your doctor is ready for the tele-consultation.",
  );
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [smsSending, setSmsSending] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [smsResult, setSmsResult] = useState<string | null>(null);

  // ---------------------------------------------------------
  // BOOST
  // ---------------------------------------------------------

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [boostAlert, setBoostAlert] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // ---------------------------------------------------------
  // SLOT CREATION
  // ---------------------------------------------------------

  const todayStr = new Date().toISOString().split("T")[0];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [slotDate, setSlotDate] = useState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [slotTime, setSlotTime] = useState("09:00");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [slotDuration, setSlotDuration] = useState(45);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [slotError, setSlotError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [slotSuccess, setSlotSuccess] = useState<string | null>(null);

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();

    setSlotError(null);
    setSlotSuccess(null);

    if (!slotDate) {
      setSlotError("Please select a valid consultation date.");
      return;
    }

    const selectedDateTime = new Date(`${slotDate}T${slotTime}:00`);

    if (selectedDateTime <= new Date()) {
      setSlotError(
        "Past dates and times are strictly prohibited! Please select a future date and time for booking availability.",
      );
      return;
    }

    const newSlot = {
      // eslint-disable-next-line react-hooks/purity
      id: `slot-${Date.now()}`,
      datetime: selectedDateTime.toISOString(),
      durationMins: slotDuration,
      status: "available" as const,
    };

    addDoctorSlot(currentDoc.id, newSlot);

    setSlotSuccess(
      `Future slot added successfully for ${selectedDateTime.toLocaleString(
        "en-US",
        {
          dateStyle: "medium",
          timeStyle: "short",
        },
      )}`,
    );

    setSlotDate("");
  };

  // ---------------------------------------------------------
  // DOCTOR BOOKINGS
  // ---------------------------------------------------------

  const doctorBookings = bookings.filter(
    (booking) => booking.doctorId === currentDoc.id,
  );

  // ---------------------------------------------------------
  // CONSULTATION ACTION STATE
  // ---------------------------------------------------------

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(
    null,
  );

  const [cancelBookingTarget, setCancelBookingTarget] =
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState<Booking | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cancellationReason, setCancellationReason] = useState("");

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cancellationError, setCancellationError] = useState<string | null>(
    null,
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [actionLoading, setActionLoading] = useState(false);

  // ---------------------------------------------------------
  // FINANCIAL CALCULATIONS
  // Only paid/confirmed/completed sessions count.
  // ---------------------------------------------------------

  const financialBookings = doctorBookings.filter(
    (booking) =>
      booking.paymentStatus === "paid" &&
      ["confirmed", "completed"].includes(booking.status),
  );

  const grossEarnings = financialBookings.reduce(
    (sum, booking) => sum + booking.feeLkr,
    0,
  );

  const platformCommission = financialBookings.reduce(
    (sum, booking) => sum + booking.platformCommissionLkr,
    0,
  );

  const netEarnings = financialBookings.reduce(
    (sum, booking) => sum + booking.netDoctorEarningLkr,
    0,
  );

  // ---------------------------------------------------------
  // BOOST COUNT
  // ---------------------------------------------------------

  const boostedCount = psychiatrists.filter(
    (doctor) => doctor.isBoosted,
  ).length;

  // ---------------------------------------------------------
  // DOCUMENT UPLOAD
  // ---------------------------------------------------------

  const handleDocUpload = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDocName.trim()) {
      return;
    }

    uploadDoctorDoc(currentDoc.id, newDocName.trim());

    setDocUploadSuccess(true);
    setNewDocName("");

    setTimeout(() => {
      setDocUploadSuccess(false);
    }, 2000);
  };

  // ---------------------------------------------------------
  // BOOST
  // ---------------------------------------------------------

  const handleBoost = (tier: BoostTier) => {
    const res = boostPsychiatrist(currentDoc.id, tier);

    setBoostAlert(res);

    setTimeout(() => {
      setBoostAlert(null);
    }, 3000);
  };

  // ---------------------------------------------------------
  // COMPLETE CONSULTATION
  // ---------------------------------------------------------

  const handleCompleteBooking = async (booking: Booking) => {
    if (completingBookingId) {
      return;
    }

    setCompletingBookingId(booking.id);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          bookingId: booking.id,
          doctorId: currentDoc.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to complete the consultation.");
      }

      window.location.reload();
    } catch (error) {
      console.error("[DoctorPortal] Complete booking error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to complete the consultation.",
      );
    } finally {
      setCompletingBookingId(null);
    }
  };

  // ---------------------------------------------------------
  // CANCEL CONSULTATION
  // ---------------------------------------------------------

  const handleCancelBooking = async () => {
    if (!cancelBookingTarget) {
      return;
    }

    const reason = cancellationReason.trim();

    if (reason.length < 5) {
      setCancellationError(
        "Please provide a cancellation reason of at least 5 characters.",
      );
      return;
    }

    setActionLoading(true);
    setCancellationError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "doctor-cancel",
          bookingId: cancelBookingTarget.id,
          doctorId: currentDoc.id,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to cancel the consultation.");
      }

      setCancelBookingTarget(null);
      setCancellationReason("");
      setCancellationError(null);

      window.location.reload();
    } catch (error) {
      console.error("[DoctorPortal] Cancellation error:", error);

      setCancellationError(
        error instanceof Error
          ? error.message
          : "Unable to cancel the consultation.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------------------------------------------------
  // CLOSE CANCEL MODAL
  // ---------------------------------------------------------

  const closeCancelModal = () => {
    if (actionLoading) {
      return;
    }

    setCancelBookingTarget(null);
    setCancellationReason("");
    setCancellationError(null);
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div
      id="doctor-portal"
      className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-10 scroll-smooth"
    >
      {/* =====================================================
          PROFILE
      ====================================================== */}
      <section id="doctor-profile" className="scroll-mt-24">
        <div className="p-6 sm:p-8 rounded-[28px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={currentDoc.photo}
              alt={currentDoc.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#768c6e]/30 shadow-md"
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#2D3728]">
                  {currentDoc.name}
                </h1>

                {currentDoc.status === "approved" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#768c6e]/15 text-[#6B7D5E] border border-[#768c6e]/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    SLMC Approved Practitioner
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-[#2D3728]/80 mt-0.5">
                {currentDoc.title}
              </p>

              <p className="text-xs font-mono text-[#6B7D5E] mt-1">
                Practitioner ID: {currentDoc.id} • SLMC Reg:{" "}
                {currentDoc.slmcRegNo}
              </p>
            </div>
          </div>

          {/* Current Boost Badge */}
          <div className="p-4 rounded-2xl bg-white/80 border border-[#768c6e]/20 text-xs space-y-1 text-right">
            <span className="text-[#2D3728]/70 block font-medium">
              Spotlight Status
            </span>

            {currentDoc.isBoosted ? (
              <span className="font-bold text-amber-800 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1">
                👑 Active ({currentDoc.boostTier})
              </span>
            ) : (
              <span className="font-semibold text-[#2D3728]/70">
                Standard Directory Listing
              </span>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          EARNINGS
      ====================================================== */}
      <section id="doctor-earnings" className="scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Gross */}
          <div className="psynova-card p-6 space-y-2">
            <span className="text-xs font-semibold text-[#6B7D5E] uppercase tracking-wider">
              Gross Consultations
            </span>

            <div className="text-2xl sm:text-3xl font-extrabold text-[#2D3728] font-mono">
              LKR {grossEarnings.toLocaleString()}
            </div>

            <p className="text-[11px] text-[#2D3728]/60">
              {financialBookings.length} paid sessions
            </p>
          </div>

          {/* Commission */}
          <div className="psynova-card p-6 space-y-2">
            <span className="text-xs font-semibold text-[#6B7D5E] uppercase tracking-wider">
              Platform Commission ({platformSettings.commissionRate}%)
            </span>

            <div className="text-2xl sm:text-3xl font-extrabold text-[#2D3728] font-mono">
              LKR {platformCommission.toLocaleString()}
            </div>

            <p className="text-[11px] text-[#2D3728]/60">
              Deducted for tele-hosting & Notify.lk notifications
            </p>
          </div>

          {/* Net */}
          <div className="p-6 rounded-[22px] bg-[#6B7D5E] text-[#F7F5EF] shadow-lg space-y-2 border border-[#6B7D5E]">
            <span className="text-xs font-semibold text-[#F7F5EF]/80 uppercase tracking-wider block">
              Net Doctor Earnings
            </span>

            <div className="text-2xl sm:text-3xl font-extrabold font-mono">
              LKR {netEarnings.toLocaleString()}
            </div>

            <p className="text-[11px] text-[#F7F5EF]/80">
              Disbursed via automated admin payout cycle
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          BOOST
      ====================================================== */}
      <section id="doctor-boost" className="scroll-mt-24">
        {boostAlert && (
          <div
            className={`mb-4 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              boostAlert.success
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-red-100 text-red-900 border border-red-300"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{boostAlert.message}</span>
          </div>
        )}

        <div className="p-6 sm:p-8 rounded-[28px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#768c6e]/15 pb-4">
            <div>
              <h2 className="text-xl font-bold text-[#2D3728] flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600" />
                Doctor Profile Boosting Packages
              </h2>

              <p className="text-xs text-[#2D3728]/70 mt-0.5">
                Increase patient reach by featuring your profile with a crown
                badge at the top of the doctor directory.
              </p>
            </div>

            <div className="text-xs font-mono font-bold bg-[#768c6e]/15 text-[#6B7D5E] px-3 py-1.5 rounded-full border border-[#768c6e]/20">
              Platform Boost Slots: {boostedCount} /{" "}
              {platformSettings.maxBoostedDoctors} Max
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 1 Day */}
            <div className="p-6 rounded-2xl bg-white/80 border border-[#768c6e]/20 space-y-4 hover:border-[#768c6e] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7D5E] bg-[#768c6e]/10 px-2.5 py-0.5 rounded-full">
                  1-Day Boost
                </span>

                <span className="text-xl font-extrabold font-mono text-[#2D3728]">
                  LKR 500
                </span>
              </div>

              <p className="text-xs text-[#2D3728]/80 leading-relaxed">
                Crown featured badge & top listing priority for 24 hours.
              </p>

              <button
                onClick={() => handleBoost("1-day")}
                className="btn-primary w-full text-xs py-2.5"
              >
                Request 1-Day Boost (LKR 500)
              </button>
            </div>

            {/* 3 Day */}
            <div className="p-6 rounded-2xl bg-white/80 border-2 border-amber-500/40 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-500/20 px-2.5 py-0.5 rounded-full">
                  3-Day Prime Boost
                </span>

                <span className="text-xl font-extrabold font-mono text-[#2D3728]">
                  LKR 1,400
                </span>
              </div>

              <p className="text-xs text-[#2D3728]/80 leading-relaxed">
                Maximum visibility package: Crown badge + priority ranking
                across all search filters for 72 hours.
              </p>

              <button
                onClick={() => handleBoost("3-day")}
                className="btn-primary w-full text-xs py-2.5 bg-amber-700 hover:bg-amber-800"
              >
                Request 3-Day Prime Boost (LKR 1,400)
              </button>
            </div>
          </div>

          {currentDoc.isBoosted && (
            <div className="pt-2">
              <button
                onClick={() => unboostPsychiatrist(currentDoc.id)}
                className="btn-secondary text-xs py-1.5 px-4 text-[#D9635A] border-[#D9635A]/50 hover:bg-[#D9635A]/10"
              >
                Cancel Current Boost
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          AVAILABILITY
      ====================================================== */}
      <section id="doctor-availability" className="scroll-mt-24">
        <div className="p-6 sm:p-8 rounded-[28px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md space-y-6">
          <div className="border-b border-[#768c6e]/15 pb-4">
            <h2 className="text-xl font-bold text-[#2D3728] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#768c6e]" />
              Manage Future Availability Slots
            </h2>

            <p className="text-xs text-[#2D3728]/70 mt-0.5">
              Add future consultation slots for patient bookings. Past dates and
              times are strictly disallowed.
            </p>
          </div>

          <form
            onSubmit={handleAddSlot}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                Select Future Date
              </label>

              <input
                type="date"
                required
                min={todayStr}
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs text-[#2D3728] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                Start Time
              </label>

              <input
                type="time"
                required
                value={slotTime}
                onChange={(e) => setSlotTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs text-[#2D3728] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                Duration (Mins)
              </label>

              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs text-[#2D3728] focus:outline-none"
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Future Slot
              </button>
            </div>
          </form>

          {slotError && (
            <div className="p-3 rounded-xl bg-red-100 text-red-900 border border-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{slotError}</span>
            </div>
          )}

          {slotSuccess && (
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{slotSuccess}</span>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#6B7D5E] uppercase tracking-wider mb-2">
              Active Future Slots
            </h3>

            {currentDoc.upcomingSlots.length === 0 ? (
              <p className="text-xs text-[#2D3728]/70 italic p-4 rounded-xl bg-white/50 border border-[#768c6e]/15">
                No future slots listed. Please use the form above to add future
                consultation hours.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {currentDoc.upcomingSlots.map((slot) => {
                  const dateObj = new Date(slot.datetime);
                  const isPast = dateObj <= new Date();

                  return (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between ${
                        isPast
                          ? "bg-red-50/60 border-red-200 text-red-700 opacity-60"
                          : slot.status === "booked"
                            ? "bg-amber-50/80 border-amber-200 text-amber-900"
                            : "bg-white/80 border-[#768c6e]/20 text-[#2D3728]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">
                          {dateObj.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        <span className="text-[10px] font-mono uppercase font-bold">
                          {isPast ? "Past (Invalid)" : slot.status}
                        </span>
                      </div>

                      <span className="text-xs font-mono mt-1 font-medium">
                        {dateObj.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ({slot.durationMins}m)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          DOCUMENTS
      ====================================================== */}
      <section id="doctor-documents" className="scroll-mt-24">
        <div className="p-6 sm:p-8 rounded-[28px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md space-y-6">
          <div className="border-b border-[#768c6e]/15 pb-4">
            <h2 className="text-xl font-bold text-[#2D3728] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#768c6e]" />
              SLMC Qualification Document Vault
            </h2>

            <p className="text-xs text-[#2D3728]/70 mt-0.5">
              Store and manage your SLMC Medical Board registration, MBBS
              certificates, and specialization degrees.
            </p>
          </div>

          <form
            onSubmit={handleDocUpload}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <input
              type="text"
              required
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              placeholder="e.g. SLMC_Renewal_Certificate_2026.pdf"
              className="flex-1 w-full px-4 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs text-[#2D3728] focus:outline-none"
            />

            <button
              type="submit"
              className="btn-primary text-xs py-2.5 px-5 shrink-0 whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Document
            </button>
          </form>

          {docUploadSuccess && (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Document uploaded for SLMC admin verification.
            </p>
          )}

          <div className="space-y-2">
            {currentDoc.documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-2xl bg-white/80 border border-[#768c6e]/15 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#768c6e]" />

                  <div>
                    <span className="font-semibold text-[#2D3728] block">
                      {doc.name}
                    </span>

                    <span className="text-[11px] text-[#2D3728]/60">
                      Uploaded on {doc.uploadDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      doc.status === "Approved"
                        ? "bg-emerald-500/15 text-emerald-800 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-800 border border-amber-500/30"
                    }`}
                  >
                    {doc.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => deleteDoctorDoc(currentDoc.id, doc.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          CONSULTATIONS
      ====================================================== */}
      <section id="doctor-consultations" className="scroll-mt-24">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#2D3728]">
            Patient Consultation Log
          </h2>

          <div className="rounded-[24px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#768c6e]/10 border-b border-[#768c6e]/20 text-[#6B7D5E] font-semibold uppercase text-[11px]">
                <tr>
                  <th className="p-4">Booking ID</th>
                  <th className="p-4">Patient Contact</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Gross Fee</th>
                  <th className="p-4">Net Doctor Earning</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#768c6e]/15">
                {doctorBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-xs text-[#2D3728]/70 italic"
                    >
                      No sessions logged yet.
                    </td>
                  </tr>
                ) : (
                  doctorBookings.map((booking) => {
                    const sessionTime = new Date(booking.slotDatetime);
                    const now = new Date();

                    /*
                     * Find the matching slot so we can determine
                     * the actual consultation end time.
                     */
                    const matchingSlot = currentDoc.upcomingSlots.find(
                      (slot) => slot.id === booking.slotId,
                    );

                    const durationMins = matchingSlot?.durationMins ?? 45;

                    const sessionEnd = new Date(
                      sessionTime.getTime() + durationMins * 60 * 1000,
                    );

                    const isBeforeSession =
                      sessionTime.getTime() > now.getTime();

                    const isActiveSession =
                      sessionTime.getTime() <= now.getTime() &&
                      sessionEnd.getTime() > now.getTime();

                    const isExpired =
                      sessionEnd.getTime() <= now.getTime() &&
                      booking.status === "confirmed";

                    const canComplete =
                      booking.status === "confirmed" &&
                      !isBeforeSession &&
                      !isExpired;

                    return (
                      <tr
                        key={booking.id}
                        className={`hover:bg-white/60 transition-colors ${
                          isExpired ? "opacity-60" : ""
                        }`}
                      >
                        <td className="p-4 font-mono font-bold text-[#2D3728]">
                          {booking.id}
                        </td>

                        <td className="p-4">
                          <span className="font-semibold text-[#2D3728] block">
                            {booking.patientName}
                          </span>

                          <span className="text-[11px] text-[#2D3728]/60 font-mono">
                            {booking.patientContact}
                          </span>
                        </td>

                        <td className="p-4 text-[#2D3728]/80 font-mono">
                          {sessionTime.toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>

                        <td className="p-4 font-mono text-[#2D3728]">
                          LKR {booking.feeLkr.toLocaleString()}
                        </td>

                        <td className="p-4 font-mono font-bold text-[#6B7D5E]">
                          LKR {booking.netDoctorEarningLkr.toLocaleString()}
                        </td>

                        <td className="p-4 text-right">
                          {/* COMPLETED */}
                          {booking.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed
                            </span>
                          )}

                          {/* CANCELLED */}
                          {booking.status === "cancelled" && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2.5 py-1 rounded-full">
                                <XCircle className="w-3.5 h-3.5" />
                                {booking.cancelledBy === "DOCTOR"
                                  ? "Cancelled by Doctor"
                                  : "Cancelled"}
                              </span>

                              {booking.cancelledBy === "DOCTOR" && (
                                <span className="text-[10px] font-semibold text-amber-800">
                                  Full Refund:{" "}
                                  {booking.refundStatus || "requested"}
                                </span>
                              )}
                            </div>
                          )}

                          {/* EXPIRED */}
                          {booking.status === "confirmed" && isExpired && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D3728]/50">
                              <Clock className="w-3.5 h-3.5" />
                              Expired
                            </span>
                          )}

                          {/* CONFIRMED */}
                          {booking.status === "confirmed" && !isExpired && (
                            <div className="flex flex-col items-end gap-3">
                              {/* SMS STATUS */}
                              <div className="text-left text-[10px] space-y-0.5">
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Auto-Payment SMS Sent
                                </span>

                                <div>
                                  {booking.reminder5MinSent ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      5-Min Reminder Sent
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      5-Min Reminder Armed
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* ACTIONS */}
                              <div className="flex flex-wrap justify-end gap-2">
                                {/* JITSI */}
                                <button
                                  type="button"
                                  onClick={() => setActiveJitsiBooking(booking)}
                                  className="btn-primary text-[11px] py-1.5 px-3 inline-flex items-center gap-1 shadow-sm"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Start Jitsi Call
                                </button>

                                {/* CANCEL */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelBookingTarget(booking);
                                    setCancellationReason("");
                                    setCancellationError(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Cancel Session
                                </button>

                                {/* COMPLETE */}
                                <button
                                  type="button"
                                  onClick={() => handleCompleteBooking(booking)}
                                  disabled={
                                    !canComplete ||
                                    completingBookingId === booking.id
                                  }
                                  className="inline-flex items-center gap-1 rounded-xl border border-[#768c6e]/30 bg-[#768c6e]/10 px-3 py-1.5 text-[11px] font-semibold text-[#2D3728] hover:bg-[#768c6e]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {completingBookingId === booking.id ? (
                                    "Completing..."
                                  ) : isBeforeSession ? (
                                    "Complete After Session"
                                  ) : isActiveSession ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Complete Consultation
                                    </>
                                  ) : (
                                    "Complete Consultation"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* OTHER STATUSES */}
                          {!["confirmed", "completed", "cancelled"].includes(
                            booking.status,
                          ) && (
                            <span className="text-[11px] text-[#2D3728]/50 capitalize">
                              {booking.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =====================================================
          SMS MONITOR
          Kept outside doctor-consultations so navbar scrolling
          does not include this section.
      ====================================================== */}
      <section id="doctor-sms-monitor" className="scroll-mt-24">
        <div className="p-6 sm:p-8 rounded-[28px] bg-[#F7F5EF] border border-[#768c6e]/20 shadow-md space-y-4">
          <div className="border-b border-[#768c6e]/15 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#2D3728] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#768c6e]" />
                100% Automated Telco SMS Gateway Monitor
              </h2>

              <p className="text-xs text-[#2D3728]/70 mt-0.5">
                PsyNova automatically manages patient SMS communications via
                official Notify.lk telco routing.
              </p>
            </div>

            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full self-start sm:self-auto">
              ⚡ Automated Background Dispatch Active
            </span>
          </div>

          {/* Automated Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-[#768c6e]/20 space-y-1">
              <span className="font-bold text-[#2D3728] flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Rule 1: Instant Post-Payment SMS
              </span>

              <p className="text-[11px] text-[#2D3728]/70 leading-relaxed">
                Fires automatically to the patient&apos;s Sri Lankan mobile
                number immediately after PayHere checkout is verified. Includes
                appointment time, specialist name, and unique video room link.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-[#768c6e]/20 space-y-1">
              <span className="font-bold text-[#2D3728] flex items-center gap-1.5 text-xs">
                <Clock className="w-4 h-4 text-[#768c6e] shrink-0" />
                Rule 2: 5-Minute Pre-Session Auto Reminder
              </span>

              <p className="text-[11px] text-[#2D3728]/70 leading-relaxed">
                Continuous background scheduler monitors upcoming sessions and
                automatically sends an urgent reminder SMS with the Jitsi video
                call link 5 minutes before the consultation begins.
              </p>
            </div>
          </div>

          {smsResult && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{smsResult}</span>
            </div>
          )}

          {/* Diagnostic Gateway Test */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
              Diagnostic SMS Carrier Connectivity Check
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="tel"
                  value={
                    testSmsPhone || doctorBookings[0]?.patientContact || ""
                  }
                  onChange={(e) => setTestSmsPhone(e.target.value)}
                  placeholder="e.g. +94771234567"
                  className="w-full px-3 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs font-mono text-[#2D3728]"
                />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  value={testSmsMsg}
                  onChange={(e) => setTestSmsMsg(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#768c6e]/30 bg-white text-xs text-[#2D3728]"
                />

                <button
                  type="button"
                  onClick={async () => {
                    const recipient =
                      testSmsPhone ||
                      doctorBookings[0]?.patientContact ||
                      "+94771234567";

                    setSmsSending(true);
                    setSmsResult(null);

                    try {
                      const response = await fetch("/api/sms", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          recipient,
                          message: testSmsMsg,
                        }),
                      });

                      const data = await response.json();

                      if (!response.ok) {
                        throw new Error(
                          data?.error || "Notify.lk dispatch failed.",
                        );
                      }

                      setSmsResult(
                        `Notify.lk dispatched to ${recipient}! Status: ${
                          data.status || "Success"
                        } (ID: ${data.messageId || "NOTIFYLK-102"})`,
                      );
                    } catch (error) {
                      setSmsResult(
                        "Notify.lk dispatch error: " +
                          (error instanceof Error
                            ? error.message
                            : "Unknown error"),
                      );
                    } finally {
                      setSmsSending(false);
                    }
                  }}
                  disabled={smsSending}
                  className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
                >
                  {smsSending ? "Testing..." : "Test Gateway Route"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          DOCTOR CANCELLATION MODAL
      ====================================================== */}
      {cancelBookingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-[#F7F5EF] p-6 sm:p-8 shadow-2xl border border-[#768c6e]/20">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#2D3728]">
                  Cancel Consultation
                </h3>

                <p className="text-xs text-[#2D3728]/70 mt-1">
                  Booking ID:{" "}
                  <span className="font-mono font-semibold">
                    {cancelBookingTarget.id}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeCancelModal}
                className="p-2 rounded-xl hover:bg-[#768c6e]/10 text-[#2D3728]/60"
                disabled={actionLoading}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-5">
              <p className="text-xs font-semibold text-amber-900">
                Full Patient Refund
              </p>

              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                Cancelling this confirmed consultation will request a full
                refund of LKR {cancelBookingTarget.feeLkr.toLocaleString()} for
                the patient. The cancellation reason will be recorded and
                visible to the administrator.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#2D3728]">
                Cancellation Reason
              </label>

              <textarea
                value={cancellationReason}
                onChange={(e) => {
                  setCancellationReason(e.target.value);

                  if (cancellationError) {
                    setCancellationError(null);
                  }
                }}
                rows={5}
                placeholder="Please explain why you need to cancel this consultation..."
                className="w-full rounded-2xl border border-[#768c6e]/30 bg-white px-4 py-3 text-sm text-[#2D3728] outline-none focus:border-[#768c6e] resize-none"
                disabled={actionLoading}
              />

              <p className="text-[10px] text-[#2D3728]/50">
                Minimum 5 characters required.
              </p>

              {cancellationError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-100 border border-red-300 px-3 py-2 text-xs font-semibold text-red-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {cancellationError}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={actionLoading}
                className="flex-1 rounded-xl border border-[#768c6e]/30 bg-white px-4 py-2.5 text-xs font-semibold text-[#2D3728] hover:bg-[#768c6e]/10 disabled:opacity-50"
              >
                Keep Consultation
              </button>

              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-[#D9635A] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#c6534b] disabled:opacity-50"
              >
                {actionLoading
                  ? "Cancelling..."
                  : "Cancel & Request Full Refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          JITSI VIDEO MODAL
      ====================================================== */}
      <JitsiVideoModal
        booking={activeJitsiBooking}
        isOpen={!!activeJitsiBooking}
        onClose={() => setActiveJitsiBooking(null)}
      />
    </div>
  );
};
