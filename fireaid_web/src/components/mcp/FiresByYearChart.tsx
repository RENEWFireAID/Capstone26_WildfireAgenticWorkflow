"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TOOLTIP_STYLE } from "@/components/ui/app";

type Point = { year: string; count: number };

export default function FiresByYearChart({
  data,
  height = 220,
  title,
}: {
  data: Point[];
  height?: number;
  title?: string;
}) {
  return (
    <div className="w-full">
      {title?.trim() && <h3 className="mb-2 text-base font-bold text-navy-deep">{title}</h3>}

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="year"
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "white" }}
            itemStyle={{ color: "white" }}
            cursor={{ fill: "#e5eef5" }}
          />

          <Bar
            dataKey="count"
            name="Fires"
            fill="#236192"
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
