import { NextRequest, NextResponse } from 'next/server';
import { getNestServices } from '../../../../server/nest-app';

export const dynamic = 'force-dynamic';

// GET or POST /api/sms/reminders - scans confirmed bookings and automatically triggers 5-minute reminders
export async function GET() {
  try {
    const { bookingsService, notifyLkService, smsWayService } = await getNestServices();
    const smsService = notifyLkService || smsWayService;

    const result = await bookingsService.scanAndDispatch5MinReminders(smsService);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dispatchedCount: result.dispatchedCount,
      details: result.details,
      message:
        result.dispatchedCount > 0
          ? `Automated 5-min pre-session SMS reminders dispatched to ${result.dispatchedCount} patient(s).`
          : 'All confirmed consultations are up-to-date; no pending 5-minute session reminders at this moment.',
    });
  } catch (error: any) {
    console.error('[Automated SMS Reminders API Error]:', error);
    return NextResponse.json({ error: error.message || 'Reminder scanner failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET();
}
