import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricsResponse } from "@/types/api";

export function MetricsChart({ data }: { data: MetricsResponse["daily"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradMsg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={28} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            labelFormatter={(l: string) =>
              new Date(l).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
            }
          />
          <Area
            type="monotone"
            dataKey="conversations"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#gradConv)"
            name="Conversations"
          />
          <Area
            type="monotone"
            dataKey="messages"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#gradMsg)"
            name="Messages"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
