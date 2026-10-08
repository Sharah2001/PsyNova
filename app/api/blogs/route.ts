import { NextRequest, NextResponse } from "next/server";
import { getNestServices } from "../../../server/nest-app";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { blogsService } = await getNestServices();
  const includeDrafts = request.nextUrl.searchParams.get("includeDrafts") === "true";
  return NextResponse.json(await blogsService.findAll(includeDrafts));
}

export async function POST(request: NextRequest) {
  try {
    const { blogsService } = await getNestServices();
    return NextResponse.json(await blogsService.save(await request.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save blog." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Blog id is required." }, { status: 400 });
  const { blogsService } = await getNestServices();
  await blogsService.remove(id);
  return NextResponse.json({ success: true });
}
