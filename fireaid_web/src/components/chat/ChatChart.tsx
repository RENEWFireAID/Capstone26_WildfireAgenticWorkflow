"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export type ChatChartSpec = {
  type: "bar" | "line" | "pie" | "scatter";
  title: string;
  description?: string;
  data: { label: string; value: number }[];
};

const COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#ea580c", "#4f46e5",
];

export default function ChatChart({ chart }: { chart: ChatChartSpec }) {
  const { type, title, description, data } = chart;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-800">{title}</div>
      {description && (
        <div className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{description}</div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        ) : type === "scatter" ? (
          <ScatterChart margin={{ top: 12, right: 8, left: -12, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" name="label" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis dataKey="value" name="value" tick={{ fontSize: 9 }} />
            <ZAxis range={[60, 60]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#2563eb" />
          </ScatterChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ percent }) => (percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : "")}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        )}
      </ResponsiveContainer>

      <div className="mt-1 text-[10px] text-slate-400">
        {data.length} data points · from the Alaska fire records
      </div>
    </div>
  );
}
