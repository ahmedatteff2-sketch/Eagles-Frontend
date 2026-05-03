import { useState, useRef, useEffect, useCallback } from "react";
import {
  useListCheckins, useCreateCheckin, useListUsers,
  getListCheckinsQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Tab = "scan" | "log";

// ─── Skeleton row ─────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl animate-pulse"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 14%)" }}>
      <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: "hsl(0 0% 15%)" }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-full w-28" style={{ background: "hsl(0 0% 15%)" }} />
        <div className="h-2.5 rounded-full w-20" style={{ background: "hsl(0 0% 13%)" }} />
      </div>
      <div className="h-6 w-24 rounded-full" style={{ background: "hsl(0 0% 15%)" }} />
    </div>
  );
}

// ─── QR Scanner sub-component ────────────────────────
function QRScannerTab() {
  const { toast } = useToast();
  const [manualId, setManualId] = useState("");
  const [lastCheckin, setLastCheckin] = useState<{ name: string; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [flash, setFlash] = useState(false);
  const [scanStatus, setScanStatus] = useState("جاهز للمسح...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const jsQRRef = useRef<any>(null);

  const { data: usersData } = useListUsers({ limit: 500 }, { query: { queryKey: getListUsersQueryKey({ limit: 500 }) } });
  const users: any[] = (usersData as any)?.data ?? (Array.isArray(usersData) ? usersData : []);

  useEffect(() => { import("jsqr").then(m => { jsQRRef.current = m.default; }); }, []);

  const doCheckin = useCallback(async (userId: number, userName: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date: today }),
      });
      if (res.ok) {
        setLastCheckin({ name: userName, time: new Date().toLocaleTimeString("ar-EG") });
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
        toast({ title: `✅ تم تسجيل حضور ${userName}` });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.message ?? "فشل تسجيل الحضور", variant: "destructive" });
      }
    } catch { toast({ title: "خطأ في الاتصال بالسيرفر", variant: "destructive" }); }
    setLoading(false);
  }, [loading, toast]);

  const processQR = useCallback((raw: string) => {
    const now = Date.now();
    if (raw === lastCodeRef.current.code && now - lastCodeRef.current.time < 3000) return;
    lastCodeRef.current = { code: raw, time: now };
    setScanStatus("✅ تم اكتشاف QR");
    try {
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.type === "gym-checkin") {
        const user = users.find((u: any) => u.id === parsed.userId);
        doCheckin(parsed.userId, parsed.name ?? user?.name ?? "#" + parsed.userId);
        return;
      }
    } catch { }
    const num = parseInt(raw.trim());
    if (!isNaN(num) && num > 0) {
      const user = users.find((u: any) => u.id === num);
      if (user) { doCheckin(num, user.name); return; }
    }
    toast({ title: "⚠ QR غير معروف", description: raw.substring(0, 50), variant: "destructive" });
  }, [users, doCheckin, toast]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setScanStatus("جاهز للمسح...");
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const jsQR = jsQRRef.current;
    if (!video || !canvas || !jsQR || !streamRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth, h = video.videoHeight;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(scanFrame); return; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code) processQR(code.data);
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [processQR]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    if (!jsQRRef.current) {
      try { const m = await import("jsqr"); jsQRRef.current = m.default; }
      catch { setCameraError("فشل تحميل مكتبة المسح"); return; }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      setScanStatus("جاري المسح...");
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError" ? "رُفض إذن الكاميرا — اسمح للمتصفح من الإعدادات" :
        err.name === "NotFoundError" ? "لا توجد كاميرا على هذا الجهاز" :
        err.name === "NotReadableError" ? "الكاميرا مستخدمة من تطبيق آخر" :
        "تعذّر تشغيل الكاميرا: " + (err.message ?? "خطأ غير معروف")
      );
    }
  }, [scanFrame]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const jsQR = jsQRRef.current;
    if (!jsQR) { toast({ title: "المكتبة لم تُحمَّل بعد", variant: "destructive" }); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      URL.revokeObjectURL(url);
      if (code) processQR(code.data);
      else toast({ title: "لم يتم العثور على QR في الصورة", variant: "destructive" });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast({ title: "فشل تحميل الصورة", variant: "destructive" }); };
    img.src = url;
    e.target.value = "";
  }, [processQR, toast]);

  const handleManualCheckin = async () => {
    const id = parseInt(manualId);
    if (!id) { toast({ title: "اختر عضواً أولاً", variant: "destructive" }); return; }
    const user = users.find((u: any) => u.id === id);
    if (!user) { toast({ title: "العضو غير موجود", variant: "destructive" }); return; }
    await doCheckin(id, user.name);
    setManualId("");
  };

  return (
    <div className="space-y-5">
      {/* Success banner */}
      {lastCheckin && (
        <div className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "hsl(142 60% 50% / 0.1)", border: "1px solid hsl(142 60% 50% / 0.3)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(142 60% 50% / 0.2)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-green-400">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-green-400">{lastCheckin.name}</p>
            <p className="text-sm" style={{ color: "hsl(142 60% 55% / 0.7)" }}>تم تسجيل الحضور • {lastCheckin.time}</p>
          </div>
          <button onClick={() => setLastCheckin(null)} className="text-green-400/40 hover:text-green-400 text-lg">✕</button>
        </div>
      )}

      {/* Camera card */}
      <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}>
        <div className="relative" style={{ minHeight: cameraActive ? 0 : 220, background: "hsl(0 0% 6%)" }}>
          <video ref={videoRef} playsInline muted className="w-full block"
            style={{ display: cameraActive ? "block" : "none", maxHeight: 360, objectFit: "cover" }} />
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {flash ? (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(37,211,102,0.3)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-20 h-20">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              ) : (
                <>
                  <div className="relative w-52 h-52">
                    {[["top-0 right-0","border-t-2 border-r-2 rounded-tr-xl"],["top-0 left-0","border-t-2 border-l-2 rounded-tl-xl"],["bottom-0 right-0","border-b-2 border-r-2 rounded-br-xl"],["bottom-0 left-0","border-b-2 border-l-2 rounded-bl-xl"]].map(([pos,cls],i)=>(
                      <div key={i} className={`absolute ${pos} w-8 h-8 ${cls}`} style={{ borderColor: "hsl(40 65% 52%)" }} />
                    ))}
                    <div className="absolute inset-x-2 h-0.5 animate-bounce" style={{ background: "hsl(40 65% 52% / 0.8)", top: "50%" }} />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "hsl(40 65% 55%)" }}>
                      {scanStatus}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {cameraError ? (
                <>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(0 60% 50% / 0.1)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7 text-red-400">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <p className="text-red-400 text-sm text-center px-8">{cameraError}</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "hsl(40 65% 48% / 0.1)", border: "2px dashed hsl(40 65% 48% / 0.4)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10" style={{ color: "hsl(40 65% 52%)" }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm text-center px-8">اضغط الزر لتشغيل الكاميرا</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 space-y-2.5">
          {!cameraActive ? (
            <button onClick={startCamera}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
              📷 تشغيل الكاميرا ومسح QR
            </button>
          ) : (
            <button onClick={stopCamera} className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "hsl(0 0% 16%)", color: "hsl(0 0% 60%)" }}>
              ⏹ إيقاف الكاميرا
            </button>
          )}
          <label className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "hsl(0 0% 13%)", color: "hsl(0 0% 55%)", border: "1px solid hsl(0 0% 20%)" }}>
            🖼 اختر صورة QR من الجهاز
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      </div>

      {/* Manual checkin */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}>
        <h2 className="text-sm font-semibold text-foreground">تسجيل يدوي</h2>
        <select value={manualId} onChange={e => setManualId(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
          style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}>
          <option value="">-- اختر عضو --</option>
          {users.filter((u: any) => u.role !== "admin").map((u: any) => (
            <option key={u.id} value={u.id}>{u.name} — {u.phone}</option>
          ))}
        </select>
        <button onClick={handleManualCheckin} disabled={loading || !manualId}
          className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          {loading ? "جاري التسجيل..." : "✅ تسجيل الحضور"}
        </button>
      </div>

      {/* Quick grid */}
      {users.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}>
          <h2 className="text-sm font-semibold text-foreground mb-3">تسجيل سريع</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {users.filter((u: any) => u.role !== "admin").slice(0, 9).map((u: any) => (
              <button key={u.id} onClick={() => doCheckin(u.id, u.name)} disabled={loading}
                className="rounded-xl p-3 text-right transition-all disabled:opacity-50"
                style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 20%)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(40 65% 48% / 0.5)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(0 0% 20%)")}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5"
                  style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 55%)" }}>
                  {u.name?.[0] ?? "?"}
                </div>
                <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">#{u.id}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Checkin Log sub-component ───────────────────────
function CheckinLogTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: checkins, isLoading, refetch, isFetching } = useListCheckins(
    {}, { query: { queryKey: getListCheckinsQueryKey({}) } }
  );
  const { data: users } = useListUsers({}, { query: { queryKey: getListUsersQueryKey({}) } });
  const createCheckin = useCreateCheckin();

  const [showForm, setShowForm] = useState(false);
  const [formUserId, setFormUserId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  const checkinList: any[] = Array.isArray(checkins) ? checkins : (checkins as any)?.checkins ?? [];
  const userList: any[] = Array.isArray(users) ? users : (users as any)?.data ?? (users as any)?.users ?? [];

  const filtered = checkinList.filter((c: any) =>
    !search || (c.userName ?? "").includes(search)
  );

  function handleCreate() {
    if (!formUserId) { toast({ title: "اختر عضو", variant: "destructive" }); return; }
    createCheckin.mutate({ data: { userId: Number(formUserId), date: formDate } }, {
      onSuccess: () => {
        toast({ title: "✅ تم تسجيل الحضور" });
        queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey() });
        setShowForm(false); setFormUserId(""); setFormDate(new Date().toISOString().split("T")[0]);
      },
      onError: () => toast({ title: "خطأ في تسجيل الحضور", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم العضو..."
            className="w-full rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }} />
        </div>
        <button onClick={() => refetch()} disabled={isFetching} title="تحديث"
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 22%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className={`w-4 h-4 text-muted-foreground ${isFetching ? "animate-spin" : ""}`}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 5.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          تسجيل
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 rounded-xl" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "hsl(0 0% 12%)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-muted-foreground">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <p className="text-foreground font-semibold">لا يوجد سجل حضور</p>
            {search && <p className="text-muted-foreground text-sm mt-1">لا توجد نتائج لـ "{search}"</p>}
          </div>
        ) : (
          filtered.map((c: any) => {
            const d = new Date(c.date);
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "hsl(40 65% 48% / 0.2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "hsl(0 0% 14%)")}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: "hsl(40 65% 48% / 0.15)", color: "hsl(40 65% 58%)" }}>
                  {(c.userName ?? "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{c.userName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.toLocaleDateString("ar-EG", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: "hsl(142 60% 50% / 0.12)", border: "1px solid hsl(142 60% 50% / 0.2)" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(142 60% 55%)" }} />
                  <span className="text-xs font-medium" style={{ color: "hsl(142 60% 60%)" }}>حضر</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add manually modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" style={{ backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(40 65% 48% / 0.2)" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
              <h2 className="text-base font-bold text-foreground">تسجيل حضور يدوي</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground" style={{ background: "hsl(0 0% 14%)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">العضو</label>
                <select value={formUserId} onChange={e => setFormUserId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
                  style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }}>
                  <option value="">-- اختر عضو --</option>
                  {userList.filter((u: any) => u.role !== "admin").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">التاريخ</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none"
                  style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreate} disabled={createCheckin.isPending}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }}>
                  {createCheckin.isPending ? "جاري التسجيل..." : "✅ تسجيل"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 rounded-xl text-sm"
                  style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 60%)" }}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────
export default function AdminAttendance() {
  const [tab, setTab] = useState<Tab>("scan");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "scan",
      label: "مسح QR",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/>
        <rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/>
        <rect x="18" y="18" width="3" height="3" rx="0.5"/>
      </svg>,
    },
    {
      key: "log",
      label: "سجل الحضور",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>,
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">الحضور</h1>
        <p className="text-muted-foreground text-sm mt-0.5">تسجيل ومتابعة حضور الأعضاء</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={tab === t.key
              ? { background: "linear-gradient(135deg, hsl(40 65% 52%), hsl(40 65% 42%))", color: "hsl(0 0% 5%)" }
              : { color: "hsl(0 0% 50%)" }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "scan" ? <QRScannerTab /> : <CheckinLogTab />}
    </div>
  );
}
