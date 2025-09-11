// src/App.js
import React, { useState, useMemo, useCallback, useEffect } from "react";
import BanPage from "./compose/BanPage";
import ThuePage from "./compose/ThuePage";
import CanHoPage from "./compose/CanHoPage";
import SettingsPage from "./compose/SettingsPage";
import { ToastHost, toast } from "./components/Toast";

// Firebase
import { db, auth, ensureAuth, now } from "./lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ================= Helpers ================= */
const LS_KEY = "CRM_BDS_PAYLOAD_V1";

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

/* Lấy ghi chú mới nhất từ mảng ghiChu (ưu tiên ts, sau đó tới date) */
function pickLatestNote(ghiChu) {
  if (!Array.isArray(ghiChu) || ghiChu.length === 0)
    return { lastNoteText: "", lastNoteDate: "", lastNoteTs: 0 };

  const sorted = [...ghiChu].sort(
    (a, b) => (b.ts ?? 0) - (a.ts ?? 0) || String(b.date).localeCompare(String(a.date))
  );
  const n = sorted[0] || {};
  return {
    lastNoteText: String(n.content || "").trim(),
    lastNoteDate: n.date || "",
    lastNoteTs: n.ts || 0,
  };
}

/* Chuẩn hoá payload -> mảng dòng cho UI + bổ sung lastNote* để hiển thị ngoài bảng */
const flattenPayload = (payload) => {
  if (!payload) return [];
  const { canHo = {}, chuNha = {}, chuNha_canHo = [] } = payload;

  return chuNha_canHo.map((lnk) => {
    const c = canHo[lnk.canHoId] || {};
    const o = chuNha[lnk.chuNhaId] || {};
    const { lastNoteText, lastNoteDate, lastNoteTs } = pickLatestNote(c.ghiChu);

    return {
      canHoId: lnk.canHoId,
      chuNhaId: lnk.chuNhaId,
      isPrimaryContact: !!lnk.isPrimaryContact,
      role: lnk.role,

      // Căn hộ
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
      noiThat: c.noiThat,
      ghiChu: c.ghiChu,        // giữ nguyên lịch sử để mở NoteModal
      lastNoteText,
      lastNoteDate,
      lastNoteTs,

      // Chủ
      hoTen: o.hoTen,
      tenNK: o.hoTen,
      tenChuNha: o.hoTen,
      sdt1: o.sdt1,
      sdt2: o.sdt2,
    };
  });
};

