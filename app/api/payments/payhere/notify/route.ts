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
    console.log("🔥 PAYHERE WEBHOOK RECEIVED");
    console.log("Time:", new Date().toISOString());
    console.log("Content-Type:", req.headers.get("content-type"));
    console.log("========================================");

    const { payHereService, bookingsService, notifyLkService } =
      await getNestServices();

    let body: Record<string, any> = {};

    const contentType = req.headers.get("content-type") || "";

    // PayHere normally sends application/x-www-form-urlencoded
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      // Development fallback
      try {
        body = await req.json();
      } catch {
        console.warn("[PayHere Webhook Notify] Unable to parse request body");
      }
    }

    console.log("🔥 PAYHERE WEBHOOK BODY:", body);

    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      payment_id,
      status_message,
    } = body;

    console.log("========== PAYHERE VERIFICATION ==========");
    console.log("merchant_id:", merchant_id);
    console.log("order_id:", order_id);
    console.log("payhere_amount:", payhere_amount);
    console.log("payhere_currency:", payhere_currency);
    console.log("status_code:", status_code);
    console.log("payment_id:", payment_id);
    console.log("md5sig received:", md5sig);
    console.log("==========================================");

    // Validate required fields
    if (!merchant_id || !order_id || !md5sig) {
      console.error("[PayHere Webhook Notify] Missing required PayHere fields");

      return NextResponse.json(
        {
          error: "Missing required PayHere notification fields",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // PAYHERE MD5 SIGNATURE VERIFICATION
    // ---------------------------------------------------------

    const isValidHash = payHereService.verifyNotificationHash({
      merchant_id: String(merchant_id),
      order_id: String(order_id),
      payhere_amount: String(payhere_amount ?? ""),
      payhere_currency: String(payhere_currency ?? ""),
      status_code: String(status_code ?? ""),
      md5sig: String(md5sig),
    });

    console.log(
      `[PayHere Webhook Notify] MD5 verification result: ${isValidHash}`,
    );

    // Reject invalid notifications
    if (!isValidHash) {
      console.error(
        `[PayHere Webhook Notify] ❌ MD5 signature mismatch for order ${order_id}`,
      );

      return NextResponse.json(
        {
          error: "MD5 signature verification failed. Notification rejected.",
        },
        { status: 400 },
      );
    }

    console.log(
      `[PayHere Webhook Notify] ✅ MD5 verified for order ${order_id}`,
    );

    // ---------------------------------------------------------
    // PROCESS PAYMENT / BOOKING
    // ---------------------------------------------------------

    console.log(
      `[PayHere Webhook Notify] Processing status_code=${status_code} for order=${order_id}`,
    );

    const result = await bookingsService.verifyAndConfirmPayHerePayment(
      String(order_id),
      String(
        payment_id ||
          `PAYHERE-${Math.floor(1000000 + Math.random() * 9000000)}`,
      ),
      String(status_code),
      String(
        status_message ||
          `PayHere callback verified with status_code ${status_code}`,
      ),
    );

    console.log("[PayHere Webhook Notify] Booking verification result:", {
      success: result.success,
      isNewlyConfirmed: result.isNewlyConfirmed,
      statusText: result.statusText,
      bookingId: result.booking?.id,
      bookingStatus: result.booking?.status,
      paymentStatus: result.booking?.paymentStatus,
      payhereRef: result.booking?.payhereRef,
    });

    // ---------------------------------------------------------
    // SEND SMS ONLY WHEN NEWLY CONFIRMED
    // ---------------------------------------------------------

    if (result.success && result.isNewlyConfirmed) {
      try {
        await notifyLkService.sendBookingConfirmation(result.booking);

        await notifyLkService.sendDoctorAlert(result.booking);

        console.log(
          `[PayHere Webhook Notify] ✅ Booking ${order_id} confirmed and SMS notifications dispatched`,
        );
      } catch (smsErr) {
        // SMS failure must not make the payment webhook fail
        console.error("[PayHere Webhook Notify] SMS dispatch error:", smsErr);
      }
    }

    // ---------------------------------------------------------
    // RETURN SUCCESS TO PAYHERE
    // ---------------------------------------------------------

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("[PayHere Webhook Notify] Handler error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Webhook processing failed",
      },
      { status: 500 },
    );
  }
}
