import { NextRequest, NextResponse } from "next/server";
import { listRecords } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const personId = req.nextUrl.searchParams.get("personId");
    if (!personId) {
      return NextResponse.json({ error: "personId is required" }, { status: 400 });
    }
    const records = await listRecords(personId);
    return NextResponse.json({ records });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Failed to list records" }, { status: 500 });
  }
}
