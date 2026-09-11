"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Clock3,
  Printer,
  CalendarDays,
  UserRound,
  Stethoscope,
  CreditCard,
  Hash,
  Video,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface Booking {
  id: string;

  doctorId: string;
  doctorName: string;

  patientId: string;
  patientName: string;
  patientEmail: string;
  patientContact: string;

  slotId: string;
  slotDatetime: string;

  status: string;
  paymentStatus: string;

  feeLkr: number;
  platformCommissionLkr: number;
  netDoctorEarningLkr: number;

  payhereRef: string | null;
  videoLink: string | null;

  confirmationSmsSent: boolean;
  confirmationSmsSentAt: string | null;

  gatewayResponse: {
    merchantId?: string;
    orderId?: string;
    payhereAmount?: number;
    payhereCurrency?: string;
    statusCode?: number;
    statusMessage?: string;
    method?: string;
    raw?: Record<string, unknown>;
  } | null;

  createdAt: string;
  updatedAt: string;
}

type PageState = "loading" | "confirmed" | "pending" | "failed";

const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 8;

function formatDateTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-LK", {
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function isPaymentConfirmed(booking: Booking) {
  return booking.paymentStatus === "paid" && booking.status === "confirmed";
}
export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  const loadBooking = useCallback(async () => {
    if (!orderId) {
      setPageState("failed");
      setErrorMessage("No booking reference was provided.");
      return false;
    }

    try {
      const response = await fetch(
        `/api/bookings?id=${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to retrieve your booking.");
      }

      setBooking(data);

      if (isPaymentConfirmed(data)) {
        setPageState("confirmed");
        return true;
      }

      setPageState("pending");
      return false;
    } catch (error: any) {
      console.error("[Payment Success] Failed to load booking:", error);

      setErrorMessage(
        error?.message || "Unable to retrieve your payment information.",
      );

      setPageState("failed");

      return false;
    }
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const checkPayment = async () => {
      if (cancelled) return;

      const confirmed = await loadBooking();

      if (cancelled || confirmed) {
        return;
      }

      setAttempt((current) => {
        const next = current + 1;

        if (next < MAX_POLL_ATTEMPTS) {
          timeout = setTimeout(checkPayment, POLL_INTERVAL);
        }

        return next;
      });
    };

    checkPayment();

    return () => {
      cancelled = true;

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [loadBooking]);

  const paymentId = useMemo(() => {
    if (!booking) return null;

    const rawPaymentId = booking.gatewayResponse?.raw?.payment_id;

    return (
      booking.payhereRef ||
      (typeof rawPaymentId === "string" ? rawPaymentId : null) ||
      booking.gatewayResponse?.orderId ||
      null
    );
  }, [booking]);

  const paymentDate = useMemo(() => {
    if (!booking) return null;

    return booking.updatedAt || booking.createdAt;
  }, [booking]);

  const handlePrint = () => {
    window.print();
  };

  const handleRetry = async () => {
    setPageState("loading");
    setErrorMessage("");
    setAttempt(0);

    await loadBooking();
  };

  /*
   * ------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------
   */

  if (pageState === "loading") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <RefreshCw className="h-7 w-7 animate-spin text-slate-700" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Confirming your payment
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              We&apos;re securely checking your payment with the booking system.
              Please wait a moment.
            </p>

            {orderId && (
              <p className="mt-5 text-xs text-slate-400">
                Reference: {orderId}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  /*
   * ------------------------------------------------------------
   * FAILED
   * ------------------------------------------------------------
   */

  if (pageState === "failed") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Unable to verify payment
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {errorMessage ||
                "We could not retrieve your payment information."}
            </p>

            {orderId && (
              <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm">
                <span className="text-slate-500">Booking reference: </span>
                <span className="font-medium text-slate-900">{orderId}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRetry}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Check again
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ------------------------------------------------------------
   * PAYMENT STILL BEING CONFIRMED
   * ------------------------------------------------------------
   */

  if (pageState === "pending") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
              <Clock3 className="h-8 w-8 text-amber-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Payment is being confirmed
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your payment has reached the checkout process, but the secure
              payment confirmation is still being received.
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Please don&apos;t make another payment. We&apos;re checking the
              booking automatically.
            </p>

            {booking && (
              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Booking reference
                  </span>

                  <span className="font-semibold text-slate-900">
                    {booking.id}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Amount</span>

                  <span className="font-semibold text-slate-900">
                    {formatCurrency(booking.feeLkr)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Payment status</span>

                  <span className="font-medium capitalize text-amber-700">
                    {booking.paymentStatus || "Pending"}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Checking payment confirmation…
            </div>

            {attempt >= MAX_POLL_ATTEMPTS - 1 && (
              <p className="mt-5 text-xs leading-5 text-slate-500">
                Payment confirmation is taking longer than expected. Your
                booking has not been marked as paid yet. Please check your
                bookings shortly rather than making another payment.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  /*
   * ------------------------------------------------------------
   * CONFIRMED RECEIPT
   * ------------------------------------------------------------
   */

  if (!booking) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen bg-slate-50 px-4 py-10 print:bg-white print:px-0 print:py-0">
        <div className="mx-auto max-w-4xl">
          {/* Top confirmation */}
          <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="px-6 py-8 text-center sm:px-10">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-11 w-11 text-green-600" />
              </div>

              <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-green-600">
                Payment confirmed
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Your consultation is confirmed
              </h1>

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Your payment was successfully verified and your consultation
                booking has been confirmed.
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm">
                <Hash className="h-4 w-4 text-slate-500" />

                <span className="text-slate-500">Booking ID</span>

                <span className="font-semibold text-slate-900">
                  {booking.id}
                </span>
              </div>
            </div>
          </section>

          {/* Receipt */}
          <section
            id="payment-receipt"
            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            {/* Receipt header */}
            <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Payment receipt
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    PsyNova Consultation
                  </h2>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs text-slate-400">Payment date</p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(paymentDate || booking.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Consultation details */}
            <div className="grid gap-6 border-b border-slate-200 px-6 py-7 sm:grid-cols-2 sm:px-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Stethoscope className="h-4 w-4" />
                  Psychiatrist
                </div>

                <p className="mt-2 text-base font-semibold text-slate-900">
                  {booking.doctorName}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Psychiatrist consultation
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <UserRound className="h-4 w-4" />
                  Patient
                </div>

                <p className="mt-2 text-base font-semibold text-slate-900">
                  {booking.patientName}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {booking.patientEmail}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <CalendarDays className="h-4 w-4" />
                  Consultation date
                </div>

                <p className="mt-2 text-base font-semibold text-slate-900">
                  {formatDate(booking.slotDatetime)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatTime(booking.slotDatetime)}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Video className="h-4 w-4" />
                  Consultation type
                </div>

                <p className="mt-2 text-base font-semibold text-slate-900">
                  Online consultation
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Video consultation
                </p>
              </div>
            </div>

            {/* Payment information */}
            <div className="border-b border-slate-200 px-6 py-7 sm:px-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CreditCard className="h-4 w-4" />
                Payment information
              </div>

              <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-sm text-slate-500">
                    Booking reference
                  </span>

                  <span className="text-right text-sm font-semibold text-slate-900">
                    {booking.id}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-sm text-slate-500">
                    Payment reference
                  </span>

                  <span className="break-all text-right text-sm font-semibold text-slate-900">
                    {paymentId || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-sm text-slate-500">Payment status</span>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                    {booking.paymentStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-sm text-slate-500">Booking status</span>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                    {booking.status}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-4">
                  <span className="text-sm text-slate-500">Payment date</span>

                  <span className="text-right text-sm font-medium text-slate-900">
                    {formatDateTime(paymentDate || booking.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-slate-50 px-6 py-7 sm:px-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Consultation fee
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Paid securely through PayHere
                  </p>
                </div>

                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(booking.feeLkr)}
                </p>
              </div>
            </div>
          </section>

          {/* Video consultation */}
          {booking.videoLink && (
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-slate-700" />

                    <h3 className="font-semibold text-slate-900">
                      Your video consultation
                    </h3>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Use the consultation link when your appointment begins.
                  </p>
                </div>

                <a
                  href={booking.videoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Join consultation
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print / Save Receipt
            </button>

            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Continue to PsyNova
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400 print:hidden">
            Please keep this receipt for your records. Your booking reference is{" "}
            <span className="font-medium">{booking.id}</span>.
          </p>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          @page {
            margin: 16mm;
          }

          body {
            background: white !important;
          }

          #payment-receipt {
            box-shadow: none !important;
            border: 1px solid #e2e8f0;
          }
        }
      `}</style>
    </>
  );
}
