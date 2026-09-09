import { Complaint } from '../../lib/types';
import { initialComplaints } from '../../lib/mockData';
import { BookingsService } from '../bookings/bookings.service';
import { DatabaseService } from '../database/database.service';

export class ComplaintsService {
  private complaints: Complaint[] = [...initialComplaints];

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly databaseService?: DatabaseService
  ) {}

  findAll(): Complaint[] {
    return this.complaints;
  }

  async addComplaint(
    bookingId: string,
    reason: string,
    details: string,
    patientName?: string
  ): Promise<Complaint> {
    let booking;

    try {
      booking = await this.bookingsService.findOne(bookingId);
    } catch (e) {}

    const newComplaint: Complaint = {
      id: `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
      bookingId,
      patientId: booking?.patientId || 'pat-1',
      patientName: patientName || booking?.patientName || 'Patient',
      doctorId: booking?.doctorId || 'doc-1',
      doctorName: booking?.doctorName || 'Psychiatrist',
      reason,
      details,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    this.complaints = [newComplaint, ...this.complaints];

    this.databaseService
      ?.saveComplaint(newComplaint)
      .catch((e) => console.warn('Postgres saveComplaint error:', e));

    return newComplaint;
  }

  resolveComplaint(
    complaintId: string,
    proofUrl: string,
    note: string
  ): Complaint {
    let updated: Complaint | undefined;

    this.complaints = this.complaints.map((c) => {
      if (c.id === complaintId) {
        updated = {
          ...c,
          status: 'Resolved',
          resolutionProof:
            proofUrl || 'Proof_Document_Uploaded.pdf',
          resolutionNote:
            note || 'Issue resolved by administration refund protocol.',
        };
        return updated;
      }

      return c;
    });

    if (!updated) {
      throw new Error('Complaint not found');
    }

    this.databaseService
      ?.saveComplaint(updated)
      .catch((e) => console.warn('Postgres saveComplaint error:', e));

    return updated;
  }
}
