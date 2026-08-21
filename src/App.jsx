import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Sun, Droplets, Truck, Wrench, IndianRupee, MapPin, Clock,
  CheckCircle2, AlertTriangle, TrendingUp, Activity, RefreshCw,
  Download, Bell, Wifi, WifiOff,
} from "lucide-react";

// ── Environment / Supabase config ─────────────────────────────────────────────
const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  ?? "";
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const HAS_SUPA  = Boolean(SUPA_URL && SUPA_KEY);

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_STATES = [
  { code:"MH", name:"Maharashtra",     surveyed:4200, sanctioned:3850, dispatched:3400, installed:3100, commissioned:2890 },
  { code:"HR", name:"Haryana",         surveyed:3100, sanctioned:2900, dispatched:2600, installed:2450, commissioned:2380 },
  { code:"RJ", name:"Rajasthan",       surveyed:2600, sanctioned:2300, dispatched:1850, installed:1600, commissioned:1420 },
  { code:"MP", name:"Madhya Pradesh",  surveyed:2100, sanctioned:1950, dispatched:1500, installed:1180, commissioned:980  },
  { code:"UP", name:"Uttar Pradesh",   surveyed:1800, sanctioned:1600, dispatched:1100, installed:780,  commissioned:610  },
  { code:"GJ", name:"Gujarat",         surveyed:1500, sanctioned:1420, dispatched:1300, installed:1240, commissioned:1190 },
  { code:"PB", name:"Punjab",          surveyed:950,  sanctioned:880,  dispatched:640,  installed:510,  commissioned:430  },
  { code:"CG", name:"Chhattisgarh",    surveyed:780,  sanctioned:710,  dispatched:580,  installed:490,  commissioned:440  },
];

const MOCK_CLAIMS = [
  { state:"MH", component:"B", amount:412, bucket:"0-30"  },
  { state:"MH", component:"C", amount:138, bucket:"31-60" },
  { state:"HR", component:"B", amount:286, bucket:"0-30"  },
  { state:"HR", component:"C", amount:94,  bucket:"61-90" },
  { state:"RJ", component:"B", amount:221, bucket:"31-60" },
  { state:"RJ", component:"C", amount:176, bucket:"90+"   },
  { state:"MP", component:"B", amount:167, bucket:"61-90" },
  { state:"UP", component:"B", amount:143, bucket:"90+"   },
  { state:"GJ", component:"C", amount:118, bucket:"0-30"  },
  { state:"PB", component:"B", amount:76,  bucket:"31-60" },
  { state:"CG", component:"B", amount:58,  bucket:"0-30"  },
];

const MOCK_TEAMS = [
  { name:"Field Team — Nagpur",  state:"MH", installs:118, turnaround:6.2,  ftr:94 },
  { name:"Field Team — Panipat", state:"HR", installs:96,  turnaround:5.4,  ftr:97 },
  { name:"Field Team — Jodhpur", state:"RJ", installs:74,  turnaround:8.1,  ftr:86 },
  { name:"Field Team — Bhopal",  state:"MP", installs:51,  turnaround:9.6,  ftr:81 },
  { name:"Field Team — Lucknow", state:"UP", installs:33,  turnaround:11.3, ftr:74 },
  { name:"Field Team — Rajkot",  state:"GJ", installs:62,  turnaround:6.8,  ftr:92 },
];

const MOCK_TICKETS = [
  { id:"SR-4471", issue:"Controller fault",        state:"MH", daysOpen:2,  sla:"on-track" },
  { id:"SR-4488", issue:"Motor underperformance",  state:"RJ", daysOpen:9,  sla:"breach"   },
  { id:"SR-4502", issue:"Panel misalignment",      state:"HR", daysOpen:1,  sla:"on-track" },
  { id:"SR-4517", issue:"Pump priming issue",      state:"UP", daysOpen:12, sla:"breach"   },
  { id:"SR-4529", issue:"Wiring damage",           state:"MP", daysOpen:4,  sla:"at-risk"  },
  { id:"SR-4533", issue:"Structure corrosion",     state:"GJ", daysOpen:3,  sla:"on-track" },
];

