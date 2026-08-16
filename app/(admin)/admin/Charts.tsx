"use client";

import { useId, useState } from "react";

import styles from "./admin.module.css";

// Chart conventions used here, and why:
//
// - Single series everywhere, so there is no legend (the card title names the
//   measure) and no categorical palette — one hue carries magnitude.
// - Brand blue #085aff, validated against the white card surface: inside the
//   lightness band, above the chroma floor and >= 3:1 contrast.
// - Recessive chrome: hairline gridlines, muted axis labels, no chart junk.
// - Values are direct-labelled selectively (latest and peak only), never one
//   number per point.
// - Light mode only: the admin is a single-surface internal tool, so a dark
//   palette would be a second set of unvalidated colours for no reader.

const SERIES = "#085aff";
const GRID = "#eef2f9";
const AXIS_INK = "#8b93a7";

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export type SeriesPoint = { date: string; visitors: number; pageViews: number };

/**
 * Daily trend. An area chart for a single measure, with an invisible hit column
 * per day driving a crosshair and tooltip — a line chart without a hover layer
 * makes the reader estimate values off the axis.
 */
export function TrendChart({ data, measure }: { data: SeriesPoint[]; measure: "visitors" | "pageViews" }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className={styles.empty}>No traffic recorded yet.</p>;
  }

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = data.map((point) => point[measure]);
  const peak = Math.max(...values, 1);
  // Round the axis top to something readable rather than the raw maximum.
  const step = Math.max(1, Math.ceil(peak / 4));
  const axisTop = step * 4;

  const x = (index: number) =>
    padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / axisTop) * plotHeight;

  const linePath = data
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[measure])}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${padding.top + plotHeight} L ${x(0)} ${
    padding.top + plotHeight
  } Z`;

  const peakIndex = values.indexOf(Math.max(...values));
  const lastIndex = data.length - 1;
  const active = hover ?? lastIndex;

  return (
    <div className={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.chart}
        role="img"
        aria-label={`Daily ${measure === "visitors" ? "visitors" : "page views"} over the selected range`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity="0.22" />
            <stop offset="100%" stopColor={SERIES} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((tick) => {
          const value = (axisTop / 4) * tick;
          const lineY = y(value);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={lineY}
                y2={lineY}
                stroke={GRID}
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={lineY + 4} textAnchor="end" fontSize="11" fill={AXIS_INK}>
                {value}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" />

        {/* Selective direct labels: the peak and the latest value only. */}
        {[peakIndex, lastIndex]
          .filter((index, position, all) => all.indexOf(index) === position)
          .map((index) => (
            <circle
              key={index}
              cx={x(index)}
              cy={y(data[index][measure])}
              r="4"
              fill={SERIES}
              stroke="#fff"
              strokeWidth="2"
            />
          ))}

        {hover !== null ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke={SERIES}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hover)}
              cy={y(data[hover][measure])}
              r="5"
              fill={SERIES}
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        ) : null}

        {data.map((point, index) => {
          const bandWidth = plotWidth / Math.max(1, data.length - 1);
          return (
            <rect
              key={point.date}
              x={x(index) - bandWidth / 2}
              y={padding.top}
              width={bandWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${point.date}: ${point[measure]}`}</title>
            </rect>
          );
        })}

        {data.map((point, index) => {
          // Thin the axis labels so they never collide at 30 or 90 days.
          const stride = Math.ceil(data.length / 7);
          if (index % stride !== 0 && index !== lastIndex) return null;
          return (
            <text
              key={point.date}
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill={AXIS_INK}
            >
              {formatDay(point.date)}
            </text>
          );
        })}
      </svg>

      <p className={styles.chartReadout} aria-live="polite">
        <strong>{data[active][measure]}</strong>{" "}
        {measure === "visitors" ? "visitors" : "page views"} on {data[active].date}
      </p>
    </div>
  );
}

/**
 * Magnitude comparison for labelled categories. Horizontal because the labels
 * are event names and URL paths, which do not fit under vertical columns.
 */
export function BarList({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; count: number }>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  const peak = Math.max(...items.map((item) => item.count), 1);

  return (
    <ol className={styles.barList}>
      {items.map((item) => (
        <li key={item.label} className={styles.barRow} title={`${item.label}: ${item.count}`}>
          <span
            className={styles.barFill}
            style={{ width: `${Math.max(2, (item.count / peak) * 100)}%` }}
            aria-hidden="true"
          />
          <span className={styles.barLabel}>{item.label}</span>
          <span className={styles.barValue}>{item.count}</span>
        </li>
      ))}
    </ol>
  );
}
