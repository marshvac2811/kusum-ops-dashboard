import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from "recharts";
import {
  Sun, Droplets, Truck, Wrench, IndianRupee, MapPin, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, ChevronRight, Activity,
} from "lucide-react";

// ---------- Mock operational data (illustrative — PM-KUSUM Component B/C shape) ----------

const STATES = [
  { code: "MH", name: "Maharashtra", surveyed: 4200, sanctioned: 3850, dispatched: 3400, installed: 3100, commissioned: 2890 },
  { code: "HR", name: "Haryana", surveyed: 3100, sanctioned: 2900, dispatched: 2600, installed: 2450, commissioned: 2380 },
  { code: "RJ", name: "Rajasthan", surveyed: 2600, sanctioned: 2300, dispatched: 1850, installed: 1600, commissioned: 1420 },
  { code: "MP", name: "Madhya Pradesh", surveyed: 2100, sanctioned: 1950, dispatched: 1500, installed: 1180, commissioned: 980 },
  { code: "UP", name: "Uttar Pradesh", surveyed: 1800, sanctioned: 1600, dispatched: 1100, installed: 780, commissioned: 610 },
  { code: "GJ", name: "Gujarat", surveyed: 1500, sanctioned: 1420, dispatched: 1300, installed: 1240, commissioned: 1190 },
  { code: "PB", name: "Punjab", surveyed: 950, sanctioned: 880, dispatched: 640, installed: 510, commissioned: 430 },
  { code: "CG", name: "Chhattisgarh", surveyed: 780, sanctioned: 710, dispatched: 580, installed: 490, commissioned: 440 },
];

const CLAIMS = [
  { state: "MH", component: "B", amount: 412, bucket: "0-30" },
  { state: "MH", component: "C", amount: 138, bucket: "31-60" },
  { state: "HR", component: "B", amount: 286, bucket: "0-30" },
  { state: "HR", component: "C", amount: 94, bucket: "61-90" },
  { state: "RJ", component: "B", amount: 221, bucket: "31-60" },
  { state: "RJ", component: "C", amount: 176, bucket: "90+" },
  { state: "MP", component: "B", amount: 167, bucket: "61-90" },
  { state: "UP", component: "B", amount: 143, bucket: "90+" },
  { state: "GJ", component: "C", amount: 118, bucket: "0-30" },
  { state: "PB", component: "B", amount: 76, bucket: "31-60" },
  { state: "CG", component: "B", amount: 58, bucket: "0-30" },
];

const BUCKET_META = {
  "0-30": { label: "0–30 days", color: "#2FA8A0" },
  "31-60": { label: "31–60 days", color: "#E8A93E" },
  "61-90": { label: "61–90 days", color: "#D97D3C" },
  "90+": { label: "90+ days — at risk", color: "#C1543A" },
};

const TEAMS = [
  { name: "Field Team — Nagpur", state: "MH", installs: 118, turnaround: 6.2, ftr: 94 },
  { name: "Field Team — Panipat", state: "HR", installs: 96, turnaround: 5.4, ftr: 97 },
  { name: "Field Team — Jodhpur", state: "RJ", installs: 74, turnaround: 8.1, ftr: 86 },
  { name: "Field Team — Bhopal", state: "MP", installs: 51, turnaround: 9.6, ftr: 81 },
  { name: "Field Team — Lucknow", state: "UP", installs: 33, turnaround: 11.3, ftr: 74 },
  { name: "Field Team — Rajkot", state: "GJ", installs: 62, turnaround: 6.8, ftr: 92 },
];

const TICKETS = [
  { id: "SR-4471", issue: "Controller fault", state: "MH", daysOpen: 2, sla: "on-track" },
  { id: "SR-4488", issue: "Motor underperformance", state: "RJ", daysOpen: 9, sla: "breach" },
  { id: "SR-4502", issue: "Panel misalignment", state: "HR", daysOpen: 1, sla: "on-track" },
  { id: "SR-4517", issue: "Pump priming issue", state: "UP", daysOpen: 12, sla: "breach" },
  { id: "SR-4529", issue: "Wiring damage", state: "MP", daysOpen: 4, sla: "at-risk" },
  { id: "SR-4533", issue: "Structure corrosion", state: "GJ", daysOpen: 3, sla: "on-track" },
];

