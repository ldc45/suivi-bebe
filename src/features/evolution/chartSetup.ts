import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";
import { cssVar } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

/** Options communes, alignées sur les couleurs du thème. */
export function baseOptions(extra: { stacked?: boolean; yMin?: number; yMax?: number; decimals?: number; legend?: boolean } = {}) {
  const muted = cssVar("--muted"), line = cssVar("--line");
  const font = { family: "Figtree, system-ui, sans-serif", size: 11 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: extra.legend ?? true, position: "bottom" as const, labels: { color: muted, boxWidth: 10, boxHeight: 10, font } },
      tooltip: { titleFont: font, bodyFont: font },
    },
    scales: {
      x: { stacked: extra.stacked, ticks: { color: muted, font, maxRotation: 0, autoSkip: true }, grid: { display: false }, border: { color: line } },
      y: {
        stacked: extra.stacked, beginAtZero: extra.yMin === undefined, suggestedMin: extra.yMin, suggestedMax: extra.yMax,
        ticks: { color: muted, font, precision: extra.decimals ?? 0 }, grid: { color: line }, border: { display: false },
      },
    },
  };
}
