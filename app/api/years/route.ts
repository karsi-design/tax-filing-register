import { NextResponse } from "next/server";
import { ensureYearFolder, renameYearFolder } from "@/lib/drive";

export async function POST(req: Request) {
  try {
    const { personId, ay, fy } = await req.json();
    if (!personId || !ay || !fy) {
      return NextResponse.json({ error: "personId, ay and fy are required" }, { status: 400 });
    }
    const folderId = await ensureYearFolder(String(personId), String(ay).trim(), String(fy).trim());
    return NextResponse.json({ folderId });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Failed to add year" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { folderId, ay, fy } = await req.json();
    if (!folderId || !ay || !fy) {
      return NextResponse.json({ error: "folderId, ay and fy are required" }, { status: 400 });
    }
    await renameYearFolder(String(folderId), String(ay).trim(), String(fy).trim());
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Failed to update year" }, { status: 500 });
  }
}