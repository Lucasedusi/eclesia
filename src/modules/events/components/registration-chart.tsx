"use client";

import { useEffect, useRef } from "react";
import { Users } from "lucide-react";
import * as S from "./events.styles";

type ChartRow = { label: string; value: number };

function wrapLabel(label: string) {
  if (label.length <= 24) return label;
  const words = label.split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > 24) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.slice(0, 3);
}

export function RegistrationChart({ title, rows }: { title: string; rows: ChartRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || rows.length === 0) return;
    let active = true;
    let chart: import("chart.js").Chart | null = null;

    void import("chart.js/auto").then(({ default: Chart }) => {
      if (!active || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: rows.map((row) => wrapLabel(row.label)),
          datasets: [{
            label: "Inscrições",
            data: rows.map((row) => row.value),
            backgroundColor: "rgba(65, 91, 165, 0.82)",
            borderColor: "#415ba5",
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 18,
          }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 320 },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0, color: "#667085", font: { size: 10 } },
              grid: { color: "rgba(234, 236, 240, 0.8)" },
              border: { display: false },
            },
            y: {
              ticks: { color: "#475467", font: { size: 10, weight: 600 } },
              grid: { display: false },
              border: { display: false },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: (items) => rows[items[0]?.dataIndex ?? 0]?.label ?? title,
                label: (context) => `${context.parsed.x} ${context.parsed.x === 1 ? "inscrição" : "inscrições"}`,
              },
            },
          },
        },
      });
    });

    return () => {
      active = false;
      chart?.destroy();
    };
  }, [rows, title]);

  return (
    <S.ChartCard>
      <header><span><Users /></span><h3>{title}</h3></header>
      {rows.length ? (
        <S.ChartCanvas $height={Math.max(220, Math.min(420, rows.length * 38))}>
          <canvas ref={canvasRef} role="img" aria-label={title} />
        </S.ChartCanvas>
      ) : (
        <S.ChartEmpty>Nenhuma inscrição disponível para compor este gráfico.</S.ChartEmpty>
      )}
    </S.ChartCard>
  );
}
