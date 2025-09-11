// src/compose/SettingsPage.jsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import UploadData from "./UploadData";
import { toast } from "../components/Toast";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { syncAllToFirebase } from "../lib/syncAllToFirebase";

/* ================== LS Keys ================== */
const LS_COLUMNS_KEY = "CRM_BDS_VISIBLE_COLUMNS_V1";
const LS_KEY = "CRM_BDS_PAYLOAD_V1";
const TENANT_LS_KEY = "CRM_BDS_TENANT_ID_V1";

/* ============== Cấu hình cột ============== */
const ALL_COLUMNS = [
  { key: "maCan", label: "Mã Căn", icon: "🏠", category: "basic" },
  { key: "phanKhu", label: "Phân Khu", icon: "🏢", category: "basic" },
  { key: "hoTen", label: "Tên Chủ Nhà", icon: "👤", category: "contact" },
  { key: "sdt1", label: "SĐT 1", icon: "📞", category: "contact" },
  { key: "sdt2", label: "SĐT 2", icon: "📱", category: "contact" },
  { key: "dienTich", label: "Diện Tích", icon: "📐", category: "property" },
  { key: "dtDat", label: "DT Đất", icon: "🏞️", category: "property" },
  { key: "huong", label: "Hướng", icon: "🧭", category: "property" },
  { key: "loaiCan", label: "Loại Căn", icon: "🏘️", category: "property" },
  { key: "goc", label: "Góc", icon: "📍", category: "property" },
  { key: "soPhongNgu", label: "Số Phòng Ngủ", icon: "🛏️", category: "property" },
  { key: "noiThat", label: "Nội Thất", icon: "🪑", category: "property" },
  { key: "gia", label: "Giá", icon: "💰", category: "price" },
  { key: "giaTot", label: "Giá Tốt", icon: "⭐", category: "price" },
  { key: "baoPhi", label: "Bao Phí", icon: "💳", category: "price" },
  { key: "nhuCau", label: "Nhu Cầu", icon: "🎯", category: "status" },
  { key: "lastNoteText", label: "Ghi Chú Mới Nhất", icon: "💬", category: "note" },
  { key: "lastNoteDate", label: "Ngày Ghi Chú", icon: "📅", category: "note" },
];
const DEFAULT_VISIBLE_COLUMNS = ["maCan", "hoTen", "dienTich", "huong", "gia", "nhuCau", "lastNoteText"];

/* ============== Helpers ============== */
const loadVisibleColumns = () => {
  try {
    const saved = localStorage.getItem(LS_COLUMNS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length <= 7) return parsed;
    }
  } catch (e) {
    console.error("Error loading visible columns:", e);
  }
  return DEFAULT_VISIBLE_COLUMNS;
};
const saveVisibleColumns = (columns) => {
  try {
    localStorage.setItem(LS_COLUMNS_KEY, JSON.stringify(columns));
  } catch (e) {
    console.error("Error saving visible columns:", e);
  }
};
const loadPayload = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/* ============== Today report helpers ============== */
const getTodayLeads = (payload) => {
  if (!payload) return [];
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const leads = [];

  Object.entries(payload.canHo || {}).forEach(([canHoId, canHo]) => {
    const notes = Array.isArray(canHo.ghiChu) ? canHo.ghiChu : [];
    const todayNotes = notes.filter((note) => {
      if (!note.date) return false;
      try {
        const noteDate = new Date(note.date).toISOString().split("T")[0];
        return noteDate === today;
      } catch {
        return false;
      }
    });

    if (todayNotes.length > 0) {
      const link = (payload.chuNha_canHo || []).find((l) => l.canHoId === canHoId);
      const owner = link ? payload.chuNha?.[link.chuNhaId] : null;

      leads.push({
        ...canHo,
        canHoId,
        hoTen: owner?.hoTen || "",
        sdt1: owner?.sdt1 || "",
        sdt2: owner?.sdt2 || "",
        todayNotes: todayNotes.length,
        lastNote: todayNotes[todayNotes.length - 1]?.content || "",
      });
    }
  });

  return leads.sort((a, b) => b.todayNotes - a.todayNotes);
};

