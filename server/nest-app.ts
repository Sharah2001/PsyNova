import "dotenv/config";
import { PsychiatristsService } from "./psychiatrists/psychiatrists.service";
import { BookingsService } from "./bookings/bookings.service";
import { ReviewsService } from "./reviews/reviews.service";
import { ComplaintsService } from "./complaints/complaints.service";
import { AuthService } from "./auth/auth.service";
import { SettingsService } from "./settings/settings.service";
import { NotifyLkService } from "./sms/notifylk.service";
import { PayHereService } from "./payments/payhere.service";
import { DatabaseService } from "./database/database.service";

const databaseService = new DatabaseService();
const psychiatristsService = new PsychiatristsService();
const bookingsService = new BookingsService(
  psychiatristsService,
  databaseService,
);
const reviewsService = new ReviewsService(
  psychiatristsService,
  databaseService,
);
const complaintsService = new ComplaintsService(
  bookingsService,
  databaseService,
);
const authService = new AuthService();
const settingsService = new SettingsService(databaseService);
const notifyLkService = new NotifyLkService();
const payHereService = new PayHereService();

export async function getNestServices() {
  return {
    psychiatristsService,
    bookingsService,
    reviewsService,
    complaintsService,
    authService,
    settingsService,
    notifyLkService,
    smsWayService: notifyLkService,
    payHereService,
    databaseService,
  };
}
