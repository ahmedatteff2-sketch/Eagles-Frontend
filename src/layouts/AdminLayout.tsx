import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const navItems = [
  { path: "/admin", label: "لوحة التحكم", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { path: "/admin/members", label: "الأعضاء", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="7" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><circle cx="19" cy="8" r="3"/><path d="M22 21v-1a5 5 0 0 0-4-4.9"/></svg> },
  { path: "/admin/subscriptions", label: "الاشتراكات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg> },
  { path: "/admin/training", label: "برامج التدريب", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 12c0-1.5 1-2 2-2M3 12c0 1.5 1 2 2 2M21 12c0-1.5-1-2-2-2M21 12c0 1.5-1 2-2 2"/><circle cx="6.5" cy="6.5" r="1.5"/><circle cx="6.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg> },
  { path: "/admin/payments", label: "المدفوعات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2M13 15h4"/></svg> },
  { path: "/admin/expenses", label: "المصاريف", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { path: "/admin/checkins", label: "الحضور", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { path: "/admin/qr-scanner", label: "مسح QR", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg> },
  { path: "/admin/schedule", label: "الجدول الأسبوعي", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { path: "/admin/analytics", label: "الإحصائيات", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { path: "/admin/exports", label: "التصدير", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
  { path: "/admin/imports", label: "الاستيراد", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, clearAuth, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout.mutate({ data: { refreshToken: refreshToken ?? "" } }, {
      onSettled: () => {
        clearAuth();
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  }

  const w = collapsed ? "w-[68px]" : "w-64";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 5%)" }} dir="rtl">
      {/* Sidebar */}
      <aside className={`${w} flex-shrink-0 flex flex-col transition-all duration-300`}
        style={{ background: "hsl(0 0% 3%)", borderLeft: "1px solid hsl(0 0% 10%)" }}>

        {/* Logo header */}
        <div className="flex items-center gap-3 px-4 py-4 relative" style={{ borderBottom: "1px solid hsl(0 0% 10%)", minHeight: 72 }}>
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, hsl(40 65% 48%), transparent)" }} />
          <Link href="/admin">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="/eagle-gym-logo.jpg" alt="Eagle Gym"
                className="flex-shrink-0 object-contain rounded-xl"
                style={{ width: 40, height: 40, background: "hsl(0 0% 7%)", boxShadow: "0 0 0 1px hsl(40 65% 48% / 0.3), 0 0 16px hsl(40 65% 48% / 0.15)" }} />
              {!collapsed && (
                <div>
                  <div className="font-black text-sm leading-tight tracking-widest uppercase" style={{ color: "hsl(40 65% 55%)" }}>Eagle Gym</div>
                  <div className="text-xs" style={{ color: "hsl(0 0% 35%)" }}>إدارة النادي</div>
                </div>
              )}
            </div>
          </Link>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="mr-auto p-1 rounded-lg transition-colors" style={{ color: "hsl(0 0% 35%)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "hsl(40 65% 52%)")}
              onMouseLeave={e => (e.currentTarget.style.color = "hsl(0 0% 35%)")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-lg"
              style={{ background: "hsl(40 65% 48%)", color: "hsl(0 0% 5%)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="w-3 h-3">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = item.path === "/admin" ? location === "/admin" : location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-sm font-medium group relative"
                  style={isActive
                    ? { background: "linear-gradient(135deg, hsl(40 65% 48% / 0.2), hsl(40 65% 48% / 0.08))", color: "hsl(40 65% 65%)", boxShadow: "inset 0 0 0 1px hsl(40 65% 48% / 0.25)" }
                    : { color: "hsl(0 0% 50%)" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "hsl(0 0% 8%)"; e.currentTarget.style.color = "hsl(0 0% 80%)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 50%)"; } }}>
                  {/* Active gold bar */}
                  {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: "hsl(40 65% 52%)" }} />}
                  <span style={{ color: isActive ? "hsl(40 65% 58%)" : "hsl(0 0% 38%)" }} className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {collapsed && (
                    <div className="absolute left-full mr-3 px-2.5 py-1.5 rounded-lg text-xs font-semibold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                      style={{ background: "hsl(0 0% 12%)", color: "hsl(40 65% 58%)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "1px solid hsl(0 0% 18%)" }}>
                      {item.label}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3" style={{ borderTop: "1px solid hsl(0 0% 10%)" }}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl" style={{ background: "hsl(0 0% 7%)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
                {user?.name?.[0] ?? "A"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "hsl(40 20% 80%)" }}>{user?.name}</p>
                <p className="text-xs" style={{ color: "hsl(40 65% 45%)" }}>مسؤول</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: "linear-gradient(135deg, hsl(40 65% 32%), hsl(40 65% 22%))", color: "hsl(40 65% 68%)", border: "1.5px solid hsl(40 65% 40% / 0.4)" }}>
                {user?.name?.[0] ?? "A"}
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className={`${collapsed ? "justify-center" : ""} w-full text-xs py-2 px-3 rounded-xl transition-all duration-150 flex items-center gap-2`}
            style={{ color: "hsl(0 0% 38%)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(0 72% 51% / 0.1)"; e.currentTarget.style.color = "hsl(0 72% 60%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(0 0% 38%)"; }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!collapsed && "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" dir="rtl">
        {children}
      </main>
    </div>
  );
}
