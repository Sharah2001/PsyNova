import { Injectable, BadRequestException } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class PayHereService {
  private readonly merchantId = process.env.PAYHERE_MERCHANT_ID ?? "";
  private readonly merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? "";

  private readonly mode =
    process.env.PAYHERE_MODE?.toLowerCase() === "live" ? "live" : "sandbox";

  private readonly appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";

  private get checkoutUrl() {
    return this.mode === "live"
      ? "https://www.payhere.lk/pay/checkout"
      : "https://sandbox.payhere.lk/pay/checkout";
  }

  private md5(value: string): string {
    return crypto.createHash("md5").update(value).digest("hex").toUpperCase();
  }

  private formatAmount(amount: number | string): string {
    return Number(amount).toFixed(2);
  }

  generateHash(
    orderId: string,
    amount: number | string,
    currency = "LKR",
  ): string {
    if (!this.merchantId || !this.merchantSecret) {
      throw new BadRequestException(
        "PayHere merchant credentials are not configured",
      );
    }

    const formattedAmount = this.formatAmount(amount);

    const hashedSecret = this.md5(this.merchantSecret);

    return this.md5(
      this.merchantId + orderId + formattedAmount + currency + hashedSecret,
    );
  }

  createCheckoutParams(params: {
    orderId: string;
    amount: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    items: string;
    currency?: string;
  }) {
    const currency = params.currency ?? "LKR";
    const amount = this.formatAmount(params.amount);

    if (!this.appUrl) {
      throw new BadRequestException("APP_URL is not configured");
    }

    const hash = this.generateHash(params.orderId, amount, currency);

    return {
      checkoutUrl: this.checkoutUrl,

      params: {
        merchant_id: this.merchantId,

        return_url: `${this.appUrl}/payment/success?order_id=${encodeURIComponent(
          params.orderId,
        )}`,

        cancel_url: `${this.appUrl}/payment/cancel?order_id=${encodeURIComponent(
          params.orderId,
        )}`,

        notify_url: `${this.appUrl}/api/payments/payhere/notify`,

        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        phone: params.phone,

        address: params.address || "Sri Lanka",
        city: params.city || "Colombo",
        country: "Sri Lanka",

        order_id: params.orderId,
        items: params.items,

        currency,
        amount,

        hash,
      },
    };
  }

  verifyNotification(data: {
    merchant_id: string;
    order_id: string;
    payhere_amount: string;
    payhere_currency: string;
    status_code: string;
    md5sig: string;
  }): boolean {
    if (!this.merchantId) {
      console.error("[PayHere] PAYHERE_MERCHANT_ID is missing");
      return false;
    }

    if (!this.merchantSecret) {
      console.error("[PayHere] PAYHERE_MERCHANT_SECRET is missing");
      return false;
    }

    const merchantId = String(data.merchant_id).trim();
    const orderId = String(data.order_id).trim();

    // IMPORTANT:
    // Use PayHere's EXACT amount string.
    // Do NOT convert to Number() or toFixed().
    const payhereAmount = String(data.payhere_amount).trim();

    const currency = String(data.payhere_currency).trim();
    const statusCode = String(data.status_code).trim();
    const receivedHash = String(data.md5sig).trim().toUpperCase();

    if (
      !merchantId ||
      !orderId ||
      !payhereAmount ||
      !currency ||
      !statusCode ||
      !receivedHash
    ) {
      console.error("[PayHere] Missing notification fields");
      return false;
    }

    // PayHere notification signature:
    //
    // MD5(
    //   merchant_id +
    //   order_id +
    //   payhere_amount +
    //   payhere_currency +
    //   status_code +
    //   MD5(merchant_secret)
    // )
    //
    // Both MD5 values must be uppercase.

    const hashedSecret = this.md5(this.merchantSecret);

    const rawSignature =
      merchantId +
      orderId +
      payhereAmount +
      currency +
      statusCode +
      hashedSecret;

    const calculatedHash = this.md5(rawSignature);

    console.log("[PayHere] ===== SIGNATURE DEBUG =====");
    console.log("merchant_id:", merchantId);
    console.log("expected merchant_id:", this.merchantId);
    console.log("order_id:", orderId);
    console.log("payhere_amount:", payhereAmount);
    console.log("payhere_currency:", currency);
    console.log("status_code:", statusCode);
    console.log("received md5sig:", receivedHash);
    console.log("calculated md5sig:", calculatedHash);
    console.log("merchant matches:", merchantId === this.merchantId);
    console.log("signature matches:", calculatedHash === receivedHash);
    console.log("[PayHere] ===========================");

    return merchantId === this.merchantId && calculatedHash === receivedHash;
  }
}
