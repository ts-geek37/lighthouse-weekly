import { NextRequest, NextResponse } from "next/server";
import { WeeklyIntelligenceService } from "@/lib/comparison/intelligenceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const report = await WeeklyIntelligenceService.getComparisonReport(id);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Project not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate weekly intelligence: " + message }, { status: 500 });
  }
}
