import { NextResponse } from "next/server";
import { uploadDoc, deleteDoc, DOC_TYPES, type DocKey } from "@/lib/drive";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const folderId = form.get("folderId");
    const docType = form.get("docType") as DocKey | null;
    const file = form.get("file") as File | null;

    if (!folderId || typeof folderId !== "string") {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }
    if (!docType || !DOC_TYPES.some((d) => d.key === docType)) {
      return NextResponse.json({ error: "Invalid docType" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadDoc(folderId, docType, file.name, file.type || "application/octet-stream", buffer);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { fileId } = await req.json();
    if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    await deleteDoc(fileId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Delete failed" }, { status: 500 });
  }
}