const BUCKET_META = {
  "0-30":  { label:"0–30 days",          color:"#2FA8A0" },
  "31-60": { label:"31–60 days",         color:"#E8A93E" },
  "61-90": { label:"61–90 days",         color:"#D97D3C" },
  "90+":   { label:"90+ days — at risk", color:"#C1543A" },
};

const STAGES = [
  { key:"surveyed",     label:"Site Surveyed"       },
  { key:"sanctioned",   label:"Subsidy Sanctioned"  },
  { key:"dispatched",   label:"Material Dispatched" },
  { key:"installed",    label:"Installed"           },
  { key:"commissioned", label:"Commissioned"        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function sum(arr, key) { return arr.reduce((a, r) => a + (r[key] ?? 0), 0); }
function fmtCr(n)      { return `₹${n}L`; }

function generateTrends(states) {
  const total = sum(states, "commissioned");
  const weeklyGain = 320;
  return Array.from({ length: 8 }, (_, i) => {
    const weeksBack = 7 - i;
    const commissioned = Math.max(0, Math.round(total - weeklyGain * weeksBack));
    return {
      week:         `W${i + 1}`,
      date:         new Date(Date.now() - weeksBack * 7 * 86400000)
                      .toLocaleDateString("en-IN", { day:"numeric", month:"short" }),
      commissioned,
      installed:    Math.round(commissioned / 0.93),
    };
  });
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(","),
    ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(",")),
  ].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type:"text/csv" })),
    download: filename,
  });
  a.click();
}

// ── Supabase loader ───────────────────────────────────────────────────────────
async function loadFromSupabase(client) {
  const [s, c, t, tk] = await Promise.all([
    client.from("kusum_states").select("*"),
    client.from("kusum_claims").select("*"),
    client.from("kusum_teams").select("*"),
    client.from("kusum_tickets").select("*"),
  ]);
  if (s.error) throw new Error(s.error.message);
  return { states: s.data, claims: c.data ?? [], teams: t.data ?? [], tickets: tk.data ?? [] };
}

// ── App ───────────────────────────────────────────────────────────────────────
const REFRESH_SECS = 300; // 5 min

