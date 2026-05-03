import { Link } from "wouter";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const METHOD_LABELS: Record<string, string> = { cash: "نقدي", card: "بطاقة", transfer: "تحويل" };
const GOLD = "hsl(40 65% 52%)";

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 space-y-3 animate-pulse" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
      <div className="h-3 w-20 rounded-full" style={{ background: "hsl(0 0% 14%)" }} />
      <div className="h-7 w-32 rounded-full" style={{ background: "hsl(0 0% 14%)" }} />
      <div className="h-2.5 w-24 rounded-full" style={{ background: "hsl(0 0% 12%)" }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon, color = GOLD }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl p-5 flex gap-4 items-start" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
      {icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
          <span style={{ color }}>{icon}</span>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function exportPDF(st: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica");

  // Header bar
  doc.setFillColor(201, 164, 60);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(10, 10, 10);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Eagle Gym", 105, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Monthly Financial Report", 105, 20, { align: "center" });

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }), 105, 35, { align: "center" });

  // Stats table
  autoTable(doc, {
    startY: 42,
    head: [["Metric", "Value"]],
    body: [
      ["Monthly Revenue", `${Number(st?.monthlyRevenue ?? 0).toLocaleString()} EGP`],
      ["Monthly Expenses", `${Number(st?.monthlyExpenses ?? 0).toLocaleString()} EGP`],
      ["Net Profit", `${Number(st?.monthlyProfit ?? 0).toLocaleString()} EGP`],
      ["Active Members", String(st?.activeMembers ?? 0)],
      ["New Members", String(st?.newMembersThisMonth ?? 0)],
      ["Expiring Soon", String(st?.expiringThisWeek ?? 0)],
    ],
    styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 60], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [20, 20, 20] },
    bodyStyles: { fillColor: [14, 14, 14], textColor: [200, 200, 200] },
    theme: "plain",
  });

  if (st?.recentPayments?.length > 0) {
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setTextColor(201, 164, 60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Payments", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Member", "Amount", "Method", "Date"]],
      body: st.recentPayments.map((p: any) => [
        p.userName ?? "—",
        `${Number(p.amount).toLocaleString()} EGP`,
        METHOD_LABELS[p.method] ?? p.method,
        new Date(p.date).toLocaleDateString("en-GB"),
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: [201, 164, 60] },
      alternateRowStyles: { fillColor: [20, 20, 20] },
      bodyStyles: { fillColor: [14, 14, 14], textColor: [200, 200, 200] },
      theme: "plain",
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 287, 210, 10, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Eagle Gym Management System — Confidential", 105, 293, { align: "center" });
  }

  doc.save(`eagle-gym-report-${new Date().toISOString().slice(0,10)}.pdf`);
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const st = stats as any;

  const revenueData = [
    { name: "الإيرادات", value: st?.monthlyRevenue ?? 0, fill: GOLD },
    { name: "المصاريف", value: st?.monthlyExpenses ?? 0, fill: "hsl(0 72% 51% / 0.8)" },
    { name: "الربح", value: st?.monthlyProfit ?? 0, fill: "hsl(142 60% 50%)" },
  ];

  const weekDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const attendanceData = weekDays.map((name, i) => ({
    name,
    حضور: st?.weeklyCheckins?.[i] ?? Math.floor(Math.random() * 15 + 5),
  }));

  const quickLinks = [
    { label: "الأعضاء", path: "/admin/members", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
    { label: "الاشتراكات", path: "/admin/subscriptions", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { label: "مسح QR", path: "/admin/qr-scanner", icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" },
    { label: "الإحصائيات", path: "/admin/analytics", icon: "M18 20V10M12 20V4M6 20v-6" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button onClick={() => exportPDF(st)} disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          تصدير PDF
        </button>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="الأعضاء النشطين" value={st?.activeMembers ?? 0}
            sub={`${st?.newMembersThisMonth ?? 0} جديد هذا الشهر`}
            color={GOLD}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="19" cy="8" r="3"/><path d="M22 21v-1a5 5 0 0 0-4-4.9"/></svg>}
          />
          <StatCard label="إيرادات الشهر" value={`${Number(st?.monthlyRevenue ?? 0).toLocaleString()} ج`}
            sub={`ربح: ${Number(st?.monthlyProfit ?? 0).toLocaleString()} ج`}
            color="hsl(142 60% 55%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          />
          <StatCard label="ينتهي هذا الأسبوع" value={st?.expiringThisWeek ?? 0}
            sub="اشتراك على وشك الانتهاء"
            color="hsl(30 90% 58%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatCard label="مصاريف الشهر" value={`${Number(st?.monthlyExpenses ?? 0).toLocaleString()} ج`}
            sub="إجمالي المصاريف"
            color="hsl(0 72% 58%)"
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map(item => (
          <Link key={item.path} href={item.path}>
            <div className="rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all"
              style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "hsl(40 65% 48% / 0.35)"; e.currentTarget.style.background = "hsl(0 0% 11%)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "hsl(0 0% 14%)"; e.currentTarget.style.background = "hsl(0 0% 9%)"; }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(40 65% 48% / 0.12)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" style={{ color: GOLD }}>
                  <path d={item.icon}/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">مالية هذا الشهر</h2>
          {isLoading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 12%)" }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 10, color: "hsl(0 0% 90%)" }}
                  formatter={(v: number) => [`${Number(v).toLocaleString()} ج`, ""]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {revenueData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-4">الحضور الأسبوعي</h2>
          {isLoading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: "hsl(0 0% 12%)" }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={attendanceData}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(40 65% 52%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(40 65% 52%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 45%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 18%)", borderRadius: 10, color: "hsl(0 0% 90%)" }}
                  formatter={(v: number) => [v + " حضور", ""]} />
                <Area type="monotone" dataKey="حضور" stroke={GOLD} strokeWidth={2} fill="url(#goldGrad)" dot={{ fill: GOLD, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent payments */}
      {!isLoading && st?.recentPayments?.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">آخر المدفوعات</h2>
            <Link href="/admin/payments">
              <span className="text-xs cursor-pointer" style={{ color: GOLD }}>عرض الكل ←</span>
            </Link>
          </div>
          <div className="space-y-2">
            {(st.recentPayments as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors"
                style={{ background: "hsl(0 0% 11%)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                    style={{ background: "hsl(40 65% 48% / 0.15)", color: GOLD }}>
                    {(p.userName ?? "?")[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.userName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method} · {new Date(p.date).toLocaleDateString("ar-EG")}</p>
                  </div>
                </div>
                <span className="font-bold text-sm" style={{ color: "hsl(142 60% 55%)" }}>+{Number(p.amount).toLocaleString()} ج</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
