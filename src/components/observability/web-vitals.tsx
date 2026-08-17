"use client";

import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

let initialPathname: string | null = null;

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  const pathname = window.location.pathname;
  const entryKind = initialPathname === null
    ? "first-entry"
    : initialPathname === pathname
      ? "same-route"
      : "internal-navigation";
  initialPathname ??= pathname;

  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
    route: pathname,
    entryKind,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/telemetry/web-vitals",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/telemetry/web-vitals", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
  });
};

export function WebVitals() {
  useReportWebVitals(reportWebVitals);
  return null;
}
