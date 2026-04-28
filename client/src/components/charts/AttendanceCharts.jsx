import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const colors = ["#2563eb", "#0ea5e9", "#38bdf8", "#1d4ed8", "#7dd3fc"];

export function DepartmentPie({ data = [], dataKey = "attendance", nameKey = "name" }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={60} outerRadius={95} paddingAngle={4}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data = [], xKey = "month", barColor = "#2563eb" }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="attendance" fill={barColor} radius={[12, 12, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SubjectBarChart({ data = [] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="code" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="attendance" fill="#0ea5e9" radius={[12, 12, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
