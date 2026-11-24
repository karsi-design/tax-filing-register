import { NextResponse } from "next/server";
import { listPeople, ensurePerson } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const people = await listPeople();
    return NextResponse.json({ people });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Failed to list family members" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "A name is required" }, { status: 400 });
    }
    const person = await ensurePerson(name.trim());
    return NextResponse.json({ person });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Failed to add family member" }, { status: 500 });
  }
}
