import { NextRequest, NextResponse } from "next/server";
import { WeeklyIntelligenceService } from "@/lib/comparison/intelligenceService";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const device = (searchParams.get("device") || "mobile") as "mobile" | "desktop";

  if (device !== "mobile" && device !== "desktop") {
    return NextResponse.json({ error: "Invalid device parameter. Must be 'mobile' or 'desktop'." }, { status: 400 });
  }

  try {
    const report = await WeeklyIntelligenceService.getComparisonReport(id, device);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Project not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate weekly intelligence: " + message }, { status: 500 });
  }
};