export default function KusumOpsDashboard() {
  const [dataSource,   setDataSource]   = useState("mock");
  const [data,         setData]         = useState({ states:MOCK_STATES, claims:MOCK_CLAIMS, teams:MOCK_TEAMS, tickets:MOCK_TICKETS });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [countdown,    setCountdown]    = useState(REFRESH_SECS);
  const [now,          setNow]          = useState(new Date());
  const [activeState,  setActiveState]  = useState("ALL");
  const [showNotifs,   setShowNotifs]   = useState(false);
  const supaRef = useRef(null);

  // ── Live clock ──
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Lazy-load Supabase client ──
  useEffect(() => {
    if (!HAS_SUPA) return;
    import("@supabase/supabase-js").then(({ createClient }) => {
      supaRef.current = createClient(SUPA_URL, SUPA_KEY);
    });
  }, []);

  // ── Fetch from Supabase ──
  const fetchData = useCallback(async () => {
    if (!supaRef.current) return;
    setLoading(true); setError(null);
    try {
      const fresh = await loadFromSupabase(supaRef.current);
      setData(fresh);
      setLastRefresh(new Date());
      setCountdown(REFRESH_SECS);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Switch source ──
  useEffect(() => {
    if (dataSource === "live") {
      if (HAS_SUPA) fetchData();
    } else {
      setData({ states:MOCK_STATES, claims:MOCK_CLAIMS, teams:MOCK_TEAMS, tickets:MOCK_TICKETS });
      setError(null);
      setCountdown(REFRESH_SECS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  // ── Auto-refresh countdown ──
  useEffect(() => {
    if (dataSource !== "live") return;
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return REFRESH_SECS; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [dataSource, fetchData]);

  // ── Supabase Realtime ──
  useEffect(() => {
    if (!supaRef.current || dataSource !== "live") return;
    const ch = supaRef.current.channel("kusum-rt")
      .on("postgres_changes", { event:"*", schema:"public", table:"kusum_states"  }, fetchData)
      .on("postgres_changes", { event:"*", schema:"public", table:"kusum_tickets" }, fetchData)
      .subscribe();
    return () => supaRef.current?.removeChannel(ch);
  }, [dataSource, fetchData]);

  // ── Derived ──
  const { states, claims, teams, tickets } = data;
  const trends  = useMemo(() => generateTrends(states), [states]);

  const totals  = useMemo(() => {
    const t = {};
    STAGES.forEach(s => { t[s.key] = sum(states, s.key); });
    return t;
  }, [states]);

  const bottleneck = useMemo(() => {
    let worst = null;
    for (let i = 1; i < STAGES.length; i++) {
      const prev = totals[STAGES[i - 1].key];
      const cur  = totals[STAGES[i].key];
      const drop = ((prev - cur) / prev) * 100;
      if (!worst || drop > worst.dropPct) worst = { stageIndex:i, from:STAGES[i-1].label, to:STAGES[i].label, dropPct:drop };
    }
    return worst;
  }, [totals]);

  const claimsByBucket = useMemo(() =>
    Object.keys(BUCKET_META).map(b => ({
      bucket:b, label:BUCKET_META[b].label, color:BUCKET_META[b].color,
      amount:sum(claims.filter(c => c.bucket === b), "amount"),
    })), [claims]);

  const totalClaims  = sum(claims, "amount");
  const atRisk       = sum(claims.filter(c => c.bucket === "90+"), "amount");
  const stateRows    = activeState === "ALL" ? states : states.filter(s => s.code === activeState);
  const commRate     = ((sum(stateRows,"commissioned") / sum(stateRows,"surveyed")) * 100).toFixed(1);
  const breaches     = tickets.filter(t => t.sla === "breach");
  const atRiskTix    = tickets.filter(t => t.sla === "at-risk");
  const isLive       = dataSource === "live";
  const isConnected  = isLive && HAS_SUPA && !error;
  const mm           = Math.floor(countdown / 60);
  const ss           = String(countdown % 60).padStart(2, "0");

  return (
    <div className="min-h-screen w-full" style={{ background:"#0F1B22", color:"#EDE6D8", fontFamily:"'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .disp { font-family:'Space Grotesk',sans-serif; }
        .mono { font-family:'IBM Plex Mono',monospace; }
        @keyframes pr { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
        .pr { animation: pr 1.5s ease-out infinite; }
        @keyframes sp { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .sp { animation: sp 1s linear infinite; }
        button { cursor:pointer; }
        * { box-sizing:border-box; }
      `}</style>

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor:"#1F3038", position:"sticky", top:0, zIndex:50, background:"#0F1B22" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background:"#E8A93E" }}>
              <Sun size={18} color="#0F1B22" strokeWidth={2.5} />
            </div>
            <div>
              <div className="disp text-base font-semibold tracking-tight leading-none">Pan-India Ops Command</div>
              <div className="text-xs mt-0.5" style={{ color:"#7FA39A" }}>PM-KUSUM Component B & C · installation & claims desk</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live clock */}
            <div className="mono text-xs px-2" style={{ color:"#5E8079" }}>
              {now.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
              {" · "}
              {now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}
            </div>

            {/* Notifications bell */}
            <button
              onClick={() => setShowNotifs(n => !n)}
              style={{
                position:"relative", display:"flex", alignItems:"center", gap:6,
                padding:"6px 10px", borderRadius:6, fontSize:12,
                background: showNotifs ? "#1F3038" : "transparent",
                border:"1px solid #21393F",
                color: breaches.length ? "#C1543A" : "#7FA39A",
              }}
            >
              <Bell size={13} />
              {breaches.length > 0 && (
                <span style={{
                  position:"absolute", top:-6, right:-6,
                  width:16, height:16, borderRadius:"50%", fontSize:9,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background:"#C1543A", color:"#FFF", fontFamily:"monospace",
                }}>{breaches.length}</span>
              )}
            </button>

            {/* Source toggle */}
            <div style={{ display:"flex", alignItems:"center", borderRadius:20, padding:2, background:"#0F1B22", border:"1px solid #21393F" }}>
              {["mock","live"].map(v => (
                <button key={v} onClick={() => setDataSource(v)} style={{
                  padding:"4px 12px", borderRadius:20, fontSize:11, border:"none",
                  background: dataSource === v ? "#E8A93E" : "transparent",
                  color:      dataSource === v ? "#0F1B22"  : "#7FA39A",
                  transition:"background 0.2s",
                }}>
                  {v === "mock" ? "Mock" : HAS_SUPA ? "Live ●" : "Live ○"}
                </button>
              ))}
            </div>

            {/* Refresh / countdown */}
            {isLive && (
              <button onClick={fetchData} disabled={loading} style={{
                display:"flex", alignItems:"center", gap:5, padding:"6px 10px",
                borderRadius:6, fontSize:11, border:"1px solid #21393F",
                background:"transparent", color:"#7FA39A",
              }}>
                <RefreshCw size={12} className={loading ? "sp" : ""} />
                {loading ? "…" : `${mm}:${ss}`}
              </button>
            )}

            {/* Connection pill */}
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11,
              color: isLive ? (isConnected ? "#2FA8A0" : "#C1543A") : "#5E8079" }}>
              {isLive ? (isConnected ? <Wifi size={13}/> : <WifiOff size={13}/>) : <Activity size={13}/>}
              {isLive ? (isConnected ? "Live" : "Error") : "Mock data"}
            </div>
          </div>
        </div>

        {/* Notification dropdown */}
        {showNotifs && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div className="rounded-lg p-3" style={{ background:"#16262B", border:"1px solid #21393F" }}>
              <div className="text-xs font-medium mb-2" style={{ color:"#E8A93E" }}>
                SLA Alerts · {breaches.length} breach · {atRiskTix.length} at-risk
              </div>
              {[...breaches, ...atRiskTix].length === 0 ? (
                <div className="text-xs" style={{ color:"#5E8079" }}>All tickets on track ✓</div>
              ) : (
                <div className="space-y-1.5">
                  {[...breaches, ...atRiskTix].map(t => (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12,
                      color: t.sla === "breach" ? "#C1543A" : "#E8A93E" }}>
                      <AlertTriangle size={11}/>
                      <span className="mono">{t.id}</span>
                      <span style={{ color:"#C9D8D3" }}>{t.issue}</span>
                      <span style={{ color:"#5E8079" }}>· {t.state} · {t.daysOpen}d open</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live status banners */}
        {isLive && !error && !loading && HAS_SUPA && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
              style={{ background:"#1A2A22", border:"1px solid #2A4A3A", color:"#8FD4B8" }}>
              <span style={{ position:"relative", display:"inline-flex", width:8, height:8 }}>
                <span className="pr" style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#4ADE80" }}/>
                <span style={{ position:"relative", display:"inline-flex", width:8, height:8, borderRadius:"50%", background:"#4ADE80" }}/>
              </span>
              Connected to Supabase realtime · last synced {lastRefresh.toLocaleTimeString("en-IN",{hour12:false})} · auto-refresh in {mm}:{ss}
            </div>
          </div>
        )}
        {isLive && !HAS_SUPA && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div className="rounded-md px-3 py-2 text-xs"
              style={{ background:"#1A1A2A", border:"1px solid #2A2A4A", color:"#8F8FD4" }}>
              ℹ Add <span className="mono">VITE_SUPABASE_URL</span> & <span className="mono">VITE_SUPABASE_ANON_KEY</span> in Vercel → Project Settings → Environment Variables to connect live data.
            </div>
          </div>
        )}
        {error && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <div className="rounded-md px-3 py-2 text-xs"
              style={{ background:"#2A1010", border:"1px solid #4A2020", color:"#E87070" }}>
              ⚠ Supabase error: {error} — check your env vars or RLS policies.
            </div>
          </div>
        )}
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* KPI band */}
        <section style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}
          className="md:grid-cols-4">
          <Kpi icon={<Droplets size={16}/>}     label="Commissioned to date"
               value={sum(states,"commissioned").toLocaleString("en-IN")} sub="pumps, all states"
               trend="+320 this week" trendUp />
          <Kpi icon={<TrendingUp size={16}/>}   label="Survey → Commission"
               value={`${((sum(states,"commissioned")/sum(states,"surveyed"))*100).toFixed(1)}%`}
               sub="pipeline efficiency" trend="+0.4% vs last month" trendUp />
          <Kpi icon={<IndianRupee size={16}/>}  label="Claims outstanding"
               value={fmtCr(totalClaims)} sub={`${claims.length} state filings`}
               accent trend={`${fmtCr(atRisk)} at-risk`} />
          <Kpi icon={<AlertTriangle size={16}/>} label="SLA breaches"
               value={breaches.length} sub={`${atRiskTix.length} at-risk · ${tickets.length} open`}
               danger trend="Needs escalation" />
        </section>

        {/* Bottleneck callout */}
        {bottleneck && (
          <section className="rounded-lg p-4 flex items-start gap-3"
            style={{ background:"#16262B", border:"1px solid #21393F" }}>
            <div style={{ marginTop:2 }}><AlertTriangle size={18} color="#E8A93E"/></div>
            <div>
              <div className="text-sm font-medium" style={{ color:"#E8A93E" }}>Pipeline bottleneck detected</div>
              <div className="text-sm mt-1" style={{ color:"#C9D8D3" }}>
                Largest drop-off between <span className="mono">{bottleneck.from}</span> → <span className="mono">{bottleneck.to}</span> — a {bottleneck.dropPct.toFixed(1)}% volume loss.
                Typically maps to DISCOM material-release delays or last-mile logistics; worth a state-wise audit before next quarter's sanction push.
              </div>
            </div>
          </section>
        )}

        {/* Trend chart + Pipeline funnel */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:24 }} className="md:grid-cols-2">

          {/* 8-week trend */}
          <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <SectionHeader icon={<TrendingUp size={16}/>} title="8-week commissioning trend" note="weekly pace" />
              <ExportBtn onClick={() => exportCSV(trends, "kusum_trends.csv")} />
            </div>
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21393F" />
                  <XAxis dataKey="week" tick={{ fill:"#7FA39A", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                  <YAxis tick={{ fill:"#7FA39A", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                  <Tooltip contentStyle={{ background:"#0F1B22", border:"1px solid #21393F", borderRadius:6, fontSize:12 }}
                    labelStyle={{ color:"#EDE6D8" }} />
                  <Line type="monotone" dataKey="commissioned" stroke="#2FA8A0" strokeWidth={2}
                    dot={{ fill:"#2FA8A0", r:3 }} name="Commissioned" />
                  <Line type="monotone" dataKey="installed" stroke="#E8A93E" strokeWidth={2}
                    dot={{ fill:"#E8A93E", r:3 }} strokeDasharray="4 2" name="Installed" />
                  <Legend wrapperStyle={{ fontSize:11, color:"#7FA39A" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Installation funnel */}
          <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <SectionHeader icon={<Truck size={16}/>} title="Installation pipeline" note="stage-wise volume" />
              <ExportBtn onClick={() => exportCSV(STAGES.map(s=>({ stage:s.label, count:totals[s.key] })), "kusum_pipeline.csv")} />
            </div>
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const val = totals[s.key];
                const pct = (val / totals.surveyed) * 100;
                const isBot = bottleneck?.stageIndex === i;
                return (
                  <div key={s.key}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"#8FB0A8" }}>{s.label}</span>
                      <span className="mono" style={{ fontSize:13 }}>{val.toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ height:10, borderRadius:5, overflow:"hidden", background:"#0F1B22" }}>
                      <div style={{
                        height:"100%", borderRadius:5, transition:"width 0.6s ease",
                        width:`${pct}%`, background: isBot ? "#C1543A" : "#2FA8A0",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Claims aging + Field teams */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:24 }} className="md:grid-cols-2">

          {/* Claims aging bar chart */}
          <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <SectionHeader icon={<IndianRupee size={16}/>} title="Subsidy claim aging" note="₹ lakh · days pending" />
              <ExportBtn onClick={() => exportCSV(claims, "kusum_claims.csv")} />
            </div>
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimsByBucket} layout="vertical" margin={{ left:0, right:12, top:4, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21393F" horizontal={false} />
                  <XAxis type="number" tick={{ fill:"#7FA39A", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={112} tick={{ fill:"#C9D8D3", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                  <Tooltip contentStyle={{ background:"#0F1B22", border:"1px solid #21393F", borderRadius:6, fontSize:12 }}
                    labelStyle={{ color:"#EDE6D8" }} formatter={v => [`₹${v}L`, "Outstanding"]} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {claimsByBucket.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize:11, color:"#7FA39A", marginTop:8 }}>
              90+ bucket concentrated in Rajasthan & UP — flag for state nodal agency follow-up.
            </div>
          </section>

          {/* Field team performance */}
          <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <SectionHeader icon={<Wrench size={16}/>} title="Field team performance" note="installs this month" />
              <ExportBtn onClick={() => exportCSV(teams, "kusum_teams.csv")} />
            </div>
            <div className="space-y-1">
              {[...teams].sort((a,b) => b.installs - a.installs).map(t => {
                const col = t.ftr >= 90 ? "#2FA8A0" : t.ftr >= 80 ? "#E8A93E" : "#C1543A";
                return (
                  <div key={t.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1F3038" }}>
                    <div>
                      <div style={{ color:"#EDE6D8", fontSize:13 }}>{t.name}</div>
                      <div style={{ color:"#7FA39A", fontSize:11, marginTop:2 }}>
                        {t.turnaround}d avg · {t.ftr}% FTR
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div className="mono" style={{ color:col, fontSize:14 }}>{t.installs}</div>
                      <div style={{ width:56, height:4, borderRadius:2, background:"#0F1B22", marginTop:4 }}>
                        <div style={{ width:`${t.ftr}%`, height:"100%", borderRadius:2, background:col }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* SLA tickets table */}
        <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <SectionHeader icon={<Clock size={16}/>} title="After-sales SLA tracker" note={`${tickets.length} open tickets`} />
            <ExportBtn onClick={() => exportCSV(tickets, "kusum_tickets.csv")} />
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", fontSize:13, minWidth:480 }}>
              <thead>
                <tr style={{ color:"#7FA39A", fontSize:11 }}>
                  {["Ticket","Issue","State","Days open","Status"].map(h => (
                    <th key={h} style={{ textAlign:"left", fontWeight:400, paddingBottom:8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...tickets].sort((a,b) => b.daysOpen - a.daysOpen).map(t => (
                  <tr key={t.id} style={{ borderTop:"1px solid #1F3038" }}>
                    <td className="mono" style={{ padding:"8px 0" }}>{t.id}</td>
                    <td style={{ padding:"8px 8px 8px 0", color:"#C9D8D3" }}>{t.issue}</td>
                    <td style={{ padding:"8px 8px 8px 0" }}>{t.state}</td>
                    <td className="mono" style={{ padding:"8px 8px 8px 0" }}>{t.daysOpen}</td>
                    <td style={{ padding:"8px 0" }}><StatusPill sla={t.sla} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* State drill-down */}
        <section className="rounded-lg p-5" style={{ background:"#16262B", border:"1px solid #21393F" }}>
          <div style={{ marginBottom:12 }}>
            <SectionHeader icon={<MapPin size={16}/>} title="State-wise commissioning" note="select a state to drill down" />
          </div>
          {/* Chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
            <StateChip label="All states" active={activeState === "ALL"} onClick={() => setActiveState("ALL")} />
            {states.map(s => (
              <StateChip key={s.code} label={s.code} active={activeState === s.code} onClick={() => setActiveState(s.code)} />
            ))}
          </div>
          {/* Big number */}
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
            <div className="disp" style={{ fontSize:36, fontWeight:600, color:"#E8A93E" }}>{commRate}%</div>
            <div style={{ fontSize:13, color:"#8FB0A8" }}>
              {activeState === "ALL" ? "Pan-India" : states.find(s => s.code === activeState)?.name} · survey-to-commission rate
            </div>
          </div>
          {/* Grouped bar chart */}
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stateRows.map(s => ({ name:s.code, Surveyed:s.surveyed, Installed:s.installed, Commissioned:s.commissioned }))}
                margin={{ left:-10, right:8, top:4, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21393F" />
                <XAxis dataKey="name" tick={{ fill:"#7FA39A", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                <YAxis tick={{ fill:"#7FA39A", fontSize:11 }} axisLine={{ stroke:"#21393F" }} tickLine={false} />
                <Tooltip contentStyle={{ background:"#0F1B22", border:"1px solid #21393F", borderRadius:6, fontSize:12 }}
                  labelStyle={{ color:"#EDE6D8" }} />
                <Bar dataKey="Surveyed"     fill="#1F3038" radius={[3,3,0,0]} />
                <Bar dataKey="Installed"    fill="#E8A93E" radius={[3,3,0,0]} />
                <Bar dataKey="Commissioned" fill="#2FA8A0" radius={[3,3,0,0]} />
                <Legend wrapperStyle={{ fontSize:11, color:"#7FA39A" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <footer style={{ fontSize:11, textAlign:"center", paddingTop:8, paddingBottom:32, color:"#4C6B65" }}>
          PM-KUSUM Ops Command · {isConnected ? "live data via Supabase realtime" : "illustrative mock data"} · last refreshed {lastRefresh.toLocaleTimeString("en-IN",{hour12:false})}
        </footer>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Kpi({ icon, label, value, sub, accent, danger, trend, trendUp }) {
  const color = danger ? "#C1543A" : accent ? "#E8A93E" : "#EDE6D8";
  return (
    <div className="rounded-lg p-4" style={{ background:"#16262B", border:"1px solid #21393F" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#7FA39A" }}>{icon}<span>{label}</span></div>
      <div className="disp" style={{ fontSize:26, fontWeight:600, marginTop:8, color }}>{value}</div>
      <div style={{ fontSize:11, marginTop:2, color:"#5E8079" }}>{sub}</div>
      {trend && (
        <div style={{ fontSize:11, marginTop:6, display:"flex", alignItems:"center", gap:4,
          color: trendUp ? "#2FA8A0" : "#E8A93E" }}>
          {trendUp ? <TrendingUp size={10}/> : <AlertTriangle size={10}/>}
          {trend}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, note }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color:"#E8A93E" }}>{icon}</span>
      <span className="disp" style={{ fontSize:13, fontWeight:600 }}>{title}</span>
      {note && <span style={{ fontSize:11, color:"#5E8079" }}>· {note}</span>}
    </div>
  );
}

function ExportBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:4, padding:"4px 8px",
      borderRadius:5, fontSize:11, border:"1px solid #21393F",
      background:"transparent", color:"#5E8079",
    }}>
      <Download size={11}/> CSV
    </button>
  );
}

function StatusPill({ sla }) {
  const m = { "on-track":{ label:"On track", color:"#2FA8A0" }, "at-risk":{ label:"At risk", color:"#E8A93E" }, "breach":{ label:"SLA breach", color:"#C1543A" } }[sla] ?? { label:sla, color:"#5E8079" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, padding:"2px 8px",
      borderRadius:20, background:`${m.color}22`, color:m.color }}>
      {sla === "on-track" ? <CheckCircle2 size={11}/> : <AlertTriangle size={11}/>}{m.label}
    </span>
  );
}

function StateChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:"5px 12px", borderRadius:20,
      background: active ? "#E8A93E" : "#0F1B22",
      color:      active ? "#0F1B22"  : "#8FB0A8",
      border:`1px solid ${active ? "#E8A93E" : "#21393F"}`,
      transition:"background 0.15s",
    }}>
      {label}
    </button>
  );
}
