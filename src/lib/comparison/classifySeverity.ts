import { MetricNormalizationConfig } from "./comparisonTypes";

type MetricStatus = "improved" | "regressed" | "stable" | "critical";
type Confidence = "low" | "medium" | "high";

export const classifySeverity = (
  config: MetricNormalizationConfig,
  prevVal: number,
  currVal: number,
  status: MetricStatus,
): Confidence => {
  if (status === "stable" || status === "improved") {
    return "low";
  }

  const weight = config.weight;
  
  // Calculate relative degradation
  let relativeChange = 0;
  if (config.direction === "lower_is_better") {
    relativeChange = (currVal - prevVal) / (config.poorThreshold || 1);
  } else {
    relativeChange = (prevVal - currVal) / (config.poorThreshold || 1);
  }

  const severityScore = relativeChange * weight;

  // Threshold crossings immediately elevate severity
  const crossedThreshold =
    (config.direction === "lower_is_better" && prevVal <= config.poorThreshold && currVal > config.poorThreshold) ||
    (config.direction === "higher_is_better" && prevVal >= config.poorThreshold && currVal < config.poorThreshold);

  if (crossedThreshold || severityScore >= 0.4 || status === "critical") {
    return "high";
  }
  if (severityScore >= 0.15) {
    return "medium";
  }
  return "low";
};

export const calculateConfidence = (
  metric: string,
  delta: number,
  hasMatchingOpportunity: boolean,
): Confidence => {
  const absDelta = Math.abs(delta);

  // Define noise thresholds for each metric
  let noiseThreshold = 0;
  let signalThreshold = 0;

  switch (metric) {
    case "performanceScore":
      noiseThreshold = 2; // delta < 2 is noise
      signalThreshold = 7; // delta >= 7 is high confidence signal
      break;
    case "lcp":
      noiseThreshold = 100; // < 100ms is noise
      signalThreshold = 600; // >= 600ms is solid signal
      break;
    case "cls":
      noiseThreshold = 0.01;
      signalThreshold = 0.05;
      break;
    case "inpOrTbt":
      noiseThreshold = 30;
      signalThreshold = 150;
      break;
    case "fcp":
      noiseThreshold = 100;
      signalThreshold = 400;
      break;
    case "ttfb":
      noiseThreshold = 50;
      signalThreshold = 250;
      break;
    default:
      noiseThreshold = 5;
      signalThreshold = 15;
  }

  if (absDelta <= noiseThreshold) {
    return "low";
  }

  if (absDelta >= signalThreshold) {
    return hasMatchingOpportunity ? "high" : "medium";
  }

  return hasMatchingOpportunity ? "high" : "medium";
};
