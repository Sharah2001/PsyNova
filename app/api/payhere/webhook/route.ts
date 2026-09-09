import { NextRequest, NextResponse } from "next/server";
import { getNestServices } from "../../../../server/nest-app";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { payHereService, bookingsService, notifyLkService } =
      await getNestServices();

    const body = await req.json();

    console.log("[PayHere Webhook] Received:", body);

    // 1. Verify PayHere MD5 signature
    const isValid = payHereService.verifyNotificationHash(body);

    if (!isValid) {
      console.error("[PayHere Webhook] Invalid MD5 signature");

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "Invalid PayHere MD5 signature",
        },
        { status: 400 },
      );
    }

    // 2. Get order ID
    const orderId = body.order_id;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing order_id",
        },
        { status: 400 },
      );
    }

    // 3. Get PayHere status code
    const statusCode = Number(body.status_code);

    console.log(
      `[PayHere Webhook] Verified payment: ${orderId}, status_code=${statusCode}`,
    );

    // 4. Update booking
    const result = await bookingsService.verifyAndConfirmPayHerePayment(
      orderId,
      body.payment_id || null,
      statusCode,
      `PayHere Gateway IPN Callback (status_code ${statusCode})`,
    );

    // 5. Send Notify.lk SMS only after successful payment
    if (result.success && result.isNewlyConfirmed) {
      try {
        if (notifyLkService) {
          await notifyLkService.sendBookingConfirmation(result.booking);

          await notifyLkService.sendDoctorAlert(result.booking);

          console.log(
            `[PayHere Webhook] Notify.lk SMS sent for booking ${orderId}`,
          );
        } else {
          console.warn("[PayHere Webhook] Notify.lk service is not configured");
        }
      } catch (smsError) {
        console.error(
          "[PayHere Webhook] Notify.lk SMS notification error:",
          smsError,
        );
      }
    }

    // 6. Log final booking status
    console.log(`[PayHere Webhook] Booking ${orderId}: ${result.statusText}`);

    // 7. Respond to PayHere
    return NextResponse.json({
      success: true,
      verified: true,
      orderId,
      statusCode,
      statusText: result.statusText,
      booking: result.booking,
    });
  } catch (error: any) {
    console.error("[PayHere Webhook] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "PayHere webhook processing failed",
      },
      { status: 500 },
    );
  }
}
