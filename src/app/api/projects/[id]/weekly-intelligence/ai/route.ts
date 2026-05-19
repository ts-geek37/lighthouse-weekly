import { NextRequest, NextResponse } from "next/server";
import { WeeklyIntelligenceService } from "@/lib/comparison/intelligenceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // Await params even if not used to conform to Next.js guidelines
  const searchParams = request.nextUrl.searchParams;
  const projectUrlId = searchParams.get("projectUrlId");
  const latestRunId = searchParams.get("latestRunId");
  const previousRunId = searchParams.get("previousRunId");

  if (!projectUrlId || !latestRunId || !previousRunId) {
    return NextResponse.json(
      { error: "Missing required query parameters: projectUrlId, latestRunId, previousRunId" },
      { status: 400 }
    );
  }

  try {
    const aiInsight = await WeeklyIntelligenceService.getOrGenerateAiInsight(
      projectUrlId,
      latestRunId,
      previousRunId
    );
    return NextResponse.json({ aiInsight });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to generate AI insights: " + message }, { status: 500 });
  }
}
