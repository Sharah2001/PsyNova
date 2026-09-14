"use client";

import React, { useState, useRef } from "react";
import { Psychiatrist, DoctorSlot, Booking } from "@/lib/types";
import { usePsyNova } from "@/lib/store";
import {
  X,
  CreditCard,
  Lock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Info,
  Sparkles,
  Smartphone,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface PayHereCheckoutModalProps {
  doctor: Psychiatrist | null;
  slot: DoctorSlot | null;
  isOpen: boolean;
  patientDataOverride?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
}

const normalizeSLPhone = (phone: string) => {
  if (!phone || typeof phone !== "string")
    return { clean: "", formatted: "", isValid: false };
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0094")) digits = digits.substring(2);
  else if (digits.startsWith("940") && digits.length === 12)
    digits = "94" + digits.substring(3);
  else if (digits.startsWith("0") && digits.length === 10)
    digits = "94" + digits.substring(1);
  else if (digits.length === 9) digits = "94" + digits;
  else if (!digits.startsWith("94") && digits.length >= 9)
    digits = "94" + digits;

  const isValid = digits.startsWith("94") && digits.length === 11;
  const formatted =
    digits.length === 11
      ? `+${digits.substring(0, 2)} ${digits.substring(2, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}`
      : digits
        ? `+${digits}`
        : "";
  return { clean: digits, formatted, isValid };
};

export const PayHereCheckoutModal: React.FC<PayHereCheckoutModalProps> = ({
  doctor,
  slot,
  isOpen,
  patientDataOverride,
  onClose,
  onSuccess,
}) => {
  const { user, patients, addConfirmedBooking, registerPatient } = usePsyNova();

  const activePatientName =
    patientDataOverride?.name ||
    (user.role === "patient" && user.name && user.name !== "Guest Visitor"
      ? user.name
      : "");
  const activePatientEmail =
    patientDataOverride?.email ||
    (user.role === "patient" &&
    user.email &&
    user.email !== "visitor@psynova.lk"
      ? user.email
      : "");

  const registeredPatient = patients.find(
    (p) => p.email.toLowerCase() === activePatientEmail.toLowerCase(),
  );

  const patientId = registeredPatient?.id;

  const defaultContact =
    patientDataOverride?.contact || registeredPatient?.phone || "";

  // Patient Info State
  const [patientName, setPatientName] = useState(activePatientName);
  const [patientEmail, setPatientEmail] = useState(activePatientEmail);
  const [patientContact, setPatientContact] = useState(defaultContact);

  // Card Input State for In-App Sandbox Terminal
  const [cardNumber, setCardNumber] = useState("4916 2175 0161 1292");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardholderName, setCardholderName] = useState(activePatientName);

  // Sync state if modal is opened with new patientDataOverride
  const [prevOverride, setPrevOverride] = useState(patientDataOverride);
  if (patientDataOverride !== prevOverride) {
    setPrevOverride(patientDataOverride);
    if (patientDataOverride?.name) {
      setPatientName(patientDataOverride.name);
      setCardholderName(patientDataOverride.name);
    }
    if (patientDataOverride?.email) {
      setPatientEmail(patientDataOverride.email);
    }
    if (patientDataOverride?.contact) {
      setPatientContact(patientDataOverride.contact);
    }
  }

  // Custom Merchant ID/Secret for direct Hosted Redirect testing
  // const [customMerchantId, setCustomMerchantId] = useState("1236791");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkoutParams, setCheckoutParams] = useState<any>(null);

  const [orderId] = useState(
    () => `BK-${Math.floor(10000 + Math.random() * 90000)}`,
  );
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen || !doctor || !slot) return null;

  const dateObj = new Date(slot.datetime);
  const phoneValidation = normalizeSLPhone(patientContact);

  // Fill Test Cards
  const handleFillTestCard = (type: "visa" | "mastercard" | "invalid") => {
    if (type === "visa") {
      setCardNumber("4916 2175 0161 1292");
      setCardExpiry("12/28");
      setCardCvv("123");
      setCardholderName(patientName || "Patient");
    } else if (type === "mastercard") {
      setCardNumber("5307 7321 2553 1191");
      setCardExpiry("10/27");
      setCardCvv("456");
      setCardholderName(patientName || "Patient");
    } else {
      setCardNumber("4000 0000 0000 0002");
      setCardExpiry("01/22");
      setCardCvv("000");
      setCardholderName("Declined Card");
    }
  };

  // Helper: Execute Server-side Webhook Verification
  const handleExecuteWebhookVerification = async (
    orderId: string,
    statusCode: number = 2,
  ) => {
    setLoading(true);
    setErrorMessage("");

    if (!patientName.trim()) {
      setErrorMessage("Please enter the patient full name.");
      setLoading(false);
      return;
    }
    if (!patientEmail.trim()) {
      setErrorMessage("Please enter the patient email address.");
      setLoading(false);
      return;
    }
    if (!patientContact.trim() || !phoneValidation.isValid) {
      setErrorMessage(
        "Please provide a valid Sri Lankan mobile number (e.g. 077 123 4567 or +94 77 123 4567) so we can dispatch your booking confirmation and Jitsi link via SMS.",
      );
      setLoading(false);
      return;
    }

    try {
      const formattedPhone = phoneValidation.formatted || patientContact.trim();

      // 1. Create pending booking record first

      console.log("========== SLOT TIME DEBUG ==========");
      console.log("slot.datetime RAW:", slot.datetime);
      console.log("slot.datetime ISO:", new Date(slot.datetime).toISOString());
      console.log(
        "slot.datetime Sri Lanka:",
        new Date(slot.datetime).toLocaleString("en-LK", {
          timeZone: "Asia/Colombo",
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      console.log("=====================================");

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-pending",
          orderId: orderId,
          doctorId: doctor.id,
          slotId: slot.id,
          slotDatetime: slot.datetime,
          patientId: patientId,
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
          patientContact: formattedPhone,
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok || !bookingData.booking) {
        throw new Error(
          bookingData.error || "Failed to initialize booking record",
        );
      }

      // // 2. Call server simulate-notify endpoint to compute and verify real MD5 signature
      // const res = await fetch("/api/payments/payhere", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     action: "simulate-notify",
      //     orderId: orderId,
      //     statusCode,
      //     amount: doctor.feeLkr,
      //   }),
      // });

      // const data = await res.json();
      // if (!res.ok || !data.booking || data.booking.status !== "confirmed") {
      //   throw new Error(
      //     data.error || `PayHere Payment Declined (Status code: ${statusCode})`,
      //   );
      // }

      // // Ensure confirmed booking uses exact patientContact
      // const confirmedBooking: Booking = {
      //   ...data.booking,
      //   patientContact: formattedPhone,
      // };

      // // Sync confirmed booking into local state store and update doctor slot
      // addConfirmedBooking(confirmedBooking);

      // // Register or link patient account
      // registerPatient({
      //   name: patientName.trim(),
      //   email: patientEmail.trim(),
      //   phone: formattedPhone,
      // });

      // onSuccess(confirmedBooking);
      // onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message || "Payment processing failed on PayHere gateway",
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Hosted Redirect or JS SDK launch
  const handleProceedHostedRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    if (!patientName.trim()) {
      setErrorMessage("Please enter the patient full name.");
      setLoading(false);
      return;
    }
    if (!patientEmail.trim()) {
      setErrorMessage("Please enter the patient email address.");
      setLoading(false);
      return;
    }

    if (!patientId) {
      setErrorMessage(
        "Patient account could not be found. Please log in again and retry.",
      );
      setLoading(false);
      return;
    }
    if (!patientContact.trim() || !phoneValidation.isValid) {
      setErrorMessage(
        "Please provide a valid Sri Lankan mobile number (e.g. 077 123 4567 or +94 77 123 4567) so we can dispatch your booking confirmation and Jitsi link via SMS.",
      );
      setLoading(false);
      return;
    }

    try {
      const formattedPhone = phoneValidation.formatted || patientContact.trim();

      // 1. Create pending booking
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-pending",
          orderId: orderId,
          doctorId: doctor.id,
          slotId: slot.id,
          slotDatetime: slot.datetime,
          patientId: patientId,
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
          patientContact: formattedPhone,
        }),
      });

      const bookingData = await bookingRes.json();

      console.log("========== BOOKING DEBUG ==========");
      console.log("bookingRes.ok:", bookingRes.ok);
      console.log("bookingRes.status:", bookingRes.status);
      console.log("bookingData:", bookingData);
      console.log("bookingData.booking:", bookingData.booking);
      console.log("===================================");

      if (!bookingRes.ok || !bookingData.booking) {
        console.error(
          "BOOKING VALIDATION FAILED:",
          "ok =",
          bookingRes.ok,
          "status =",
          bookingRes.status,
          "bookingData =",
          JSON.stringify(bookingData, null, 2),
        );

        throw new Error(
          bookingData.error || "Failed to initialize booking record",
        );
      }

      console.log("✅ BOOKING CREATED SUCCESSFULLY");
      console.log("Booking ID:", bookingData.booking.id);
      console.log("➡️ CONTINUING TO PAYHERE...");

      // 2. Ask backend to create signed PayHere checkout parameters
      const paramRes = await fetch("/api/payments/payhere", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "checkout-params",
          bookingId: bookingData.booking.id,
        }),
      });

      const paramsBody = await paramRes.text();

      let params: any;

      try {
        params = JSON.parse(paramsBody);
      } catch {
        throw new Error(
          `PayHere API returned HTTP ${paramRes.status} instead of JSON. Please retry.`,
        );
      }

      console.log("========== PAYHERE RESPONSE ==========");
      console.log("HTTP STATUS:", paramRes.status);
      console.log("RESPONSE:", params);
      console.log("======================================");

      if (!paramRes.ok) {
        throw new Error(
          params.error || "Failed to generate PayHere checkout parameters",
        );
      }

      if (!params.params) {
        throw new Error("Backend did not return PayHere checkout parameters");
      }

      setCheckoutParams(params);

      setTimeout(() => {
        if (formRef.current) {
          formRef.current.submit();
        }
      }, 300);
    } catch (err: any) {
      setErrorMessage(err.message || "Error initializing PayHere checkout");
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#2D3728]/70 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#F7F5EF] rounded-[28px] shadow-2xl border border-[#768c6e]/30 p-6 sm:p-8 overflow-hidden animate-scale-up max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#768c6e]/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#768c6e]/15 text-[#768c6e]">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#768c6e]/20 text-[#2D3728]">
                  PayHere Payment Gateway
                </span>
                <span className="text-[10px] font-mono text-[#6B7D5E]">
                  Sandbox Mode
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#2D3728]">
                Telehealth Checkout
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-full hover:bg-[#768c6e]/10 text-[#2D3728]/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Loading Overlay */}
        {loading ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full border-4 border-[#768c6e] border-t-transparent animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-[#2D3728]">
              Verifying PayHere MD5 Signature...
            </h3>
            <p className="text-xs text-[#2D3728]/70 max-w-xs mx-auto font-mono">
              Processing server-to-server notify callback for Order{" "}
              <strong className="text-[#6B7D5E]">{orderId}</strong>
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Consultation Summary Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#768c6e]/20 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-[#768c6e]/15">
                <img
                  src={doctor.photo}
                  alt={doctor.name}
                  className="w-12 h-12 rounded-xl object-cover border border-[#768c6e]/30"
                />
                <div>
                  <h3 className="font-bold text-[#2D3728] text-sm">
                    {doctor.name}
                  </h3>
                  <p className="text-xs text-[#2D3728]/70">{doctor.title}</p>
                  <p className="text-[11px] font-mono text-[#6B7D5E] mt-0.5">
                    {dateObj.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {dateObj.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Patient Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                    Patient Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Fernando"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#768c6e]/30 bg-[#F7F5EF]/50 text-xs text-[#2D3728] focus:outline-none focus:ring-2 focus:ring-[#768c6e]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. kasun@example.lk"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#768c6e]/30 bg-[#F7F5EF]/50 text-xs text-[#2D3728] focus:outline-none focus:ring-2 focus:ring-[#768c6e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                      Mobile Number (for SMS Alerts)
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 077 123 4567 or +94 77 123 4567"
                      value={patientContact}
                      onChange={(e) => setPatientContact(e.target.value)}
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs text-[#2D3728] focus:outline-none focus:ring-2 ${
                        phoneValidation.isValid
                          ? "border-emerald-500/50 bg-emerald-50/40 focus:ring-emerald-600"
                          : "border-[#768c6e]/30 bg-[#F7F5EF]/50 focus:ring-[#768c6e]"
                      }`}
                    />
                  </div>
                </div>

                {/* Live SMS Recipient Indicator */}
                <div className="pt-0.5">
                  {phoneValidation.isValid ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Notify.lk SMS will be dispatched directly to:{" "}
                        <strong className="font-mono text-emerald-950 font-bold">
                          {phoneValidation.formatted}
                        </strong>
                      </span>
                    </div>
                  ) : patientContact.trim().length > 0 ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Enter full Sri Lankan mobile number (e.g. 077 123 4567
                        or +94 77 123 4567)
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#2D3728]/60 italic flex items-center gap-1.5">
                      <Smartphone className="w-3 h-3 text-[#768c6e]" />
                      SMS confirmation & 5-minute pre-session reminders will be
                      sent to the phone number entered above.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Mode A: Hosted Gateway Redirect */}
            <form onSubmit={handleProceedHostedRedirect} className="space-y-3">
              {/* PayHere Domain & Merchant ID Explanation */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" /> Why
                  PayHere Shows &quot;Unauthorized payment request&quot;
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  PayHere&apos;s servers (
                  <strong className="font-mono">sandbox.payhere.lk</strong>)
                  validate the Merchant ID against registered accounts. If using
                  a default/test Merchant ID, PayHere blocks the request.
                </p>
                <p className="text-[11px] text-amber-900 font-semibold">
                  💡 If you have registered a Sandbox account on{" "}
                  <a
                    href="https://sandbox.payhere.lk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-bold text-amber-950"
                  >
                    sandbox.payhere.lk
                  </a>
                </p>
              </div>

              {/* <div>
                <label className="text-xs font-semibold text-[#2D3728]/80 block mb-1">
                  PayHere Sandbox Merchant ID
                </label>
                <input
                  type="text"
                  value={customMerchantId}
                  onChange={(e) => setCustomMerchantId(e.target.value)}
                  placeholder="e.g. 1224892"
                  className="w-full px-3 py-2 rounded-xl border border-[#768c6e]/30 bg-[#F7F5EF]/50 text-xs font-mono text-[#2D3728]"
                />
              </div> */}

              <div className="p-4 rounded-2xl bg-[#768c6e]/10 border border-[#768c6e]/20 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#2D3728]">Total Fee</span>
                <span className="font-bold font-mono text-sm text-[#2D3728]">
                  LKR {doctor.feeLkr.toLocaleString()}.00
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3.5 text-xs font-bold shadow-lg flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Launch PayHere Hosted Checkout (payhere.lk)</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Real HTML POST Form targeting PayHere Hosted Checkout Page */}
        {checkoutParams && (
          <form
            ref={formRef}
            action={
              checkoutParams.checkoutUrl ||
              "https://sandbox.payhere.lk/pay/checkout"
            }
            method="POST"
            className="hidden"
          >
            {Object.entries(checkoutParams.params).map(([key, value]) => (
              <input
                key={key}
                type="hidden"
                name={key}
                value={String(value ?? "")}
              />
            ))}
          </form>
        )}
      </div>
    </div>
  );
};
