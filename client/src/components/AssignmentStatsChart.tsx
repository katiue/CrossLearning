import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export default function AssignmentStatsChart({ data = [], totalCompleted = 0 }) {
  return (
    <Card className="bg-card border border-border shadow-lg rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground text-xl flex items-center justify-between">
          <span>📊 Assignment Completion Insights</span>
          <span className="text-sm font-normal text-muted-foreground">
            Total:{" "}
            <span className="text-primary font-semibold">{totalCompleted}</span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="w-full h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              {/* Gradients */}
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor="var(--chart-4)" stopOpacity={0.6} />
                  <stop offset="90%" stopColor="var(--chart-4)" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--card))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                allowDecimals={false}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--border))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  color: "hsl(var(--foreground))",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 10 }}
              />

              {/* Smooth trend + solid bars */}
              <Area
                type="monotone"
                dataKey="count"
                name="Completion Trend"
                stroke="var(--chart-4)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#areaGradient)"
              />
              <Bar
                dataKey="count"
                name="Assignments Completed"
                fill="url(#barGradient)"
                barSize={30}
                radius={[6, 6, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
