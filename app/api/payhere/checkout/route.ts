import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const {
      orderId,
      amount,
      currency = "LKR",
      merchantId = process.env.PAYHERE_MERCHANT_ID,
    } = await req.json();

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    if (!merchantId) {
      throw new Error("PAYHERE_MERCHANT_ID is not configured");
    }

    if (!merchantSecret) {
      throw new Error("PAYHERE_MERCHANT_SECRET is not configured");
    }
    // Hash = UPPERCASE(MD5(merchant_id + order_id + amount_formatted + currency + UPPERCASE(MD5(merchant_secret))))
    const hashedSecret = crypto
      .createHash("md5")
      .update(merchantSecret)
      .digest("hex")
      .toUpperCase();
    const formattedAmount = Number(amount).toFixed(2);

    const hashString = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
    const hash = crypto
      .createHash("md5")
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    return NextResponse.json({
      success: true,
      hash,
      merchantId,
      orderId,
      amount: formattedAmount,
      currency,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to generate PayHere checkout hash" },
      { status: 500 },
    );
  }
}
