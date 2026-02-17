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

type Point = { year: string; count: number };

export default function FiresByYearChart({
  data,
  height = 680, // 🔥 更高
  title = "Prescribed Fires by Year",
}: {
  data: Point[];
  height?: number;
  title?: string;
}) {
  return (
    <div
      className="w-full bg-white/60 backdrop-blur-md rounded-2xl p-6 shadow-xl"
      style={{ height }}
    >
      <h2 className="text-lg font-semibold mb-2 text-gray-700">
        {title}
      </h2>

      <ResponsiveContainer width="100%" height="95%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              borderRadius: "12px",
              border: "none",
              color: "white",
            }}
          />

          <Bar
            dataKey="count"
            fill="#2563eb"
            radius={[6, 6, 0, 0]}
            barSize={18}   // 🔥 柱子更细
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
