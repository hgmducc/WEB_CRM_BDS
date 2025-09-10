import React, { useState, useMemo, useCallback, useEffect } from "react";
import UploadData from "./compose/UploadData";
import BanPage from "./compose/BanPage";
import ThuePage from "./compose/ThuePage";
import CanHoPage from "./compose/CanHoPage";
import { ToastHost, toast } from "./components/Toast";

const LS_KEY = "CRM_BDS_PAYLOAD_V1";

// Utility
const inferPhanKhu = (maCanRaw) => {
  const s = String(maCanRaw || "").trim();
  if (!s) return "";
  const tok = s.split(/\s+/)[0].toUpperCase();
  if (/^TI/.test(tok)) return "ĐẢO";
  return tok;
};
const vnorm = (input = "") =>
  String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const flattenPayload = (payload) => {
  if (!payload) return [];
  const { canHo = {}, chuNha = {}, chuNha_canHo = [] } = payload;

  return chuNha_canHo.map((lnk) => {
    const c = canHo[lnk.canHoId] || {};
    const o = chuNha[lnk.chuNhaId] || {};
    return {
      canHoId: lnk.canHoId,
      chuNhaId: lnk.chuNhaId,
      isPrimaryContact: !!lnk.isPrimaryContact,
      role: lnk.role,
      maCan: c.maCan,
      phanKhu: c.phanKhu,
      loaiCan: c.loaiCan,
      goc: c.goc,
      dtDat: c.dtDat,
      dienTich: c.dienTich ?? c.dtDat,
      huong: c.huong,
      nhuCau: c.nhuCau,
      gia: c.gia,
      giaTot: c.giaTot,
      ghiChu: c.ghiChu,
      hoTen: o.hoTen,
      tenNK: o.hoTen,
      tenChuNha: o.hoTen,
      sdt1: o.sdt1,
      sdt2: o.sdt2,
    };
  });
};

const ensurePrimaryForCan = (payload, canHoId) => {
  const { chuNha_canHo } = payload;
  const group = chuNha_canHo.filter((x) => x.canHoId === canHoId);
  if (group.length === 0) return payload;

  const hasPrimary = group.some((x) => x.isPrimaryContact);
  if (!hasPrimary) {
    const idx = payload.chuNha_canHo.findIndex(
      (x) => x.canHoId === canHoId && x.chuNhaId === group[0].chuNhaId
    );
    if (idx >= 0) payload.chuNha_canHo[idx].isPrimaryContact = true;
  } else {
    let seen = false;
    for (const l of payload.chuNha_canHo) {
      if (l.canHoId !== canHoId) continue;
      if (l.isPrimaryContact && !seen) {
        seen = true;
      } else if (l.isPrimaryContact && seen) {
        l.isPrimaryContact = false;
      }
    }
  }
  return payload;
};