const saveToLS = (payload) => {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

/* ================ Small UI ================ */
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

/* ================ Firestore path helpers ================ */
const colCanHo = (tid) => collection(db, `tenants/${tid}/canHo`);
const colChuNha = (tid) => collection(db, `tenants/${tid}/chuNha`);
const colLinks = (tid) => collection(db, `tenants/${tid}/links`);
const docCanHo = (tid, id) => doc(db, `tenants/${tid}/canHo/${id}`);
const docChuNha = (tid, id) => doc(db, `tenants/${tid}/chuNha/${id}`);
const docLink  = (tid, id) => doc(db, `tenants/${tid}/links/${id}`);

/* ================ App ================ */
export default function App() {
  const [tenantId, setTenantId] = useState(null);
  const [activeTab, setActiveTab] = useState("ban"); // ban | thue | canho | caidat

  // Local state được build từ 3 snapshot realtime
  const [canHoMap, setCanHoMap] = useState({});
  const [chuNhaMap, setChuNhaMap] = useState({});
  const [linksArr, setLinksArr] = useState([]);

  const payload = useMemo(
    () => ({ canHo: canHoMap, chuNha: chuNhaMap, chuNha_canHo: linksArr }),
    [canHoMap, chuNhaMap, linksArr]
  );

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

  /* ======== Auth + lắng nghe realtime ======== */
  useEffect(() => {
    ensureAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      const tid = user?.uid || "demo";
      setTenantId(tid);
    });
    return () => unsub();
  }, []);

  // Lắng nghe canHo
  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(colCanHo(tenantId), (snap) => {
      const m = {};
      snap.forEach((d) => {
        m[d.id] = { id: d.id, ...d.data() };
      });
      setCanHoMap(m);
    });
    return () => unsub();
  }, [tenantId]);

  // Lắng nghe chuNha
  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(colChuNha(tenantId), (snap) => {
      const m = {};
      snap.forEach((d) => {
        m[d.id] = { id: d.id, ...d.data() };
      });
      setChuNhaMap(m);
    });
    return () => unsub();
  }, [tenantId]);

  // Lắng nghe links
  useEffect(() => {
    if (!tenantId) return;
    const unsub = onSnapshot(colLinks(tenantId), (snap) => {
      const arr = [];
      snap.forEach((d) => {
        arr.push({ id: d.id, ...d.data() });
      });
      setLinksArr(arr);
    });
    return () => unsub();
  }, [tenantId]);

  // Cache local (optional)
  useEffect(() => {
    if (payload) saveToLS(payload);
  }, [payload]);

  /* ======== Import payload từ SettingsPage -> ghi Firestore (merge) ======== */
  const handleLoaded = useCallback(
    async (pl) => {
      if (!tenantId || !pl) return;
      try {
        const batchSize = 400;
        const entries = {
          canHo: Object.entries(pl.canHo || {}),
          chuNha: Object.entries(pl.chuNha || {}),
          links: (pl.chuNha_canHo || []).map((l) => [
            `${l.canHoId}__${l.chuNhaId}`,
            l,
          ]),
        };

        const commitChunked = async (pairs, writer) => {
          for (let i = 0; i < pairs.length; i += batchSize) {
            const slice = pairs.slice(i, i + batchSize);
            const batch = writeBatch(db);
            slice.forEach(([id, data]) => writer(batch, id, data));
            await batch.commit();
          }
        };

        await commitChunked(entries.canHo, (batch, id, data) => {
          batch.set(docCanHo(tenantId, id), { ...data, updatedAt: now() }, { merge: true });
        });
        await commitChunked(entries.chuNha, (batch, id, data) => {
          batch.set(docChuNha(tenantId, id), { ...data, updatedAt: now() }, { merge: true });
        });
        await commitChunked(entries.links, (batch, id, data) => {
          batch.set(docLink(tenantId, id), { ...data, updatedAt: now() }, { merge: true });
        });

        toast({ title: "Đã import dữ liệu", type: "success" });
      } catch (e) {
        console.error(e);
        toast({ title: "Import thất bại", message: String(e?.message || e), type: "error" });
      }
    },
    [tenantId]
  );

  /* ======== SAVE: cập nhật căn hộ và/hoặc SĐT chủ ======== */
  const handleSave = useCallback(
    async (update) => {
      if (!tenantId || !update) return;

      try {
        // 1) Cập nhật căn hộ
        const canHoId =
          update?.canHoId ||
          update?.id ||
          (update?.maCan ? `${update.maCan}|${inferPhanKhu(update.maCan)}` : null);

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
          Object.entries(update || {}).filter(([k]) => allowedFields.has(k))
        );

        if (canHoId && Object.keys(patch).length > 0) {
          await setDoc(
            docCanHo(tenantId, canHoId),
            { ...patch, updatedAt: now() },
            { merge: true }
          );
        }

        // 2) Cập nhật SĐT chủ hộ (nếu có)
        if (update?.chuNhaId && (update?.sdt1 !== undefined || update?.sdt2 !== undefined)) {
          const { sdt1, sdt2 } = update;
          await setDoc(
            docChuNha(tenantId, update.chuNhaId),
            {
              ...(sdt1 !== undefined ? { sdt1 } : {}),
              ...(sdt2 !== undefined ? { sdt2 } : {}),
              updatedAt: now(),
            },
            { merge: true }
          );
        }

        toast({ title: "Đã lưu thay đổi", type: "success" });
      } catch (e) {
        console.error(e);
        toast({ title: "Lưu thất bại", message: String(e?.message || e), type: "error" });
      }
    },
    [tenantId]
  );

  /* ======== TẠO CĂN MỚI + liên kết chủ hiện tại ======== */
  const handleCreateUnitByMaCan = useCallback(
    async (maCanRaw, chuNhaId) => {
      if (!tenantId) return;
      const maCan = String(maCanRaw || "").trim();
      if (!maCan) return;

      const phanKhu = inferPhanKhu(maCan);
      const canHoId = `${maCan}|${phanKhu}`;

      try {
        // 1) Tạo/ghi căn
        await setDoc(
          docCanHo(tenantId, canHoId),
          { id: canHoId, maCan, phanKhu, updatedAt: now() },
          { merge: true }
        );

        // 2) Liên kết chủ nếu có
        if (chuNhaId) {
          const linkId = `${canHoId}__${chuNhaId}`;
          await setDoc(
            docLink(tenantId, linkId),
            {
              canHoId,
              chuNhaId,
              isPrimaryContact: true,
              role: "Chủ sở hữu",
              updatedAt: now(),
            },
            { merge: true }
          );

          // 3) Đảm bảo chỉ 1 primary cho canHoId
          const q = query(colLinks(tenantId), where("canHoId", "==", canHoId));
          const snap = await getDocs(q);
          const updates = [];
          snap.forEach((d) => {
            if (d.id !== linkId && d.data()?.isPrimaryContact) {
              updates.push(
                updateDoc(docLink(tenantId, d.id), {
                  isPrimaryContact: false,
                  updatedAt: now(),
                })
              );
            }
          });
          await Promise.all(updates);
        }

        toast({ title: "Đã thêm căn mới", message: `Mã căn: ${maCan}`, type: "success" });
      } catch (e) {
        console.error(e);
        toast({ title: "Thêm căn thất bại", message: String(e?.message || e), type: "error" });
      }
    },
    [tenantId]
  );

  /* ======== GỠ LIÊN KẾT CHỦ ======== */
  const handleDeleteOwner = useCallback(
    async ({ canHoId, chuNhaId }) => {
      if (!tenantId || !canHoId || !chuNhaId) return;
      try {
        const linkId = `${canHoId}__${chuNhaId}`;
        await deleteDoc(docLink(tenantId, linkId));
        toast({ title: "Đã gỡ liên kết chủ hộ", type: "info" });
      } catch (e) {
        console.error(e);
        toast({ title: "Gỡ liên kết thất bại", message: String(e?.message || e), type: "error" });
      }
    },
    [tenantId]
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
    if (activeTab === "caidat") return <SettingsPage onLoaded={handleLoaded} />;

    if (flat.length === 0) {
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
              Hãy mở tab <strong>Cài đặt</strong> để <strong>nhập file Excel/CSV</strong>.
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
      {/* Toast host */}
      <ToastHost />

      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">
                CRM BĐS
                <span className="text-sm font-normal text-gray-500 ml-2">(Realtime)</span>
              </h1>

              <div className="hidden sm:flex items-center gap-2">
                {renderTabButton("ban", `Bán (${stats.ban})`)}
                {renderTabButton("thue", `Thuê (${stats.thue})`)}
                {renderTabButton("canho", "Căn hộ")}
                {renderTabButton("caidat", "Cài đặt")}
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

      {/* Tabs mobile */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="sm:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
          {renderTabButton("ban", `Bán (${stats.ban})`)}
          {renderTabButton("thue", `Thuê (${stats.thue})`)}
          {renderTabButton("canho", "Căn hộ")}
          {renderTabButton("caidat", "Cài đặt")}
        </div>

        {renderContent()}
      </main>
    </div>
  );
}
