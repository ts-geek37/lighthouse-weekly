import { compareMetric, compareAllMetrics } from "../compareMetrics";
import { diffOpportunities, generateRecommendations } from "../detectRegressions";
import { METRIC_CONFIG } from "../config";
import { Opportunity } from "@/types";

describe("Weekly Performance Intelligence Engine", () => {
  describe("compareMetric", () => {
    it("returns stable status for null previous/current values", () => {
      const result = compareMetric("lcp", null, 2500);
      expect(result.status).toBe("stable");
      expect(result.delta).toBeNull();
    });

    it("correctly identifies regression for lower_is_better metrics", () => {
      const prev = 2000;
      const curr = 3000;
      const result = compareMetric("lcp", prev, curr);
      expect(result.status).toBe("regressed");
      expect(result.delta).toBe(1000);
      expect(result.percentage).toBe(50);
    });

    it("correctly identifies critical threshold crossing for lower_is_better metrics", () => {
      const prev = 3500;
      const curr = 4500; // poorThreshold is 4000
      const result = compareMetric("lcp", prev, curr);
      expect(result.status).toBe("critical");
      expect(result.severity).toBe("high");
    });

    it("correctly identifies improvement for lower_is_better metrics", () => {
      const prev = 3000;
      const curr = 2000;
      const result = compareMetric("lcp", prev, curr);
      expect(result.status).toBe("improved");
      expect(result.delta).toBe(-1000);
      expect(result.percentage).toBe(-33.33);
    });

    it("correctly identifies regression for higher_is_better metrics", () => {
      const prev = 95;
      const curr = 85;
      const result = compareMetric("performanceScore", prev, curr);
      expect(result.status).toBe("regressed");
      expect(result.delta).toBe(-10);
    });

    it("correctly identifies critical threshold crossing for higher_is_better metrics", () => {
      const prev = 60;
      const curr = 40; // poorThreshold is 50
      const result = compareMetric("performanceScore", prev, curr);
      expect(result.status).toBe("critical");
      expect(result.severity).toBe("high");
    });
  });

  describe("diffOpportunities", () => {
    const optA: Opportunity = { id: "uses-optimized-images", title: "Optimize Images", description: "Optimize" };
    const optB: Opportunity = { id: "unused-javascript", title: "Unused JS", description: "Unused" };
    const optC: Opportunity = { id: "render-blocking-resources", title: "Render Blocking", description: "Render" };

    it("correctly computes new and resolved opportunities", () => {
      const prev = [optA, optB];
      const curr = [optB, optC];

      const { newOpps, resolvedOpps } = diffOpportunities(prev, curr);

      // optC is in current but not in previous -> new
      expect(newOpps).toHaveLength(1);
      expect(newOpps[0].id).toBe("render-blocking-resources");

      // optA is in previous but not in current -> resolved
      expect(resolvedOpps).toHaveLength(1);
      expect(resolvedOpps[0].id).toBe("uses-optimized-images");
    });
  });

  describe("generateRecommendations", () => {
    it("returns high-priority action for CLS regression with image optimization flags", () => {
      const metrics = compareAllMetrics({ cls: 0.1 }, { cls: 0.25 });
      const currentOpps = [{ id: "uses-optimized-images", title: "Optimize Images", description: "Optimize" }];
      const newOpps = [{ id: "uses-optimized-images", title: "Optimize Images", description: "Optimize" }];

      const recs = generateRecommendations(metrics as any, currentOpps, newOpps);

      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].priority).toBe("high");
      expect(recs[0].issue).toContain("CLS");
    });

    it("returns fallback action for generic performance regression without specific flags", () => {
      const metrics = compareAllMetrics({ performanceScore: 90 }, { performanceScore: 80 });
      
      const recs = generateRecommendations(metrics as any, [], []);

      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].priority).toBe("medium");
      expect(recs[0].issue).toContain("General performance regression");
    });
  });
});
