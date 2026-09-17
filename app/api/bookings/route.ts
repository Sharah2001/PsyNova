import { NextRequest, NextResponse } from "next/server";
import { getNestServices } from "../../../server/nest-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// GET /api/bookings
//
// GET /api/bookings
//      -> returns ALL bookings from PostgreSQL
//
// GET /api/bookings?id=BK-12345
//      -> returns ONE booking
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const { bookingsService } = await getNestServices();

    const { searchParams } = new URL(req.url);

    const id = searchParams.get("id");

    // ----------------------------------------------------------
    // GET ONE
    // ----------------------------------------------------------

    if (id) {
      const booking = await bookingsService.findOne(id);

      return NextResponse.json(booking, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ----------------------------------------------------------
    // GET ALL
    // ----------------------------------------------------------

    const bookings = await bookingsService.findAll();

    console.log(
      "[GET /api/bookings] findAll returned:",
      bookings.length,
      "booking(s)",
    );

    return NextResponse.json(bookings, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/bookings] Error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to load bookings",
      },
      {
        status: 500,
      },
    );
  }
}

// ============================================================
// POST /api/bookings
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { bookingsService } = await getNestServices();

    const body = await req.json();

    if (!body) {
      return NextResponse.json(
        {
          error: "Request body is required",
        },
        {
          status: 400,
        },
      );
    }

    // ----------------------------------------------------------
    // CREATE PENDING BOOKING
    // ----------------------------------------------------------

    if (body.action === "create-pending") {
      const result = await bookingsService.createPendingBooking(body);

      return NextResponse.json(result, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    // ----------------------------------------------------------
    // CANCEL
    // ----------------------------------------------------------

    if (body.action === "approve-refund") {
      if (!body.bookingId) {
        return NextResponse.json(
          { error: "bookingId is required" },
          { status: 400 },
        );
      }

      if (!body.adminId) {
        return NextResponse.json(
          { error: "adminId is required" },
          { status: 400 },
        );
      }

      const result = await bookingsService.approveRefund(
        body.bookingId,
        body.adminId,
        body.note,
      );

      return NextResponse.json(result);
    }

    if (body.action === "reject-refund") {
      if (!body.bookingId) {
        return NextResponse.json(
          { error: "bookingId is required" },
          { status: 400 },
        );
      }

      if (!body.adminId) {
        return NextResponse.json(
          { error: "adminId is required" },
          { status: 400 },
        );
      }

      const result = await bookingsService.rejectRefund(
        body.bookingId,
        body.adminId,
        body.note,
      );

      return NextResponse.json(result);
    }
    if (body.action === "cancel") {
      if (!body.bookingId) {
        return NextResponse.json(
          {
            error: "bookingId is required",
          },
          {
            status: 400,
          },
        );
      }

      const actor = (body.actor || "PATIENT").toUpperCase();

      if (!["PATIENT", "DOCTOR", "ADMIN"].includes(actor)) {
        return NextResponse.json(
          { error: "Valid actor is required: PATIENT, DOCTOR, or ADMIN" },
          { status: 400 },
        );
      }

      const resolutionType = body.resolutionType || "none";

      if (actor === "PATIENT" && resolutionType !== "none") {
        return NextResponse.json(
          {
            error:
              "Patient cancellation cannot include refund or reschedule requests.",
          },
          { status: 400 },
        );
      }

      const result = await bookingsService.cancelBooking(
        body.bookingId,
        actor,
        resolutionType,
        body.note,
      );

      return NextResponse.json(result);
    }

    // ----------------------------------------------------------
    // COMPLETE
    // ----------------------------------------------------------

    if (body.action === "complete") {
      if (!body.bookingId) {
        return NextResponse.json(
          {
            error: "bookingId is required",
          },
          {
            status: 400,
          },
        );
      }

      const result = await bookingsService.completeBooking(body.bookingId);

      return NextResponse.json(result);
    }

    // ----------------------------------------------------------
    // PAYOUT
    // ----------------------------------------------------------

    if (body.action === "payout") {
      if (!body.bookingId) {
        return NextResponse.json(
          {
            error: "bookingId is required",
          },
          {
            status: 400,
          },
        );
      }

      const result = await bookingsService.markPayoutPaid(body.bookingId);

      return NextResponse.json(result);
    }

    if (body.action === "confirmation-sms-sent") {
      if (!body.bookingId) {
        return NextResponse.json(
          { error: "bookingId is required" },
          { status: 400 },
        );
      }

      const result = await bookingsService.markConfirmationSmsSent(
        body.bookingId,
      );

      return NextResponse.json(result);
    }

    // ----------------------------------------------------------
    // LEGACY DIRECT BOOKING
    // ----------------------------------------------------------

    const result = await bookingsService.createBooking(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[POST /api/bookings] Error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Booking operation failed",
      },
      {
        status: 400,
      },
    );
  }
}
