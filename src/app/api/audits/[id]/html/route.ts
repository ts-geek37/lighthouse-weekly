import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  try {
    const run = await prisma.auditRun.findUnique({
      where: { id },
      select: { htmlReport: true },
    });

    if (!run) {
      return new NextResponse("Audit run not found", { status: 404 });
    }

    if (!run.htmlReport) {
      return new NextResponse("HTML report not available for this audit", { status: 404 });
    }

    return new NextResponse(run.htmlReport, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error(`GET /api/audits/${id}/html error:`, error);
    return new NextResponse("Internal server error", { status: 500 });
  }
};
