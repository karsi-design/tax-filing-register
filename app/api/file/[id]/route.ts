import { NextRequest, NextResponse } from "next/server";
import { getFileStream } from "@/lib/drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const download = req.nextUrl.searchParams.get("download") === "1";
    const { name, mimeType, stream } = await getFileStream(id);

    const chunks: Buffer[] = [];
    for await (const chunk of stream as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    return new NextResponse(body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "Could not load file" }, { status: 500 });
  }
}
