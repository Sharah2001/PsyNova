import * as crypto from "crypto";

export class PayHereService {
  private merchantId = process.env.PAYHERE_MERCHANT_ID || "";
  private merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || "";
  private mode = process.env.PAYHERE_MODE || "sandbox";

  private validateConfig() {
    if (!this.merchantId) {
      throw new Error("PAYHERE_MERCHANT_ID is not configured");
    }

    if (!this.merchantSecret) {
      throw new Error("PAYHERE_MERCHANT_SECRET is not configured");
    }
  }

  getPayHereConfig() {
    return {
      merchantId: this.merchantId,
      mode: this.mode,
      checkoutUrl:
        this.mode === "live"
          ? "https://www.payhere.lk/pay/checkout"
          : "https://sandbox.payhere.lk/pay/checkout",
      currency: "LKR",
    };
  }

  generateHash(orderId: string, amount: number, currency = "LKR"): string {
    const formattedAmount = Number(amount).toFixed(2);
    const secretHash = crypto
      .createHash("md5")
      .update(this.merchantSecret)
      .digest("hex")
      .toUpperCase();

    const rawString = `${this.merchantId}${orderId}${formattedAmount}${currency}${secretHash}`;
    const hash = crypto
      .createHash("md5")
      .update(rawString)
      .digest("hex")
      .toUpperCase();

    return hash;
  }

  verifyNotificationHash(body: {
    merchant_id: string;
    order_id: string;
    payhere_amount: string | number;
    payhere_currency: string;
    status_code: string | number;
    md5sig: string;
  }): boolean {
    if (!body || !body.md5sig) {
      console.warn(
        "[PayHere Hash Verification] Failed: Missing md5sig in notification body",
        body,
      );
      return false;
    }

    const formattedAmount = Number(body.payhere_amount).toFixed(2);
    const secretHash = crypto
      .createHash("md5")
      .update(this.merchantSecret)
      .digest("hex")
      .toUpperCase();

    const rawString = `${body.merchant_id}${body.order_id}${formattedAmount}${body.payhere_currency}${body.status_code}${secretHash}`;
    const calculatedHash = crypto
      .createHash("md5")
      .update(rawString)
      .digest("hex")
      .toUpperCase();
    const receivedHash = body.md5sig.toUpperCase();
    const isMatch = calculatedHash === receivedHash;

    return isMatch;
  }

  createCheckoutParams(data: {
    orderId: string;
    items: string;
    amount: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    baseUrl?: string;
  }) {
    let rawBaseUrl = data.baseUrl || process.env.APP_URL || "";
    if (rawBaseUrl.endsWith("/")) {
      rawBaseUrl = rawBaseUrl.slice(0, -1);
    }

    const browserBaseUrl = (rawBaseUrl || "http://localhost:3000").replace(
      /\/+$/,
      "",
    );

    const notifyBaseUrl = browserBaseUrl;

    const hash = this.generateHash(data.orderId, data.amount, "LKR");
    const checkoutUrl =
      this.mode === "live"
        ? "https://www.payhere.lk/pay/checkout"
        : "https://sandbox.payhere.lk/pay/checkout";

    const payload = {
      checkout_url: checkoutUrl,
      sandbox: this.mode === "sandbox",
      merchant_id: this.merchantId,
      return_url: `${browserBaseUrl}/checkout/return?order_id=${data.orderId}`,
      cancel_url: `${browserBaseUrl}/checkout/cancel?order_id=${data.orderId}`,
      notify_url: `${notifyBaseUrl}/api/payments/payhere/notify`,
      order_id: data.orderId,
      items: data.items,
      amount: data.amount.toFixed(2),
      currency: "LKR",
      first_name: data.firstName || "Patient",
      last_name: data.lastName || "User",
      email: data.email || "patient@psynova.lk",
      phone: data.phone || "+94770000000",
      address: data.address || "Colombo, Sri Lanka",
      city: data.city || "Colombo",
      country: "Sri Lanka",
      hash,
    };

    console.log(
      "[PayHere Outgoing Checkout Payload Generated]:",
      JSON.stringify(payload, null, 2),
    );
    return payload;
  }
}