const STAGES = [
  { key: "surveyed", label: "Site Surveyed" },
  { key: "sanctioned", label: "Subsidy Sanctioned" },
  { key: "dispatched", label: "Material Dispatched" },
  { key: "installed", label: "Installed" },
  { key: "commissioned", label: "Commissioned" },
];

function sum(arr, key) { return arr.reduce((a, r) => a + r[key], 0); }
function fmtCr(n) { return `₹${n}L`; }

export default function KusumOpsDashboard() {
  const [activeState, setActiveState] = useState("ALL");
  const [dataSource, setDataSource] = useState("mock");

  const totals = useMemo(() => {
    const t = {};
    STAGES.forEach((s) => { t[s.key] = sum(STATES, s.key); });
    return t;
  }, []);

  const bottleneck = useMemo(() => {
    let worst = null;
    for (let i = 1; i < STAGES.length; i++) {
      const prev = totals[STAGES[i - 1].key];
      const cur = totals[STAGES[i].key];
      const dropPct = ((prev - cur) / prev) * 100;
      if (!worst || dropPct > worst.dropPct) {
        worst = { stageIndex: i, from: STAGES[i - 1].label, to: STAGES[i].label, dropPct };
      }
    }
    return worst;
  }, [totals]);

  const claimsByBucket = useMemo(() => {
    return Object.keys(BUCKET_META).map((b) => ({
      bucket: b,
      label: BUCKET_META[b].label,
      color: BUCKET_META[b].color,
      amount: sum(CLAIMS.filter((c) => c.bucket === b), "amount"),
    }));
  }, []);

  const totalClaimValue = sum(CLAIMS, "amount");
  const atRiskValue = sum(CLAIMS.filter((c) => c.bucket === "90+"), "amount");

  const stateRows = activeState === "ALL" ? STATES : STATES.filter((s) => s.code === activeState);
  const commissionRate = (
    (sum(stateRows, "commissioned") / sum(stateRows, "surveyed")) * 100
  ).toFixed(1);

  return (
    <div className="min-h-screen w-full" style={{ background: "#0F1B22", color: "#EDE6D8", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .disp { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .grain { background-image: radial-gradient(#EDE6D8 0.5px, transparent 0.5px); background-size: 18px 18px; opacity: 0.035; }
      `}</style>

      {/* Header */}
      <header className="border-b" style={{ borderColor: "#1F3038" }}>
        <div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: "#E8A93E" }}>
              <Sun size={18} color="#0F1B22" strokeWidth={2.5} />
            </div>
            <div>
              <div className="disp text-lg font-semibold tracking-tight leading-none">Pan-India Ops Command</div>
              <div className="text-xs mt-1" style={{ color: "#7FA39A" }}>PM-KUSUM Component B &amp; C · live installation &amp; claims desk</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DataSourceToggle value={dataSource} onChange={setDataSource} />
            <div className="flex items-center gap-2 text-xs mono" style={{ color: "#7FA39A" }}>
              <Activity size={14} />
              <span>8 states · {STATES.length} regional teams</span>
            </div>
          </div>
        </div>
        {dataSource === "live" && (
          <div className="max-w-6xl mx-auto px-5 pb-3">
            <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2" style={{ background: "#1A2A22", border: "1px solid #2A4A3A", color: "#8FD4B8" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#4ADE80" }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#4ADE80" }}></span>
              </span>
              Live mode — this is a preview of what the dashboard looks like once wired to the installation ERP, DISCOM claim portals, and field ticketing tool. Not yet connected; figures shown are the same illustrative set.
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">

        {/* KPI band */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Droplets size={16} />} label="Commissioned to date" value={sum(STATES, "commissioned").toLocaleString("en-IN")} sub="pumps, all states" />
          <Kpi icon={<TrendingUp size={16} />} label="Survey → Commission rate" value={`${((sum(STATES,"commissioned")/sum(STATES,"surveyed"))*100).toFixed(1)}%`} sub="pipeline efficiency" />
          <Kpi icon={<IndianRupee size={16} />} label="Subsidy claims outstanding" value={fmtCr(totalClaimValue)} sub={`across ${CLAIMS.length} state filings`} accent />
          <Kpi icon={<AlertTriangle size={16} />} label="At risk (90+ days)" value={fmtCr(atRiskValue)} sub="needs escalation" danger />
        </section>

        {/* Bottleneck callout — the signature element */}
        <section className="rounded-lg p-4 flex items-start gap-3" style={{ background: "#16262B", border: "1px solid #21393F" }}>
          <div className="mt-0.5"><AlertTriangle size={18} color="#E8A93E" /></div>
          <div>
            <div className="text-sm font-medium" style={{ color: "#E8A93E" }}>Pipeline bottleneck detected</div>
            <div className="text-sm mt-1" style={{ color: "#C9D8D3" }}>
              Largest drop-off is between <span className="mono">{bottleneck.from}</span> and <span className="mono">{bottleneck.to}</span> — a {bottleneck.dropPct.toFixed(1)}% loss in volume. This stage typically maps to DISCOM material-release delays or last-mile logistics; worth a state-wise audit before next quarter's sanction push.
            </div>
          </div>
        </section>

        {/* Installation funnel */}
        <section className="rounded-lg p-5" style={{ background: "#16262B", border: "1px solid #21393F" }}>
          <SectionHeader icon={<Truck size={16} />} title="Installation pipeline" note="stage-wise volume, all states" />
          <div className="mt-4 space-y-3">
            {STAGES.map((s, i) => {
              const val = totals[s.key];
              const max = totals.surveyed;
              const pct = (val / max) * 100;
              const isBottleneckEdge = bottleneck.stageIndex === i;
              return (
                <div key={s.key}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs" style={{ color: "#8FB0A8" }}>{s.label}</span>
                    <span className="mono text-sm">{val.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#0F1B22" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: isBottleneckEdge ? "#C1543A" : "#2FA8A0",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Subsidy claims aging */}
          <section className="rounded-lg p-5" style={{ background: "#16262B", border: "1px solid #21393F" }}>
            <SectionHeader icon={<IndianRupee size={16} />} title="Subsidy claim aging" note="₹ lakh, by days pending" />
            <div style={{ height: 220 }} className="mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimsByBucket} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21393F" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#7FA39A", fontSize: 11 }} axisLine={{ stroke: "#21393F" }} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fill: "#C9D8D3", fontSize: 11 }} axisLine={{ stroke: "#21393F" }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0F1B22", border: "1px solid #21393F", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "#EDE6D8" }}
                    formatter={(v) => [`₹${v}L`, "Outstanding"]}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {claimsByBucket.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs" style={{ color: "#7FA39A" }}>
              90+ bucket concentrated in Rajasthan &amp; UP — flag for state nodal agency follow-up.
            </div>
          </section>

          {/* Field team performance */}
          <section className="rounded-lg p-5" style={{ background: "#16262B", border: "1px solid #21393F" }}>
            <SectionHeader icon={<Wrench size={16} />} title="Field team performance" note="installs this month" />
            <div className="mt-3 space-y-2">
              {TEAMS.sort((a, b) => b.installs - a.installs).map((t) => (
                <div key={t.name} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: "1px solid #1F3038" }}>
                  <div>
                    <div style={{ color: "#EDE6D8" }}>{t.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#7FA39A" }}>{t.turnaround}d avg turnaround · {t.ftr}% first-time-right</div>
                  </div>
                  <div className="mono text-sm" style={{ color: t.ftr >= 90 ? "#2FA8A0" : t.ftr >= 80 ? "#E8A93E" : "#C1543A" }}>
                    {t.installs}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* After-sales SLA */}
        <section className="rounded-lg p-5" style={{ background: "#16262B", border: "1px solid #21393F" }}>
          <SectionHeader icon={<Clock size={16} />} title="After-sales service SLA" note="open tickets" />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 480 }}>
              <thead>
                <tr className="text-xs" style={{ color: "#7FA39A" }}>
                  <th className="text-left font-normal pb-2">Ticket</th>
                  <th className="text-left font-normal pb-2">Issue</th>
                  <th className="text-left font-normal pb-2">State</th>
                  <th className="text-left font-normal pb-2">Days open</th>
                  <th className="text-left font-normal pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {TICKETS.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #1F3038" }}>
                    <td className="py-2 mono">{t.id}</td>
                    <td className="py-2" style={{ color: "#C9D8D3" }}>{t.issue}</td>
                    <td className="py-2">{t.state}</td>
                    <td className="py-2 mono">{t.daysOpen}</td>
                    <td className="py-2">
                      <StatusPill sla={t.sla} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* State drilldown selector */}
        <section className="rounded-lg p-5" style={{ background: "#16262B", border: "1px solid #21393F" }}>
          <SectionHeader icon={<MapPin size={16} />} title="State-wise commissioning rate" note="select a state to drill down" />
          <div className="mt-3 flex flex-wrap gap-2">
            <StateChip label="All states" active={activeState === "ALL"} onClick={() => setActiveState("ALL")} />
            {STATES.map((s) => (
              <StateChip key={s.code} label={s.code} active={activeState === s.code} onClick={() => setActiveState(s.code)} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-3xl disp font-semibold" style={{ color: "#E8A93E" }}>{commissionRate}%</div>
            <div className="text-sm" style={{ color: "#8FB0A8" }}>
              {activeState === "ALL" ? "Pan-India" : STATES.find((s) => s.code === activeState)?.name} · survey-to-commission conversion
            </div>
          </div>
        </section>

        <footer className="text-xs text-center pt-2 pb-6" style={{ color: "#4C6B65" }}>
          Illustrative operational dashboard · built to demonstrate a live pan-India KUSUM ops view
        </footer>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent, danger }) {
  const color = danger ? "#C1543A" : accent ? "#E8A93E" : "#EDE6D8";
  return (
    <div className="rounded-lg p-4" style={{ background: "#16262B", border: "1px solid #21393F" }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7FA39A" }}>
        {icon}<span>{label}</span>
      </div>
      <div className="disp text-2xl font-semibold mt-2" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "#5E8079" }}>{sub}</div>
    </div>
  );
}

function SectionHeader({ icon, title, note }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span style={{ color: "#E8A93E" }}>{icon}</span>
        <span className="disp text-sm font-semibold">{title}</span>
      </div>
      <span className="text-xs" style={{ color: "#5E8079" }}>{note}</span>
    </div>
  );
}

function StatusPill({ sla }) {
  const map = {
    "on-track": { label: "On track", color: "#2FA8A0" },
    "at-risk": { label: "At risk", color: "#E8A93E" },
    "breach": { label: "SLA breach", color: "#C1543A" },
  };
  const m = map[sla];
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: `${m.color}22`, color: m.color }}>
      {sla === "on-track" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
      {m.label}
    </span>
  );
}

function DataSourceToggle({ value, onChange }) {
  return (
    <div className="flex items-center rounded-full p-0.5 text-xs" style={{ background: "#0F1B22", border: "1px solid #21393F" }}>
      {["mock", "live"].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-3 py-1 rounded-full transition-colors"
          style={{
            background: value === v ? "#E8A93E" : "transparent",
            color: value === v ? "#0F1B22" : "#7FA39A",
          }}
        >
          {v === "mock" ? "Mock data" : "Live feed (preview)"}
        </button>
      ))}
    </div>
  );
}

function StateChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full transition-colors"
      style={{
        background: active ? "#E8A93E" : "#0F1B22",
        color: active ? "#0F1B22" : "#8FB0A8",
        border: `1px solid ${active ? "#E8A93E" : "#21393F"}`,
      }}
    >
      {label}
    </button>
  );
}
