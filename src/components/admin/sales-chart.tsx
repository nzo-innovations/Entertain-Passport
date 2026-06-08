"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SalesChart({ data }: { data: { day: string; tickets: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(263 90% 70%)" stopOpacity={0.7} />
            <stop offset="100%" stopColor="hsl(263 90% 70%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="tix" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(330 85% 62%)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(330 85% 62%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(263 90% 70%)"
          strokeWidth={2}
          fill="url(#rev)"
        />
        <Area
          type="monotone"
          dataKey="tickets"
          stroke="hsl(330 85% 62%)"
          strokeWidth={2}
          fill="url(#tix)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
