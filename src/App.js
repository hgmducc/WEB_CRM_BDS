// src/App.js – Enhanced UI/UX version
import { useMemo, useState, useEffect } from "react";
import BanPage from "./compose/BanPage";
import ThuePage from "./compose/ThuePage";
import CanHoPage from "./compose/CanHoPage";
import UploadData from "./compose/UploadData";

export default function App() {
  const [tab, setTab] = useState("ban"); // ban | thue | canho
  const [payload, setPayload] = useState(null); // { canHo, chuNha, chuNha_canHo }
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ban: 0, thue: 0, canho: 0 });

  // Load lại dữ liệu lần trước (nếu có)
  useEffect(() => {
    const loadData = async () => {
      try {
        const s = localStorage.getItem("crm_payload");
        if (s) {
          const data = JSON.parse(s);
          setPayload(data);
          calculateStats(data);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setTimeout(() => setIsLoading(false), 500); // Smooth loading transition
      }
    };
    loadData();
  }, []);

  // Calculate statistics
  const calculateStats = (data) => {
    if (!data) return;
    const flatRows = flattenPayload(data);
    const total = flatRows.length;
    const ban = flatRows.filter(r => r.nhuCau === "Bán").length;
    const thue = flatRows.filter(r => r.nhuCau === "Thuê").length;
    const canho = data.canHo?.length || 0;
    
    setStats({ total, ban, thue, canho });
  };

  // Chuyển payload (3 bảng) → mảng dòng phẳng cho UI (CRMBase)
  const flatRows = useMemo(() => flattenPayload(payload), [payload]);

  // ===== Lưu ghi chú/Giá từ modal vào payload + localStorage =====
  function handleSaveNote(updatedRow) {
    if (!payload) return;
    const next = structuredClone(payload);

    const key = updatedRow.canHoId || `${updatedRow.maCan}|${updatedRow.phanKhu}`;
    const i = next.canHo.findIndex((c) => (c.id || `${c.maCan}|${c.phanKhu}`) === key);
    if (i !== -1) {
      const c = next.canHo[i];
      // giá
      const n = sanitizedNumber(updatedRow.gia);
      c.gia = n === null ? c.gia ?? null : n;
      // nhu cầu / giá tốt
      if (updatedRow.nhuCau !== undefined) c.nhuCau = updatedRow.nhuCau || null;
      c.giaTot = !!updatedRow.giaTot;
      // timeline ghi chú
      c.ghiChu = Array.isArray(updatedRow.ghiChu) ? updatedRow.ghiChu : c.ghiChu || [];
      // base fields chỉ khi căn cho phép sửa
      if (updatedRow._isNew || updatedRow._editableBase) {
        c.maCan   = updatedRow.maCan ?? c.maCan;
        c.phanKhu = updatedRow.phanKhu ?? c.phanKhu;
        c.huong   = updatedRow.huong ?? c.huong;
        c.loaiCan = updatedRow.loaiCan ?? c.loaiCan;
        c.dtDat   = updatedRow.dienTich ?? c.dtDat;
      }
      // sdt2 (thuộc chủ hộ) là ở bảng chuNha – nếu cần đổi cho chủ hiện tại:
      if (updatedRow.sdt2 && updatedRow.chuNhaId) {
        const j = next.chuNha.findIndex((p) => p.id === updatedRow.chuNhaId);
        if (j !== -1) next.chuNha[j].sdt2 = updatedRow.sdt2;
      }
    }

    setPayload(next);
    calculateStats(next);
    localStorage.setItem("crm_payload", JSON.stringify(next));
  }

  // ===== Thêm mới căn theo mã căn – copy chủ hộ hiện tại =====
  async function handleCreateUnitByMaCan(maCan, phone, ownerName) {
    if (!payload) return null;
    const next = structuredClone(payload);

    // 1) Tìm hoặc tạo chủ hộ từ phone (ưu tiên)
    let owner = next.chuNha.find((p) => p.sdt1 === phone || p.sdt2 === phone);
    if (!owner) {
      owner = {
        id: genId("owner"),
        hoTen: ownerName || "Chủ hộ",
        sdt1: phone || null,
        sdt2: null,
      };
      next.chuNha.push(owner);
    }

    // 2) Suy phận khu từ mã
    const phanKhu = inferPhanKhu(maCan);

    // 3) Tạo hoặc lấy căn hộ theo (maCan + phanKhu)
    let can = next.canHo.find((c) => c.maCan === maCan && c.phanKhu === phanKhu);
    if (!can) {
      can = {
        id: genId("can"),
        maCan,
        phanKhu,
        huong: "",
        loaiCan: "",
        dtDat: null,
        nhuCau: null,
        gia: null,
        giaTot: false,
        ghiChu: [],
        _isNew: true,             // <- cho phép sửa base fields trong modal
        _editableBase: true,
      };
      next.canHo.push(can);
    }

    // 4) Tạo liên kết chủ hộ ↔ căn hộ (có thể trùng mã căn nhưng chủ hộ khác → tách riêng)
    const existsLink = next.chuNha_canHo.some(
      (lk) => lk.canHoId === (can.id || `${can.maCan}|${can.phanKhu}`) && lk.chuNhaId === owner.id
    );
    if (!existsLink) {
      next.chuNha_canHo.push({
        id: genId("lk"),
        canHoId: can.id || `${can.maCan}|${can.phanKhu}`,
        chuNhaId: owner.id,
      });
    }

    // 5) Lưu
    setPayload(next);
    calculateStats(next);
    localStorage.setItem("crm_payload", JSON.stringify(next));

    // 6) Trả về bản ghi phẳng tương ứng để modal "nhảy tới"
    const flattened = flattenPayload(next);
    const target = flattened.find(
      (r) => r.canHoId === (can.id || `${can.maCan}|${can.phanKhu}`) && r.chuNhaId === owner.id
    );
    return target || null;
  }

  // ===== XOÁ CHỦ HỘ (giữ căn hộ, gỡ liên kết) =====
  function handleDeleteOwner(chuNhaId) {
    if (!payload || !chuNhaId) return;

    const next = structuredClone(payload);

    // 1) gỡ toàn bộ liên kết của chủ hộ này
    next.chuNha_canHo = next.chuNha_canHo.filter((lk) => lk.chuNhaId !== chuNhaId);

    // 2) xoá bản ghi chủ hộ
    next.chuNha = next.chuNha.filter((p) => p.id !== chuNhaId);

    // 3) lưu lại
    setPayload(next);
    calculateStats(next);
    localStorage.setItem("crm_payload", JSON.stringify(next));
  }

  // ===== Gỡ liên kết 1 căn ↔ chủ hộ (không xoá chủ, không xoá căn) =====
  function handleUnlinkOwner({ linkId, canHoId, chuNhaId }) {
    if (!payload) return;
    const next = structuredClone(payload);

    // Gỡ đúng 1 liên kết căn ↔ chủ
    next.chuNha_canHo = (next.chuNha_canHo || []).filter(lk =>
      linkId
        ? lk.id !== linkId
        : !(lk.canHoId === canHoId && lk.chuNhaId === chuNhaId)
    );

    setPayload(next);
    calculateStats(next);
    localStorage.setItem("crm_payload", JSON.stringify(next));
  }

  const handleUploadData = (newPayload) => {
    setPayload(newPayload);
    calculateStats(newPayload);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Top Row - Brand & Upload */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0v-4a2 2 0 011-1h1m0-6V7a2 2 0 011-1h1m0-6h4m-6 0h4m6 0v1a2 2 0 01-1 1h-1m0 6v1a2 2 0 01-1 1h-1m0 6h4"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    CRM Dashboard
                  </h1>
                  <p className="text-sm text-gray-600 hidden sm:block">
                    Quản lý bất động sản thông minh
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Component */}
            <div className="flex items-center gap-3">
              <UploadData onParsed={handleUploadData} />
            </div>
          </div>

          {/* Stats Cards (đã bỏ) */}
          {/* {payload && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatsCard icon="📊" label="Tổng cộng" value={stats.total} color="blue" />
              <StatsCard icon="🔵" label="Bán" value={stats.ban} color="blue" />
              <StatsCard icon="🟡" label="Thuê" value={stats.thue} color="amber" />
              <StatsCard icon="🏠" label="Căn hộ" value={stats.canho} color="green" />
            </div>
          )} */}

          {/* Enhanced Navigation */}
          <nav className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <EnhancedTab 
                active={tab === "ban"} 
                onClick={() => setTab("ban")}
                icon="🔵"
                label="Bán"
                count={stats.ban}
              />
              <EnhancedTab 
                active={tab === "thue"} 
                onClick={() => setTab("thue")}
                icon="🟡"
                label="Thuê" 
                count={stats.thue}
              />
              <EnhancedTab 
                active={tab === "canho"} 
                onClick={() => setTab("canho")}
                icon="🏠"
                label="Căn hộ"
                count={stats.canho}
              />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-gradient-to-r from-blue-200/30 to-indigo-200/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-gradient-to-r from-purple-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          {!payload ? (
            <WelcomeScreen />
          ) : (
            <>
              {tab === "ban" && (
                <BanPage
                  data={flatRows}
                  onSave={handleSaveNote}
                  onCreateUnitByMaCan={handleCreateUnitByMaCan}
                  onDeleteOwner={handleUnlinkOwner}
                />
              )}
              {tab === "thue" && (
                <ThuePage
                  data={flatRows}
                  onSave={handleSaveNote}
                  onCreateUnitByMaCan={handleCreateUnitByMaCan}
                  onDeleteOwner={handleUnlinkOwner}
                />
              )}
              {tab === "canho" && (
                <CanHoPage
                  data={flatRows}
                  onSave={handleSaveNote}
                  onCreateUnitByMaCan={handleCreateUnitByMaCan}
                  onDeleteOwner={handleUnlinkOwner}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// Enhanced Components
function EnhancedTab({ active, onClick, icon, label, count = 0 }) {
  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center gap-2.5 px-4 sm:px-6 py-2.5 rounded-2xl text-sm font-semibold 
        transition-all duration-200 transform hover:scale-105 active:scale-95 whitespace-nowrap
        ${active 
          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25" 
          : "bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md border border-gray-200/50"
        }
      `}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
      <span className={`
        text-xs px-2 py-0.5 rounded-full font-bold
        ${active 
          ? "bg-white/20 text-white" 
          : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
        }
      `}>
        {count}
      </span>
    </button>
  );
}

function StatsCard({ icon, label, value, color = "blue" }) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700", 
    green: "from-green-50 to-green-100 border-green-200 text-green-700",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700",
  };

  return (
    <div className={`
      bg-gradient-to-br ${colorClasses[color]} 
      rounded-2xl p-3 sm:p-4 border backdrop-blur-sm shadow-sm
      hover:shadow-md transition-all duration-200
    `}>
      <div className="flex items-center gap-2.5">
        <span className="text-lg sm:text-xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-current opacity-80 truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-current">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl mb-6 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0v-4a2 2 0 011-1h1m0-6V7a2 2 0 011-1h1m0-6h4m-6 0h4m6 0v1a2 2 0 01-1 1h-1m0 6v1a2 2 0 01-1 1h-1m0 6h4"/>
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Đang tải CRM
        </h2>
        <p className="text-gray-600">Vui lòng chờ một chút...</p>
        
        {/* Loading Animation */}
        <div className="flex justify-center mt-6">
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="text-center max-w-2xl mx-auto">
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center shadow-2xl mx-auto">
            <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          </div>
          {/* Decorative rings */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-200/50 animate-ping"></div>
          <div className="absolute inset-4 rounded-full border-2 border-indigo-300/30 animate-pulse"></div>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
          Chào mừng đến với CRM
        </h2>
        
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          Quản lý bất động sản thông minh và hiệu quả. 
          <br className="hidden sm:block" />
          Tải lên dữ liệu của bạn để bắt đầu sử dụng.
        </p>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-gray-200/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <FeatureCard 
              icon="📊"
              title="Phân tích dữ liệu"
              description="Thống kê chi tiết theo từng phân khu"
            />
            <FeatureCard 
              icon="💬"
              title="Ghi chú CRM"
              description="Theo dõi lịch sử trao đổi khách hàng"
            />
            <FeatureCard 
              icon="🔄"
              title="Đồng bộ tức thời"
              description="Lưu trữ tự động mọi thay đổi"
            />
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm text-gray-500">
            🎯 Bắt đầu bằng cách tải lên file Excel hoặc CSV từ nút "Tải dữ liệu" ở góc trên bên phải
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="group">
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

// ===== Utils: ghép 3 bảng → hàng hiển thị =====
function flattenPayload(payload) {
  if (!payload) return [];
  const { canHo = [], chuNha = [], chuNha_canHo = [] } = payload;
  const byCan = new Map(canHo.map((c) => [c.id || `${c.maCan}|${c.phanKhu}`, c]));
  const byChu = new Map(chuNha.map((p) => [p.id, p]));

  return chuNha_canHo.map((lk) => {
    const c = byCan.get(lk.canHoId) || {};
    const p = byChu.get(lk.chuNhaId) || {};

    let latest = null;
    if (Array.isArray(c.ghiChu) && c.ghiChu.length) {
      latest = [...c.ghiChu]
        .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || String(b.date).localeCompare(String(a.date)))[0];
    }

    return {
      id: lk.id,
      canHoId: lk.canHoId,
      chuNhaId: lk.chuNhaId,
      maCan: c.maCan,
      phanKhu: c.phanKhu,
      tenNK: p.hoTen,
      sdt1: p.sdt1,
      sdt2: p.sdt2,
      loaiCan: c.loaiCan,
      huong: c.huong,
      dienTich: c.dtDat,
      noteDate: latest?.date || "",
      noteText: latest?.content || "",
      ghiChu: c.ghiChu || [],
      nhuCau: c.nhuCau || null,
      gia: c.gia ?? null,
      giaTot: c.giaTot ?? false,
      // để modal biết căn này có được sửa base fields không
      _isNew: !!c._isNew,
      _editableBase: !!c._editableBase,
    };
  });
}

function sanitizedNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

// helpers for creation
function genId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
function inferPhanKhu(code) {
  if (!code) return "";
  const m = String(code).trim().match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : "";
}