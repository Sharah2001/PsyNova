import { NextRequest, NextResponse } from "next/server";
import { getNestServices } from "../../../../../server/nest-app";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "payhere-notify",
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log("========================================");
    console.log("[PayHere] NOTIFICATION RECEIVED");
    console.log("Time:", new Date().toISOString());
    console.log("Content-Type:", req.headers.get("content-type"));
    console.log("========================================");

    const { payHereService, bookingsService } = await getNestServices();

    let body: Record<string, any> = {};

    const contentType = req.headers.get("content-type") || "";

    /*
     * PayHere sends the notification as
     * application/x-www-form-urlencoded.
     */
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      /*
       * JSON fallback is useful for local testing.
       */
      try {
        body = await req.json();
      } catch {
        console.warn("[PayHere] Could not parse notification body");
      }
    }

    console.log("[PayHere] Notification body:", body);

    const merchantId = String(body.merchant_id ?? "").trim();
    const orderId = String(body.order_id ?? "").trim();
    const payhereAmount = String(body.payhere_amount ?? "").trim();
    const payhereCurrency = String(body.payhere_currency ?? "").trim();
    const statusCode = String(body.status_code ?? "").trim();
    const md5sig = String(body.md5sig ?? "").trim();
    const paymentId = String(body.payment_id ?? "").trim();
    const statusMessage = String(body.status_message ?? "").trim();

    console.log("========== PAYHERE VERIFICATION ==========");
    console.log("merchant_id:", merchantId);
    console.log("order_id:", orderId);
    console.log("payhere_amount:", payhereAmount);
    console.log("payhere_currency:", payhereCurrency);
    console.log("status_code:", statusCode);
    console.log("payment_id:", paymentId);
    console.log("md5sig received:", md5sig);
    console.log("status_message:", statusMessage);
    console.log("==========================================");

    /*
     * Validate required fields.
     */
    if (
      !merchantId ||
      !orderId ||
      !payhereAmount ||
      !payhereCurrency ||
      !statusCode ||
      !md5sig
    ) {
      console.error("[PayHere] Missing required notification fields");

      return NextResponse.json(
        {
          error: "Missing required PayHere notification fields",
        },
        { status: 400 },
      );
    }

    /*
     * Basic validation only.
     *
     * IMPORTANT:
     * Do NOT convert payhereAmount to Number() before
     * signature verification. PayHere signs its exact
     * amount string.
     */
    const numericAmount = Number(payhereAmount);
    const numericStatus = Number(statusCode);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      console.error("[PayHere] Invalid payment amount:", payhereAmount);

      return NextResponse.json(
        {
          error: "Invalid PayHere amount",
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(numericStatus)) {
      console.error("[PayHere] Invalid status code:", statusCode);

      return NextResponse.json(
        {
          error: "Invalid PayHere status_code",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * PAYHERE MD5 SIGNATURE VERIFICATION
     * ---------------------------------------------------------
     *
     * PayHere signature:
     *
     * MD5(
     *   merchant_id +
     *   order_id +
     *   payhere_amount +
     *   payhere_currency +
     *   status_code +
     *   MD5(merchant_secret)
     * )
     *
     * The service handles the exact calculation.
     */
    const isValidHash = payHereService.verifyNotification({
      merchant_id: merchantId,
      order_id: orderId,
      payhere_amount: payhereAmount,
      payhere_currency: payhereCurrency,
      status_code: statusCode,
      md5sig,
    });

    console.log("[PayHere] MD5 verification result:", isValidHash);

    /*
     * NEVER process an invalid notification.
     */
    if (!isValidHash) {
      console.error("[PayHere] INVALID NOTIFICATION SIGNATURE");
      console.error("[PayHere] Order ID:", orderId);
      console.error("[PayHere] Amount:", payhereAmount);
      console.error("[PayHere] Currency:", payhereCurrency);
      console.error("[PayHere] Status:", statusCode);

      return NextResponse.json(
        {
          error: "Invalid PayHere notification signature",
        },
        { status: 400 },
      );
    }

    console.log("[PayHere] Signature verified successfully.");

    /*
     * ---------------------------------------------------------
     * PROCESS PAYMENT
     * ---------------------------------------------------------
     *
     * PayHere status 2 = successful payment.
     * The booking service performs the final database
     * validation and confirmation.
     */
    const result = await bookingsService.verifyAndConfirmPayHerePayment(
      orderId,
      paymentId || `PAYHERE-${orderId}`,
      numericStatus,
      statusMessage || undefined,
      {
        merchantId,
        amount: payhereAmount,
        currency: payhereCurrency,
        raw: {
          statusCode,
          md5sig,
        },
      },
    );

    console.log("[PayHere] Booking payment result:", result);

    // ============================================================
    // SEND CONFIRMATION SMS AFTER SUCCESSFUL PAYMENT
    // ============================================================

    let smsResult: any = null;

    if (
      numericStatus === 2 &&
      result.success &&
      result.booking &&
      result.isNewlyConfirmed &&
      !result.booking.confirmationSmsSent
    ) {
      try {
        console.log(
          `[PayHere] Sending confirmation SMS for booking ${result.booking.id}`,
        );

        const { notifyLkService } = await getNestServices();

        smsResult = await notifyLkService.sendBookingConfirmation(
          result.booking,
        );

        console.log("[PayHere] Confirmation SMS result:", smsResult);

        if (smsResult?.success) {
          await bookingsService.markConfirmationSmsSent(result.booking.id);

          console.log(
            `[PayHere] Confirmation SMS marked as sent for ${result.booking.id}`,
          );
        } else {
          console.error(
            `[PayHere] Confirmation SMS failed for ${result.booking.id}:`,
            smsResult?.error || smsResult,
          );
        }
      } catch (smsError) {
        // IMPORTANT:
        // SMS failure must NOT make the PayHere payment fail.
        console.error(
          `[PayHere] Confirmation SMS processing failed for ${result.booking.id}:`,
          smsError,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      orderId,
      statusCode: numericStatus,
      paymentId,
      result,
      sms: smsResult
        ? {
            success: smsResult.success,
            status: smsResult.status,
            messageId: smsResult.messageId,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("[PayHere] Notification processing failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to process PayHere notification";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
