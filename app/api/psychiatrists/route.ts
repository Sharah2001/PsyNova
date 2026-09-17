import { NextRequest, NextResponse } from "next/server";
import { getNestServices } from "../../../server/nest-app";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { psychiatristsService, databaseService } = await getNestServices();
    const data = psychiatristsService.findAll();

    if (!databaseService) {
      return NextResponse.json(data);
    }

    const bookings = await databaseService.getAllBookings();
    const bookedSlotIdsByDoctor = new Map<string, Set<string>>();

    for (const booking of bookings) {
      if (["pending", "confirmed", "completed"].includes(booking.status)) {
        const doctorId = booking.doctorId;
        if (!bookedSlotIdsByDoctor.has(doctorId)) {
          bookedSlotIdsByDoctor.set(doctorId, new Set());
        }

        bookedSlotIdsByDoctor.get(doctorId)?.add(booking.slotId);
      }
    }

    const hydrated = data.map((doctor) => {
      const bookedIds = bookedSlotIdsByDoctor.get(doctor.id) ?? new Set();

      return {
        ...doctor,
        upcomingSlots: doctor.upcomingSlots.map((slot) =>
          bookedIds.has(slot.id) ? { ...slot, status: "booked" } : slot,
        ),
      };
    });

    return NextResponse.json(hydrated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch psychiatrists" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { psychiatristsService } = await getNestServices();
    const body = await req.json();

    if (body.action === "add-slot") {
      if (!body.doctorId) {
        return NextResponse.json(
          { error: "doctorId is required" },
          { status: 400 },
        );
      }

      if (!body.slot) {
        return NextResponse.json(
          { error: "slot is required" },
          { status: 400 },
        );
      }

      const result = await (psychiatristsService as any).addDoctorSlot(
        body.doctorId,
        body.slot,
      );

      return NextResponse.json(result);
    }

    if (body.action === "boost") {
      const res = psychiatristsService.boost(body.doctorId, body.tier);
      return NextResponse.json(res);
    } else if (body.action === "unboost") {
      const res = psychiatristsService.unboost(body.doctorId);
      return NextResponse.json(res);
    } else if (body.action === "uploadDoc") {
      const res = psychiatristsService.uploadDoc(body.doctorId, body.docName);
      return NextResponse.json(res);
    } else if (body.action === "deleteDoc") {
      const res = psychiatristsService.deleteDoc(body.doctorId, body.docId);
      return NextResponse.json(res);
    }

    const doc = psychiatristsService.addDoctor(body);
    return NextResponse.json(doc);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Action failed" },
      { status: 400 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { psychiatristsService } = await getNestServices();
    const body = await req.json();
    const doc = psychiatristsService.updateStatus(body.doctorId, body.status);
    return NextResponse.json(doc);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Update failed" },
      { status: 400 },
    );
  }
}
