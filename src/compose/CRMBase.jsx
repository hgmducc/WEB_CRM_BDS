/**
 * File: src/compose/CRMBase.jsx
 * CRM listing + filters + search + sort + Note modal - Optimized
 */

import React, { useMemo, useState, useCallback } from "react";
import NoteModal from "./NoteModal";

/** Chuẩn hoá so sánh: bỏ dấu + lowercase */
const vnorm = (input = "") => {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
};

// Utility functions (memoized outside component)
const fmtArea = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n.toLocaleString("vi-VN")} m²`;
};

const fmtGia = (v) => {
  const n = Number(v);
  if (!n && n !== 0) return "";
  return `${n.toLocaleString("vi-VN")} tỷ`;
};

const modernBadge = (kind) => {
  const styles = {
    success: "bg-gradient-to-r from-emerald-100 to-green-50 text-emerald-700 ring-1 ring-emerald-200/50",
    primary: "bg-gradient-to-r from-blue-100 to-cyan-50 text-blue-700 ring-1 ring-blue-200/50",
    warning: "bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-700 ring-1 ring-amber-200/50",
    info: "bg-gradient-to-r from-teal-100 to-cyan-50 text-teal-700 ring-1 ring-teal-200/50",
    purple: "bg-gradient-to-r from-violet-100 to-purple-50 text-violet-700 ring-1 ring-violet-200/50",
    danger: "bg-gradient-to-r from-rose-100 to-red-50 text-rose-700 ring-1 ring-rose-200/50",
    default: "bg-gradient-to-r from-slate-100 to-gray-50 text-slate-700 ring-1 ring-slate-200/50",
  };
  return `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
    styles[kind] || styles.default
  }`;
};

const getNhuCauColor = (nhuCau) => {
  const colorMap = {
    Bán: "primary",
    Thuê: "warning", 
    KNC: "info",
    CNM: "purple",
    GLS: "danger",
  };
  return colorMap[nhuCau] || "default";
};

const getNhuCauIcon = (nhuCau) => {
  const iconMap = {
    Bán: "🔵",
    Thuê: "🟡",
    KNC: "🟢", 
    CNM: "🟣",
    GLS: "🔴",
  };
  return iconMap[nhuCau] || "⚫";
};

// Memoized Components
const Th = React.memo(({ children, className = "", center = false }) => (
  <th className={`px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap ${center ? 'text-center' : 'text-left'} ${className}`}>
    {children}
  </th>
));

const Td = React.memo(({ children, className = "", center = false }) => (
  <td className={`px-4 py-4 align-middle ${center ? 'text-center' : ''} ${className}`}>{children}</td>
));

const Select = React.memo(({ label, value, onChange, children, icon }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
      <span className="text-base">{icon}</span>
      {label}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none h-12 rounded-2xl border-0 bg-white/90 backdrop-blur-sm px-4 pr-12 text-sm font-medium text-gray-900 shadow-lg ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-300 hover:shadow-xl"
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  </div>
));

const InfoCard = React.memo(({ icon, label, value, highlight = false }) => (
  <div className={`p-4 rounded-2xl border transition-all duration-200 ${
    highlight 
      ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-sm" 
      : "bg-gradient-to-br from-gray-50/70 to-white/50 border-gray-200/70"
  }`}>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      {highlight && <span className="text-emerald-500 text-xs">⭐</span>}
    </div>
    <div className={`font-bold text-sm ${highlight ? "text-emerald-700" : "text-gray-900"}`}>
      {value || "Chưa cập nhật"}
    </div>
  </div>
));

const ActionButton = React.memo(({ onClick, children, size = "sm" }) => {
  const sizeClasses = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base"
  };
  
  return (
    <button
      onClick={onClick}
      className={`group flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${sizeClasses[size]}`}
    >
      {children}
    </button>
  );
});

const SearchBar = React.memo(({ query, onChange }) => (
  <div className="relative group">
    <input
      value={query}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tìm kiếm mã căn, tên chủ, ghi chú, SĐT..."
      className="w-full h-14 rounded-3xl border-0 bg-white/90 backdrop-blur-sm px-6 pl-16 text-gray-900 placeholder-gray-500 shadow-lg ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-300 hover:shadow-xl focus:shadow-2xl group-hover:shadow-xl"
    />
    <div className="absolute left-6 top-1/2 -translate-y-1/2 transition-colors duration-200">
      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    {query && (
      <button
        onClick={() => onChange("")}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
));

const EmptyState = React.memo(() => (
  <div className="text-center py-20">
    <div className="mx-auto w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">Không tìm thấy kết quả</h3>
    <p className="text-gray-500 max-w-sm mx-auto">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm để tìm thấy những gì bạn đang tìm kiếm</p>
  </div>
));

// Table Row Component
const TableRow = React.memo(({ row, idx, hasGia, onClick }) => {
  const displayName = row.tenNK || row.hoTen || row.tenChuNha || "";
  
  return (
    <tr className="hover:bg-blue-50/30 transition-all duration-200 group">
      <Td center>
        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700 group-hover:from-blue-200 group-hover:to-indigo-200 transition-all duration-200">
          {idx + 1}
        </div>
      </Td>
      <Td center>
        <div className="font-bold text-gray-900">{row.maCan}</div>
        {row.phanKhu && <div className="text-xs text-gray-500 font-medium">{row.phanKhu}</div>}
      </Td>
      <Td center>
        <div className="font-medium text-gray-800">{displayName || "—"}</div>
      </Td>
      <Td center>
        <div className="font-semibold text-gray-700">{fmtArea(row.dienTich)}</div>
      </Td>
      <Td center>
        <div className="text-gray-600">{row.huong || "—"}</div>
      </Td>
      {hasGia && (
        <Td center>
          <div className="flex items-center justify-center gap-2">
            <span className={modernBadge(row.giaTot ? "success" : "default")}>
              {fmtGia(row.gia)}
            </span>
            {row.giaTot && <span className="text-emerald-500">⭐</span>}
          </div>
        </Td>
      )}
      <Td center>
        <span className={modernBadge(getNhuCauColor(row.nhuCau))}>
          {getNhuCauIcon(row.nhuCau)} {row.nhuCau || ""}
        </span>
      </Td>
      <Td center>
        <div className="max-w-xs">
          <p className="truncate text-gray-600 text-sm" title={row.noteText || ""}>
            {row.noteText || "Chưa có ghi chú"}
          </p>
        </div>
      </Td>
      <Td center>
        <ActionButton onClick={onClick} size="sm">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Ghi
        </ActionButton>
      </Td>
    </tr>
  );
});

// Mobile Card Component  
const MobileCard = React.memo(({ row, idx, hasGia, onClick }) => {
  const displayName = row.tenNK || row.hoTen || row.tenChuNha || "";
  
  return (
    <div className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-2xl ring-1 ring-gray-200/50 hover:ring-blue-200/50 transition-all duration-300 overflow-hidden transform hover:scale-[1.02]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
              {idx + 1}
            </div>
            <div>
              <div className="font-bold text-xl text-gray-900">{row.maCan}</div>
              {row.phanKhu && (
                <div className="text-sm text-gray-600 font-medium">{row.phanKhu}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {row.giaTot && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-100 to-green-50 text-emerald-700 rounded-full text-xs font-bold shadow-sm">
                <span>⭐</span>
                <span>Giá tốt</span>
              </div>
            )}
            <span className={modernBadge(getNhuCauColor(row.nhuCau))}>
              {getNhuCauIcon(row.nhuCau)} {row.nhuCau}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-5">
          <h3 className="font-semibold text-gray-800 text-lg mb-1">{displayName || "—"}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <InfoCard icon="📐" label="Diện tích" value={fmtArea(row.dienTich)} />
          <InfoCard icon="🧭" label="Hướng" value={row.huong} />
          {hasGia && (
            <InfoCard
              icon="💰"
              label="Giá"
              value={fmtGia(row.gia)}
              highlight={row.giaTot}
            />
          )}
        </div>

        {/* Note Section */}
        <div className="bg-gradient-to-br from-gray-50/70 to-blue-50/30 rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-blue-600">💬</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Nội dung trao đổi
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {row.noteText || "Chưa có ghi chú nào"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <ActionButton onClick={onClick} size="md">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Ghi chú CRM
        </ActionButton>
      </div>
    </div>
  );
});

export function CRMBase({
  mode = "all",
  data = [],
  onSave,
  onCreateUnitByMaCan,
  onDeleteOwner,
}) {
  // Memoized initial data
  const initial = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Check if has price data
  const hasGia = useMemo(
    () => initial.some((r) => 
      r.gia !== undefined && 
      r.gia !== null && 
      !Number.isNaN(Number(r.gia))
    ),
    [initial]
  );

  // State management
  const [khu, setKhu] = useState("all");
  const [nhuCau, setNhuCau] = useState(mode === "all" ? "all" : mode);
  const [sortBy, setSortBy] = useState(hasGia ? "gia" : "maCan");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Memoized options
  const phanKhuOptions = useMemo(() => {
    const s = new Set(initial.map((x) => x.phanKhu).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [initial]);

  // Memoized filtered and sorted data
  const filtered = useMemo(() => {
    const q = vnorm(query);

    let list = initial.filter((x) => {
      if (!q) return true;
      
      const name = x.tenNK || x.hoTen || x.tenChuNha || "";
      const fields = [
        x.maCan,
        name,
        x.noteText,
        x.ghiChu,
        x.sdt1,
        x.sdt2,
      ]
        .filter(Boolean)
        .map((t) => vnorm(t))
        .join(" ");
      return fields.includes(q);
    });

    if (khu !== "all") {
      list = list.filter((x) => x.phanKhu === khu);
    }

    const nc = mode === "all" ? nhuCau : mode;
    const ncNorm = vnorm(nc);
    if (nc !== "all") {
      list = list.filter((x) => vnorm(x.nhuCau) === ncNorm);
    }

    const sorters = {
      gia: (a, b) => (Number(a.gia) || 0) - (Number(b.gia) || 0),
      dienTich: (a, b) => (Number(a.dienTich) || 0) - (Number(b.dienTich) || 0),
      giaTot: (a, b) => (b.giaTot === true) - (a.giaTot === true),
      maCan: (a, b) => String(a.maCan || "").localeCompare(String(b.maCan || "")),
    };

    return [...list].sort(sorters[sortBy] || sorters.maCan);
  }, [initial, khu, nhuCau, sortBy, query, mode]);

  // Navigation handlers
  const goPrev = useCallback(() => {
    if (selectedIdx <= 0) return;
    const i = selectedIdx - 1;
    setSelected(filtered[i]);
    setSelectedIdx(i);
  }, [selectedIdx, filtered]);

  const goNext = useCallback(() => {
    if (selectedIdx >= filtered.length - 1) return;
    const i = selectedIdx + 1;
    setSelected(filtered[i]);
    setSelectedIdx(i);
  }, [selectedIdx, filtered]);

  const jumpToRow = useCallback((targetRow) => {
    if (!targetRow) return;
    const key = targetRow.id || `${targetRow.maCan}-${targetRow.chuNhaId}`;
    let i = filtered.findIndex(
      (r) =>
        (r.id || `${r.maCan}-${r.chuNhaId}`) === key ||
        (r.canHoId === targetRow.canHoId && r.chuNhaId === targetRow.chuNhaId)
    );
    if (i === -1) {
      setSelected(targetRow);
      setSelectedIdx(-1);
    } else {
      setSelected(filtered[i]);
      setSelectedIdx(i);
    }
  }, [filtered]);

  const handleRowClick = useCallback((row, idx) => {
    setSelected(row);
    setSelectedIdx(idx);
  }, []);

  const handleModalSave = useCallback((u) => {
    onSave?.(u);
    setSelected(prev => ({ ...prev, ...u }));
  }, [onSave]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Search + Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar query={query} onChange={setQuery} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Phân khu" value={khu} onChange={setKhu} icon="🏢">
              {phanKhuOptions.map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "Tất cả phân khu" : v}
                </option>
              ))}
            </Select>

            <Select
              label="Nhu cầu"
              value={mode === "all" ? nhuCau : mode}
              onChange={setNhuCau}
              icon="🎯"
            >
              <option value="all">Tất cả nhu cầu</option>
              <option value="Bán">🔵 Bán</option>
              <option value="Thuê">🟡 Thuê</option>
              <option value="KNC">🟢 KNC</option>
              <option value="CNM">🟣 CNM</option>
              <option value="GLS">🔴 GLS</option>
            </Select>

            <Select label="Sắp xếp" value={sortBy} onChange={setSortBy} icon="📊">
              {hasGia && <option value="gia">💰 Theo giá</option>}
              <option value="dienTich">📐 Theo diện tích</option>
              <option value="maCan">🏠 Theo mã căn</option>
              <option value="giaTot">⭐ Giá tốt trước</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block mb-8">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl ring-1 ring-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 via-blue-50/30 to-indigo-50/30">
                        <Th className="w-16" center>#</Th>
                        <Th center>🏠<br />Mã Căn</Th>
                        <Th center>👤<br />Tên NK</Th>
                        <Th center>📐<br />Diện tích</Th>
                        <Th center>🧭<br />Hướng</Th>
                        {hasGia && <Th center>💰<br />Giá</Th>}
                        <Th center>🎯<br />Nhu cầu</Th>
                        <Th center>💬<br />Trao đổi</Th>
                        <Th className="w-20" center></Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((row, idx) => (
                        <TableRow
                          key={row.id || `${row.maCan}-${idx}`}
                          row={row}
                          idx={idx}
                          hasGia={hasGia}
                          onClick={() => handleRowClick(row, idx)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet Cards */}
            <div className="lg:hidden space-y-6">
              {filtered.map((row, idx) => (
                <MobileCard
                  key={row.id || `${row.maCan}-${idx}`}
                  row={row}
                  idx={idx}
                  hasGia={hasGia}
                  onClick={() => handleRowClick(row, idx)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Modal ghi CRM */}
      {selected && (
        <NoteModal
          key={`${selected.canHoId || selected.maCan}-${selected.chuNhaId || ""}`}
          row={selected}
          allRows={initial}
          onClose={() => setSelected(null)}
          onSave={handleModalSave}
          onPrev={goPrev}
          onNext={goNext}
          isFirst={selectedIdx <= 0}
          isLast={selectedIdx >= filtered.length - 1}
          onJumpToRow={jumpToRow}
          onCreateUnitByMaCan={onCreateUnitByMaCan}
          onDeleteOwner={onDeleteOwner}
        />
      )}
    </div>
  );
}