const loadFromLS = () => {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.canHo || !parsed.chuNha || !Array.isArray(parsed.chuNha_canHo)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveToLS = (payload) => {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

const TabButton = React.memo(({ id, children, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-blue-600 text-white border-blue-600 shadow-md"
        : "bg-white hover:bg-gray-50 border-gray-300 hover:border-gray-400 hover:shadow-sm"
    }`}
    aria-pressed={isActive}
  >
    {children}
  </button>
));

export default function App() {
  const [payload, setPayload] = useState(() => loadFromLS());
  const [activeTab, setActiveTab] = useState("ban");

  const flat = useMemo(() => flattenPayload(payload), [payload]);

  const stats = useMemo(() => {
    if (!payload) return { can: 0, chu: 0, link: 0, ban: 0, thue: 0, all: 0 };
    const all = flat.length;
    const ban = flat.filter((r) => vnorm(r.nhuCau) === "ban").length;
    const thue = flat.filter((r) => vnorm(r.nhuCau) === "thue").length;
    return {
      can: Object.keys(payload.canHo || {}).length,
      chu: Object.keys(payload.chuNha || {}).length,
      link: (payload.chuNha_canHo || []).length,
      all,
      ban,
      thue,
    };
  }, [payload, flat]);

  useEffect(() => {
    if (payload) saveToLS(payload);
  }, [payload]);

  const handleLoaded = useCallback((pl) => setPayload(pl), []);

  // Lưu cập nhật từ NoteModal (bao gồm SĐT & các field căn hộ)
  const handleSave = useCallback(
    (update) => {
      if (!payload) return;
      const canHoId =
        update?.canHoId || update?.id || `${update?.maCan}|${inferPhanKhu(update?.maCan)}`;
      if (!canHoId || !payload.canHo[canHoId]) return;

      const allowedFields = new Set([
        "gia",
        "giaTot",
        "nhuCau",
        "ghiChu",
        "loaiCan",
        "dtDat",
        "dienTich",
        "goc",
        "huong",
        "noiThat",
        "soPhongNgu",
        "baoPhi",
      ]);
      const patch = Object.fromEntries(
        Object.entries(update).filter(([k]) => allowedFields.has(k))
      );

      setPayload((prev) => {
        const next = {
          ...prev,
          canHo: {
            ...prev.canHo,
            [canHoId]: { ...prev.canHo[canHoId], ...patch },
          },
        };

        // cập nhật SĐT cho chủ hộ nếu có
        if (update?.chuNhaId) {
          const owner = next.chuNha?.[update.chuNhaId] || {};
          next.chuNha = { ...(next.chuNha || {}) };
          next.chuNha[update.chuNhaId] = {
            ...owner,
            sdt1: update.sdt1 || owner.sdt1,
            sdt2: update.sdt2 || owner.sdt2,
          };
        }
        return next;
      });

      toast({ title: "Đã lưu", message: `Căn ${update?.maCan || ""} cập nhật thành công.` });
    },
    [payload]
  );

  // Tạo căn mới + tự liên kết với chủ hiện tại
  const handleCreateUnitByMaCan = useCallback(
    (maCanRaw, ownerId) => {
      const maCan = String(maCanRaw || "").trim();
      if (!maCan || !payload) return;

      const phanKhu = inferPhanKhu(maCan);
      const canHoId = `${maCan}|${phanKhu}`;

      setPayload((prev) => {
        const next = { ...prev };
        if (!next.canHo) next.canHo = {};
        if (!next.chuNha) next.chuNha = {};
        if (!next.chuNha_canHo) next.chuNha_canHo = [];

        if (!next.canHo[canHoId]) {
          next.canHo[canHoId] = { id: canHoId, maCan, phanKhu };
        }
        if (ownerId) {
          next.chuNha_canHo.push({
            canHoId,
            chuNhaId: ownerId,
            isPrimaryContact: true,
            role: "Chủ sở hữu",
          });
          ensurePrimaryForCan(next, canHoId);
        }
        return next;
      });

      toast({
        title: "Đã thêm căn mới",
        message: `Tạo ${maCan} và liên kết với chủ hiện tại.`,
        type: "success",
      });
    },
    [payload]
  );

  const handleDeleteOwner = useCallback(
    ({ canHoId, chuNhaId }) => {
      if (!payload) return;
      setPayload((prev) => {
        const next = {
          ...prev,
          chuNha_canHo: prev.chuNha_canHo.filter(
            (lnk) => !(lnk.canHoId === canHoId && lnk.chuNhaId === chuNhaId)
          ),
        };
        ensurePrimaryForCan(next, canHoId);
        return next;
      });
      toast({ title: "Đã gỡ liên kết", type: "warning" });
    },
    [payload]
  );

  const handleTabClick = useCallback((tabId) => setActiveTab(tabId), []);

  const renderTabButton = useCallback(
    (id, label) => (
      <TabButton key={id} id={id} isActive={activeTab === id} onClick={() => handleTabClick(id)}>
        {label}
      </TabButton>
    ),
    [activeTab, handleTabClick]
  );

  const renderContent = () => {
    if (!payload || flat.length === 0) {
      return (
        <div className="p-6 rounded-xl border bg-white shadow-sm">
          <div className="text-center">
            <div className="text-gray-500 mb-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có dữ liệu</h3>
            <p className="text-sm text-gray-600">
              Hãy <strong>tải file Excel/CSV</strong> ở phần trên để nhập dữ liệu vào hệ thống.
            </p>
          </div>
        </div>
      );
    }

    const commonProps = {
      data: flat,
      onSave: handleSave,
      onCreateUnitByMaCan: handleCreateUnitByMaCan,
      onDeleteOwner: handleDeleteOwner,
    };

    switch (activeTab) {
      case "ban":
        return <BanPage {...commonProps} />;
      case "thue":
        return <ThuePage {...commonProps} />;
      case "canho":
        return <CanHoPage {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800">
      <ToastHost />
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">
                CRM BĐS
                <span className="text-sm font-normal text-gray-500 ml-2">(Demo Local)</span>
              </h1>
              <div className="hidden sm:flex items-center gap-2">
                {renderTabButton("ban", `Bán (${stats.ban})`)}
                {renderTabButton("thue", `Thuê (${stats.thue})`)}
                {renderTabButton("canho", "Căn hộ")}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Căn:</span>
                <span className="font-semibold text-blue-600">{stats.can}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Chủ:</span>
                <span className="font-semibold text-green-600">{stats.chu}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-600">Liên kết:</span>
                <span className="font-semibold text-purple-600">{stats.link}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <UploadData onLoaded={handleLoaded} />
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
          {renderTabButton("ban", `Bán (${stats.ban})`)}
          {renderTabButton("thue", `Thuê (${stats.thue})`)}
          {renderTabButton("canho", "Căn hộ")}
        </div>

        {renderContent()}
      </main>
    </div>
  );
}
