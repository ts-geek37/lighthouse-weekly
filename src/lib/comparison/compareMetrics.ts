import { MetricChange, MetricNormalizationConfig } from "./comparisonTypes";
import { METRIC_CONFIG } from "./config";
import { classifySeverity } from "./classifySeverity";

export function compareMetric(
  key: string,
  previous: number | null | undefined,
  current: number | null | undefined
): MetricChange {
  const config = METRIC_CONFIG[key];
  if (!config) {
    throw new Error(`Metric configuration not found for: ${key}`);
  }

  const prevVal = previous === undefined ? null : previous;
  const currVal = current === undefined ? null : current;

  // Initialize with fallback values if one or both are null
  if (prevVal === null || currVal === null) {
    return {
      metric: config.metric,
      label: config.label,
      unit: config.unit,
      previous: prevVal,
      current: currVal,
      delta: null,
      percentage: null,
      status: "stable",
      severity: "low",
    };
  }

  const delta = Math.round((currVal - prevVal) * 10000) / 10000;
  
  let percentage = 0;
  if (prevVal !== 0) {
    percentage = Math.round((delta / prevVal) * 10000) / 100;
  } else if (currVal !== 0) {
    percentage = currVal > 0 ? 100 : -100;
  }

  let status: "improved" | "regressed" | "stable" | "critical" = "stable";
  
  const isZeroDelta = Math.abs(delta) < 0.00001;

  if (!isZeroDelta) {
    if (config.direction === "lower_is_better") {
      if (delta < 0) {
        status = "improved";
      } else {
        status = currVal > config.poorThreshold ? "critical" : "regressed";
      }
    } else {
      if (delta > 0) {
        status = "improved";
      } else {
        status = currVal < config.poorThreshold ? "critical" : "regressed";
      }
    }
  }

  const severity = classifySeverity(config, prevVal, currVal, status);

  return {
    metric: config.metric,
    label: config.label,
    unit: config.unit,
    previous: prevVal,
    current: currVal,
    delta,
    percentage,
    status,
    severity,
  };
}

export function compareAllMetrics(
  prev: Record<string, number | null> | null | undefined,
  curr: Record<string, number | null>
): Record<string, MetricChange> {
  const result: Record<string, MetricChange> = {};
  
  for (const key of Object.keys(METRIC_CONFIG)) {
    result[key] = compareMetric(key, prev?.[key], curr[key]);
  }

  return result;
}