/* ============== UI atoms ============== */
const MenuCard = React.memo(({ icon, title, description, onClick, active = false }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 transform hover:scale-105 ${
      active
        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl"
        : "bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 shadow-lg hover:shadow-xl border border-gray-200"
    }`}
  >
    <div className="relative z-10">
      <div className={`text-3xl mb-3 ${active ? "drop-shadow-sm" : ""}`}>{icon}</div>
      <h3 className={`font-bold text-lg mb-2 ${active ? "text-white" : "text-gray-900"}`}>{title}</h3>
      <p className={`text-sm ${active ? "text-blue-100" : "text-gray-600"}`}>{description}</p>
    </div>
    {active && <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 animate-pulse" />}
  </button>
));

const ColumnSelector = React.memo(({ visibleColumns, onColumnsChange }) => {
  const categories = {
    basic: "Thông tin cơ bản",
    contact: "Thông tin liên hệ",
    property: "Thông tin căn hộ",
    price: "Thông tin giá",
    status: "Trạng thái",
    note: "Ghi chú",
  };

  const getSelectionOrder = (columnKey) => {
    const index = visibleColumns.indexOf(columnKey);
    return index === -1 ? null : index + 1;
  };

  const toggleColumn = useCallback(
    (columnKey) => {
      if (visibleColumns.includes(columnKey)) {
        if (visibleColumns.length > 1) {
          onColumnsChange(visibleColumns.filter((k) => k !== columnKey));
        }
      } else {
        if (visibleColumns.length < 7) {
          onColumnsChange([...visibleColumns, columnKey]);
        }
      }
    },
    [visibleColumns, onColumnsChange]
  );

  const resetToDefault = useCallback(() => onColumnsChange(DEFAULT_VISIBLE_COLUMNS), [onColumnsChange]);

  const renderSelectedColumns = () => {
    if (visibleColumns.length === 0) return null;
    return (
      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-3">Thứ tự hiển thị trong bảng:</h4>
        <div className="flex flex-wrap gap-2">
          {visibleColumns.map((columnKey, index) => {
            const column = ALL_COLUMNS.find((col) => col.key === columnKey);
            if (!column) return null;
            return (
              <div
                key={columnKey}
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-200 shadow-sm"
              >
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-lg">{column.icon}</span>
                <span className="text-sm font-medium text-gray-900">{column.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-blue-600 mt-2">* Thứ tự này sẽ áp dụng trong bảng (trái → phải)</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎛️</span>
          Cấu hình hiển thị cột ({visibleColumns.length}/7)
        </h3>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">Chọn tối đa 7 cột để hiển thị trong bảng dữ liệu</p>
          <button
            onClick={resetToDefault}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Đặt lại mặc định
          </button>
        </div>

        {renderSelectedColumns()}

        {Object.entries(categories).map(([categoryKey, categoryLabel]) => {
          const categoryColumns = ALL_COLUMNS.filter((col) => col.category === categoryKey);
          if (categoryColumns.length === 0) return null;

          return (
            <div key={categoryKey} className="mb-8">
              <h4 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                {categoryLabel}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryColumns.map((column) => {
                  const isSelected = visibleColumns.includes(column.key);
                  const canToggle = isSelected || visibleColumns.length < 7;
                  const selectionOrder = getSelectionOrder(column.key);
                  return (
                    <button
                      key={column.key}
                      onClick={() => canToggle && toggleColumn(column.key)}
                      disabled={!canToggle}
                      className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : canToggle
                          ? "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{column.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                            {column.label}
                          </div>
                          <div className={`text-xs ${isSelected ? "text-blue-600" : "text-gray-500"}`}>
                            {column.key}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {selectionOrder}
                            </div>
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ============== Báo cáo hôm nay ============== */
const TodayReport = React.memo(() => {
  const [payload, setPayload] = useState(() => loadPayload());
  const todayLeads = useMemo(() => getTodayLeads(payload), [payload]);

  // Cho phép refresh khi LS thay đổi ở tab khác
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LS_KEY) setPayload(loadPayload());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!payload) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
        <div className="text-gray-400 text-4xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Chưa có dữ liệu</h3>
        <p className="text-gray-600">Vui lòng tải dữ liệu trước khi xem báo cáo</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Báo cáo hôm nay ({new Date().toLocaleDateString("vi-VN")})
        </h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl text-blue-600 mb-2">📞</div>
            <div className="text-2xl font-bold text-blue-900">{todayLeads.length}</div>
            <div className="text-sm text-blue-700">Căn có tương tác</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-4 border border-emerald-200">
            <div className="text-2xl text-emerald-600 mb-2">💬</div>
            <div className="text-2xl font-bold text-emerald-900">
              {todayLeads.reduce((sum, lead) => sum + lead.todayNotes, 0)}
            </div>
            <div className="text-sm text-emerald-700">Tổng ghi chú</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-xl p-4 border border-amber-200">
            <div className="text-2xl text-amber-600 mb-2">🎯</div>
            <div className="text-2xl font-bold text-amber-900">
              {todayLeads.filter((lead) => lead.nhuCau && lead.nhuCau !== "—").length}
            </div>
            <div className="text-sm text-amber-700">Có nhu cầu rõ</div>
          </div>
        </div>

        {todayLeads.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">😴</div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Chưa có hoạt động nào hôm nay</h4>
            <p className="text-gray-600">Các cuộc gọi và ghi chú mới sẽ xuất hiện ở đây</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mã Căn</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Chủ Nhà</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nhu Cầu</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SĐT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ghi Chú</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Số Lần</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayLeads.map((lead, index) => (
                    <tr key={lead.canHoId || index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{lead.maCan}</div>
                        {lead.phanKhu && <div className="text-xs text-gray-500">{lead.phanKhu}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{lead.hoTen || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            lead.nhuCau === "Bán"
                              ? "bg-blue-100 text-blue-800"
                              : lead.nhuCau === "Thuê"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.nhuCau || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{lead.sdt1 || "—"}</div>
                        {lead.sdt2 && <div className="text-xs text-gray-500">{lead.sdt2}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={lead.lastNote}>
                          {lead.lastNote || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                          {lead.todayNotes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ============== Cloud (Firebase) ============== */
function CloudSync({ onLoaded }) {
  const [user, setUser] = useState(() => auth.currentUser);
  const [tenantId, setTenantId] = useState(() => localStorage.getItem(TENANT_LS_KEY) || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!tenantId && user?.uid) {
      setTenantId(user.uid);
      localStorage.setItem(TENANT_LS_KEY, user.uid);
    }
  }, [user, tenantId]);

  const doAnonLogin = async () => {
    try {
      await signInAnonymously(auth);
      toast({ title: "Đăng nhập ẩn danh thành công", type: "success" });
    } catch (e) {
      toast({ title: "Đăng nhập thất bại", message: String(e.message || e), type: "error" });
    }
  };

  const handleSyncAll = async (drop = false) => {
    try {
      if (!tenantId) {
        toast({ title: "Thiếu Tenant ID", message: "Nhập Tenant ID trước khi đồng bộ", type: "warning" });
        return;
    }
      setLoading(true);
      const payload = loadPayload();
      if (!payload) {
        toast({ title: "Không có dữ liệu", message: "Chưa có payload trong trình duyệt", type: "warning" });
        return;
      }
      const res = await syncAllToFirebase(tenantId, payload, { dropBeforeWrite: drop });
      toast({
        title: drop ? "Xoá & đồng bộ thành công" : "Đồng bộ thành công",
        message: `Căn: ${res.canHo} • Chủ: ${res.chuNha} • Liên kết: ${res.links}`,
        type: "success",
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Đồng bộ thất bại", message: String(e.message || e), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAll = async () => {
    try {
      if (!tenantId) {
        toast({ title: "Thiếu Tenant ID", message: "Nhập Tenant ID trước khi tải", type: "warning" });
        return;
      }
      setLoading(true);

      const [canHoSnap, chuNhaSnap, linksSnap] = await Promise.all([
        getDocs(collection(db, `tenants/${tenantId}/canHo`)),
        getDocs(collection(db, `tenants/${tenantId}/chuNha`)),
        getDocs(collection(db, `tenants/${tenantId}/links`)),
      ]);

      const canHo = {};
      canHoSnap.forEach((d) => (canHo[d.id] = d.data()));

      const chuNha = {};
      chuNhaSnap.forEach((d) => (chuNha[d.id] = d.data()));

      const chuNha_canHo = [];
      linksSnap.forEach((d) => {
        const data = d.data();
        if (data?.canHoId && data?.chuNhaId) {
          chuNha_canHo.push({
            canHoId: data.canHoId,
            chuNhaId: data.chuNhaId,
            isPrimaryContact: !!data.isPrimaryContact,
            role: data.role || "Chủ sở hữu",
          });
        }
      });

      const payload = { canHo, chuNha, chuNha_canHo };
      // Trả sang App để App setPayload + tự lưu LS
      onLoaded?.(payload);

      toast({ title: "Tải dữ liệu thành công", message: "Đã nạp dữ liệu từ Firebase", type: "success" });
    } catch (e) {
      console.error(e);
      toast({ title: "Tải thất bại", message: String(e.message || e), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">☁️</span>
          Đồng bộ Firebase
        </h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Auth */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Tenant ID</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value.trim());
                localStorage.setItem(TENANT_LS_KEY, e.target.value.trim());
              }}
              placeholder="Mặc định dùng UID sau khi đăng nhập ẩn danh"
            />
            <p className="text-xs text-gray-500 mt-2">
              Gợi ý: dùng <b>UID user</b> (đăng nhập ẩn danh để lấy UID), hoặc một chuỗi cố định như <code>demo</code>.
            </p>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-2">Trạng thái</div>
            <div className="px-3 py-2 rounded-lg border bg-gray-50 text-sm">
              {user ? (
                <div>
                  Đã đăng nhập: <span className="font-mono">{user.uid}</span>
                </div>
              ) : (
                <div>Chưa đăng nhập</div>
              )}
            </div>
          </div>

          {!user && (
            <button
              onClick={doAnonLogin}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Đăng nhập ẩn danh
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => handleSyncAll(false)}
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold shadow"
          >
            {loading ? "Đang chạy..." : "Đồng bộ toàn bộ lên Firebase"}
          </button>

        <button
            onClick={handleFetchAll}
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold shadow"
          >
            {loading ? "Đang tải..." : "Tải toàn bộ từ Firebase"}
          </button>

          <button
            onClick={() => handleSyncAll(true)}
            disabled={loading}
            className="px-4 py-3 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-sm font-semibold shadow"
          >
            {loading ? "Đang xoá & đồng bộ..." : "Xoá sạch & đồng bộ lên Firebase"}
          </button>
        </div>

        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          * App của bạn đã đồng bộ **theo thời gian thực** khi chạy (đọc/ghi). Tab này hỗ trợ
          <b>đẩy dữ liệu hàng loạt</b> và <b>tải về toàn bộ</b> để khởi tạo/khôi phục nhanh.
        </div>
      </div>
    </div>
  );
}

/* ============== Settings Page ============== */
export default function SettingsPage({ onLoaded }) {
  const [activeMenu, setActiveMenu] = useState("upload");
  const [visibleColumns, setVisibleColumns] = useState(() => loadVisibleColumns());

  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  const menuItems = [
    { key: "upload", icon: "📤", title: "Tải dữ liệu", description: "Nhập, xuất và quản lý dữ liệu từ Excel/CSV" },
    { key: "columns", icon: "🎛️", title: "Cấu hình cột", description: "Chọn các cột hiển thị trong bảng (tối đa 7 cột)" },
    { key: "report", icon: "📊", title: "Báo cáo", description: "Xem báo cáo hoạt động và nhu cầu hôm nay" },
    { key: "cloud", icon: "☁️", title: "Đồng bộ Firebase", description: "Đăng nhập ẩn danh, chọn Tenant và đồng bộ" },
  ];

  const handleMenuClick = useCallback((menuKey) => setActiveMenu(menuKey), []);
  const handleColumnsChange = useCallback((newColumns) => setVisibleColumns(newColumns), []);

  const renderContent = () => {
    switch (activeMenu) {
      case "upload":
        return <UploadData onLoaded={onLoaded} />;
      case "columns":
        return <ColumnSelector visibleColumns={visibleColumns} onColumnsChange={handleColumnsChange} />;
      case "report":
        return <TodayReport />;
      case "cloud":
        return <CloudSync onLoaded={onLoaded} />;
      default:
        return <UploadData onLoaded={onLoaded} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 -mx-4 -my-6 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Cài Đặt & Báo Cáo
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Quản lý dữ liệu, cấu hình hiển thị và đồng bộ đám mây
          </p>
        </div>

        {/* Menu */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <MenuCard
              key={item.key}
              icon={item.icon}
              title={item.title}
              description={item.description}
              onClick={() => handleMenuClick(item.key)}
              active={activeMenu === item.key}
            />
          ))}
        </div>

        {/* Content */}
        <div className="animate-fadeIn">{renderContent()}</div>

        {/* Footer Info */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200 p-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <span className="text-2xl">💾</span>
            <span className="text-sm">
              Dữ liệu đang lưu cục bộ trong trình duyệt. Cấu hình cột:{" "}
              <strong>{visibleColumns.length}/7</strong> cột được chọn.
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
