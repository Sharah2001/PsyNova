import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getNestServices } from "../../../../server/nest-app";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { payHereService } = await getNestServices();

    return NextResponse.json(payHereService.getPayHereConfig());
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to get PayHere config";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { payHereService, bookingsService, notifyLkService, smsWayService } =
      await getNestServices();

    /*
     * Use whichever SMS service is configured.
     *
     * IMPORTANT:
     * We do not assume either service exists. This prevents the
     * payment/webhook from crashing just because SMS configuration
     * is missing.
     */

    const smsService = notifyLkService || smsWayService;

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body.action === "test-sms") {
      if (!smsService) {
        return NextResponse.json(
          {
            success: false,
            error: "SMS service is not available",
          },
          { status: 500 },
        );
      }

      if (!body.phone) {
        return NextResponse.json(
          {
            success: false,
            error: "Phone number is required",
          },
          { status: 400 },
        );
      }

      console.log("[SMS TEST] Sending SMS to:", body.phone);

      try {
        const result = await smsService.sendSms(
          body.phone,
          "PsyNova test SMS. Notify.lk integration is working.",
        );

        console.log("[SMS TEST] Result:", result);

        return NextResponse.json(result);
      } catch (error: any) {
        console.error("[SMS TEST] Exception:", error);

        return NextResponse.json(
          {
            success: false,
            error: error?.message || "Failed to send test SMS",
          },
          { status: 500 },
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * ACTION: HASH
     * ------------------------------------------------------------
     */
    if (body.action === "hash") {
      if (!body.orderId) {
        return NextResponse.json(
          { error: "orderId is required" },
          { status: 400 },
        );
      }

      if (body.amount === undefined || body.amount === null) {
        return NextResponse.json(
          { error: "amount is required" },
          { status: 400 },
        );
      }

      const currency = body.currency || "LKR";

      const hash = payHereService.generateHash(
        body.orderId,
        body.amount,
        currency,
      );

      return NextResponse.json({
        orderId: body.orderId,
        amount: body.amount,
        currency,
        hash,
      });
    }

    /*
     * ------------------------------------------------------------
     * ACTION: CHECKOUT PARAMS
     * ------------------------------------------------------------
     */
    if (body.action === "checkout-params") {
      const forwardedHost = req.headers.get("x-forwarded-host");
      const originHeader = req.headers.get("origin");
      const hostHeader = req.headers.get("host");
      const forwardedProto = req.headers.get("x-forwarded-proto");

      const proto =
        forwardedProto === "http" || forwardedProto === "https"
          ? forwardedProto
          : "https";

      let baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";

      /*
       * Never use localhost for PayHere return/notify URLs when
       * generating a real checkout configuration.
       */
      if (!baseUrl || baseUrl.includes("localhost")) {
        if (forwardedHost && !forwardedHost.includes("localhost")) {
          baseUrl = `${proto}://${forwardedHost}`;
        } else if (originHeader && !originHeader.includes("localhost")) {
          baseUrl = originHeader;
        } else if (hostHeader && !hostHeader.includes("localhost")) {
          baseUrl = `${proto}://${hostHeader}`;
        }
      }

      /*
       * Remove a trailing slash so we don't accidentally generate:
       * https://example.com//api/payhere/notify
       */
      baseUrl = baseUrl.replace(/\/+$/, "");

      if (!baseUrl) {
        return NextResponse.json(
          {
            error:
              "Unable to determine application base URL. Please provide baseUrl.",
          },
          { status: 400 },
        );
      }

      const params = payHereService.createCheckoutParams({
        ...body,
        baseUrl,
      });

      return NextResponse.json(params);
    }

    /*
     * ------------------------------------------------------------
     * ACTION: SIMULATE NOTIFY
     * ------------------------------------------------------------
     *
     * This is intended for local/sandbox testing only.
     *
     * It creates a PayHere-compatible notification payload,
     * verifies the signature, and then passes it through the
     * same booking confirmation logic as the real webhook.
     */
    if (body.action === "simulate-notify") {
      const orderId = body.orderId;

      if (!orderId) {
        return NextResponse.json(
          { error: "orderId is required" },
          { status: 400 },
        );
      }

      const statusCode =
        body.statusCode !== undefined ? Number(body.statusCode) : 2;

      const amount =
        body.amount !== undefined && body.amount !== null
          ? Number(body.amount)
          : 5000;

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Invalid payment amount" },
          { status: 400 },
        );
      }

      const currency = body.currency || "LKR";

      const config = payHereService.getPayHereConfig();

      const paymentId =
        body.paymentId ||
        `PAYHERE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      /*
       * PayHere amount must be represented with two decimal places
       * when constructing the notification hash.
       */
      const formattedAmount = amount.toFixed(2);

      /*
       * PayHere notification hash:
       *
       * MD5(
       *   merchant_id
       *   + order_id
       *   + payhere_amount
       *   + payhere_currency
       *   + status_code
       *   + MD5(merchant_secret)
       * )
       *
       * The inner MD5 is uppercase.
       */
      const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || "";

      if (!merchantSecret) {
        return NextResponse.json(
          {
            error: "PAYHERE_MERCHANT_SECRET is not configured",
          },
          { status: 500 },
        );
      }

      const secretHash = createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();

      const rawHash =
        `${config.merchantId}` +
        `${orderId}` +
        `${formattedAmount}` +
        `${currency}` +
        `${statusCode}` +
        `${secretHash}`;

      const md5sig = createHash("md5")
        .update(rawHash)
        .digest("hex")
        .toUpperCase();

      const simulateBody = {
        merchant_id: config.merchantId,
        order_id: orderId,
        payment_id: paymentId,
        payhere_amount: formattedAmount,
        payhere_currency: currency,
        status_code: statusCode,
        md5sig,
        status_message:
          statusCode === 2
            ? "Successfully paid via PayHere"
            : `PayHere code ${statusCode}`,
      };

      /*
       * Verify the generated notification exactly like a real
       * PayHere notification.
       */
      const isValid = payHereService.verifyNotificationHash(simulateBody);

      if (!isValid) {
        return NextResponse.json(
          {
            error: "Simulated PayHere hash verification failed",
          },
          { status: 400 },
        );
      }

      /*
       * Run the normal booking payment verification logic.
       */
      const result = await bookingsService.verifyAndConfirmPayHerePayment(
        orderId,
        paymentId,
        statusCode,
        `Simulated PayHere notify callback (status_code ${statusCode})`,
      );

      console.log("[PayHere] SMS decision:", {
        success: result.success,
        isNewlyConfirmed: result.isNewlyConfirmed,
        hasSmsService: !!smsService,
        bookingId: result.booking?.id,
        patientContact: result.booking?.patientContact,
      });

      if (result.success && result.isNewlyConfirmed && smsService) {
        console.log(
          `[PayHere] Sending patient confirmation SMS for booking ${result.booking.id}`,
        );

        try {
          const smsResult = await smsService.sendBookingConfirmation(
            result.booking,
          );

          console.log("[PayHere] Patient SMS result:", smsResult);
        } catch (smsError) {
          console.error(
            "[PayHere] Patient confirmation SMS exception:",
            smsError,
          );
        }

        console.log(
          `[PayHere] Sending doctor alert SMS for booking ${result.booking.id}`,
        );

        try {
          const doctorSmsResult = await smsService.sendDoctorAlert(
            result.booking,
          );

          console.log("[PayHere] Doctor SMS result:", doctorSmsResult);
        } catch (smsError) {
          console.error("[PayHere] Doctor alert SMS exception:", smsError);
        }
      } else {
        console.warn("[PayHere] SMS NOT SENT because condition failed:", {
          success: result.success,
          isNewlyConfirmed: result.isNewlyConfirmed,
          hasSmsService: !!smsService,
          bookingId: result.booking?.id,
        });
      }
      return NextResponse.json({
        simulated: true,
        verified: true,
        statusCode,
        booking: result.booking,
        statusText: result.statusText,
      });
    }

    /*
     * ------------------------------------------------------------
     * REAL PAYHERE WEBHOOK / NOTIFY
     * ------------------------------------------------------------
     *
     * PayHere sends the payment notification to this endpoint.
     */
    console.log("[PayHere] REAL WEBHOOK RECEIVED");

    console.log("[PayHere] Incoming webhook:", {
      merchant_id: body?.merchant_id,
      order_id: body?.order_id,
      payment_id: body?.payment_id,
      payhere_amount: body?.payhere_amount,
      payhere_currency: body?.payhere_currency,
      status_code: body?.status_code,
    });

    const isValid = payHereService.verifyNotificationHash(body);

    console.log("[PayHere] Webhook MD5 verification:", isValid);

    if (!isValid) {
      console.error("[PayHere] Invalid notification hash", {
        order_id: body?.order_id,
        payment_id: body?.payment_id,
        status_code: body?.status_code,
      });

      return NextResponse.json(
        {
          verified: false,
          error: "Invalid PayHere notification signature",
        },
        { status: 400 },
      );
    }

    if (!body.order_id) {
      console.error("[PayHere] Webhook missing order_id");

      return NextResponse.json(
        {
          verified: true,
          error: "order_id is missing",
        },
        { status: 400 },
      );
    }

    const statusCode = Number(body.status_code);

    if (!Number.isFinite(statusCode)) {
      console.error("[PayHere] Invalid status_code:", body.status_code);

      return NextResponse.json(
        {
          verified: true,
          error: "Invalid status_code",
        },
        { status: 400 },
      );
    }

    const paymentId = body.payment_id || `PAYHERE-${Date.now()}`;

    console.log("[PayHere] Processing payment:", {
      orderId: body.order_id,
      paymentId,
      statusCode,
      amount: body.payhere_amount,
      currency: body.payhere_currency,
    });

    /*
     * ------------------------------------------------------------
     * PROCESS BOOKING PAYMENT
     * ------------------------------------------------------------
     */

    const result = await bookingsService.verifyAndConfirmPayHerePayment(
      body.order_id,
      paymentId,
      statusCode,
      `PayHere Gateway IPN Callback (status_code ${statusCode})`,
    );

    console.log("[PayHere] Booking payment result:", {
      success: result.success,
      statusText: result.statusText,
      isNewlyConfirmed: result.isNewlyConfirmed,
      bookingId: result.booking?.id,
      bookingStatus: result.booking?.status,
      paymentStatus: result.booking?.paymentStatus,
      patientContact: result.booking?.patientContact,
    });

    /*
     * ------------------------------------------------------------
     * SMS DECISION
     * ------------------------------------------------------------
     */

    console.log("[PayHere] SMS decision:", {
      success: result.success,
      isNewlyConfirmed: result.isNewlyConfirmed,
      hasSmsService: !!smsService,
      bookingId: result.booking?.id,
      patientContact: result.booking?.patientContact,
    });

    /*
     * ------------------------------------------------------------
     * PATIENT + PSYCHIATRIST SMS
     * ------------------------------------------------------------
     */

    if (result.success && result.isNewlyConfirmed && smsService) {
      console.log(
        `[PayHere] Starting SMS notifications for booking ${result.booking.id}`,
      );

      /*
       * Patient confirmation SMS
       */
      console.log(
        `[PayHere] Sending patient confirmation SMS to ${result.booking.patientContact}`,
      );

      try {
        const patientSmsResult = await smsService.sendBookingConfirmation(
          result.booking,
        );

        console.log("[PayHere] Patient SMS result:", patientSmsResult);
      } catch (smsError) {
        console.error(
          "[PayHere] Patient confirmation SMS exception:",
          smsError,
        );
      }

      /*
       * Psychiatrist notification SMS
       */
      console.log(
        `[PayHere] Sending psychiatrist alert SMS for booking ${result.booking.id}`,
      );

      try {
        const doctorSmsResult = await smsService.sendDoctorAlert(
          result.booking,
        );

        console.log("[PayHere] Psychiatrist SMS result:", doctorSmsResult);
      } catch (smsError) {
        console.error("[PayHere] Psychiatrist SMS exception:", smsError);
      }
    } else {
      console.warn("[PayHere] SMS NOT SENT because condition failed:", {
        success: result.success,
        isNewlyConfirmed: result.isNewlyConfirmed,
        hasSmsService: !!smsService,
        bookingId: result.booking?.id,
        patientContact: result.booking?.patientContact,
      });
    }

    /*
     * ------------------------------------------------------------
     * RETURN SUCCESS TO PAYHERE
     * ------------------------------------------------------------
     */

    console.log(`[PayHere] Webhook processing completed for ${body.order_id}`);

    return NextResponse.json({
      status: "PROCESSED",
      verified: true,
      success: result.success,
      isNewlyConfirmed: result.isNewlyConfirmed,
      statusCode,
      statusText: result.statusText,
      booking: result.booking,
    });
  } catch (error: unknown) {
    console.error("PayHere API error:", error);

    const message =
      error instanceof Error ? error.message : "PayHere request failed";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}
