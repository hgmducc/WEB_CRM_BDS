// src/compose/CRMBase.jsx (Clean header: only search + filters, no sticky)
import React from "react";
import NoteModal from "./NoteModal";

export function CRMBase({
  mode = "all",
  data = [],
  onSave,
  onCreateUnitByMaCan,
  onDeleteOwner,
}) {
  // tránh cảnh báo: bọc initial bằng useMemo, chỉ đổi khi 'data' đổi
  const initial = React.useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const hasGia = React.useMemo(
    () => initial.some((r) => r.gia !== undefined && r.gia !== null && !Number.isNaN(Number(r.gia))),
    [initial]
  );

  const [khu, setKhu] = React.useState("all");
  const [nhuCau, setNhuCau] = React.useState(mode === "all" ? "all" : mode);
  const [sortBy, setSortBy] = React.useState(hasGia ? "gia" : "maCan");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [selectedIdx, setSelectedIdx] = React.useState(-1);

  const phanKhuOptions = React.useMemo(() => {
    const s = new Set(initial.map((x) => x.phanKhu).filter(Boolean));
    return ["all", ...Array.from(s)];
  }, [initial]);

  const filtered = React.useMemo(() => {
    let list = initial.filter((x) =>
      [x.maCan, x.tenNK, x.noteText].join(" ").toLowerCase().includes(query.toLowerCase())
    );
    if (khu !== "all") list = list.filter((x) => x.phanKhu === khu);
    const nc = mode === "all" ? nhuCau : mode;
    if (nc !== "all") list = list.filter((x) => (x.nhuCau || "").trim() === nc);

    const sorter =
      sortBy === "gia"
        ? (a, b) => (Number(a.gia) || 0) - (Number(b.gia) || 0)
        : sortBy === "dienTich"
        ? (a, b) => (Number(a.dienTich) || 0) - (Number(b.dienTich) || 0)
        : sortBy === "giaTot"
        ? (a, b) => (b.giaTot === true) - (a.giaTot === true)
        : (a, b) => String(a.maCan || "").localeCompare(String(b.maCan || ""));
    return [...list].sort(sorter);
  }, [initial, khu, nhuCau, sortBy, query, mode]);

  // điều hướng trong modal
  const goPrev = () => {
    if (selectedIdx <= 0) return;
    const i = selectedIdx - 1;
    setSelected(filtered[i]);
    setSelectedIdx(i);
  };
  const goNext = () => {
    if (selectedIdx >= filtered.length - 1) return;
    const i = selectedIdx + 1;
    setSelected(filtered[i]);
    setSelectedIdx(i);
  };

  // nhảy tới một row bất kỳ (được gọi từ modal)
  const jumpToRow = (targetRow) => {
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Search + Filters (no sticky header, no title/stats) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm mã căn, tên người kê, ghi chú..."
              className="w-full h-12 rounded-2xl border-0 bg-white/90 backdrop-blur-sm px-4 pl-12 text-gray-900 placeholder-gray-500 shadow-lg ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters (always visible) */}
        <div className="block transition-all duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Phân khu" value={khu} onChange={setKhu} icon="🏢">
              {phanKhuOptions.map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "Tất cả phân khu" : v}
                </option>
              ))}
            </Select>

            <Select label="Nhu cầu" value={mode === "all" ? nhuCau : mode} onChange={setNhuCau} icon="🎯">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Desktop Table */}
        <div className="hidden lg:block">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl ring-1 ring-gray-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                    <Th className="w-16 text-center">
                      <div className="flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500">#</span>
                      </div>
                    </Th>
                    <Th>
                      <div className="flex items-center gap-2">
                        🏠 <span>Mã Căn</span>
                      </div>
                    </Th>
                    <Th>
                      <div className="flex items-center gap-2">
                        👤 <span>Tên NK</span>
                      </div>
                    </Th>
                    <Th>
                      <div className="flex items-center gap-2">
                        📐 <span>Diện tích</span>
                      </div>
                    </Th>
                    <Th>
                      <div className="flex items-center gap-2">
                        🧭 <span>Hướng</span>
                      </div>
                    </Th>
                    {hasGia && (
                      <Th>
                        <div className="flex items-center gap-2">
                          💰 <span>Giá</span>
                        </div>
                      </Th>
                    )}
                    <Th>
                      <div className="flex items-center gap-2">
                        🎯 <span>Nhu cầu</span>
                      </div>
                    </Th>
                    <Th>
                      <div className="flex items-center gap-2">
                        💬 <span>Trao đổi</span>
                      </div>
                    </Th>
                    <Th className="w-20"></Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row, idx) => (
                    <tr key={row.id || `${row.maCan}-${idx}`} className="hover:bg-blue-50/30 transition-colors duration-200">
                      <Td className="text-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700">
                          {idx + 1}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-bold text-gray-900">{row.maCan}</div>
                        {row.phanKhu && <div className="text-xs text-gray-500">{row.phanKhu}</div>}
                      </Td>
                      <Td>
                        <div className="font-medium text-gray-800">{row.tenNK}</div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-gray-700">{fmtArea(row.dienTich)}</div>
                      </Td>
                      <Td>
                        <div className="text-gray-600">{row.huong}</div>
                      </Td>
                      {hasGia && (
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className={modernBadge(row.giaTot ? "success" : "default")}>
                              {fmtGia(row.gia)}
                            </span>
                            {row.giaTot && <span className="text-green-500">⭐</span>}
                          </div>
                        </Td>
                      )}
                      <Td>
                        <span className={modernBadge(getNhuCauColor(row.nhuCau))}>
                          {getNhuCauIcon(row.nhuCau)} {row.nhuCau || ""}
                        </span>
                      </Td>
                      <Td>
                        <div className="max-w-xs">
                          <p className="truncate text-gray-600 text-sm" title={row.noteText || ""}>
                            {row.noteText || "Chưa có ghi chú"}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => {
                            setSelected(row);
                            setSelectedIdx(idx);
                          }}
                          className="group flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Ghi
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Cards */}
        <div className="lg:hidden space-y-4">
          {filtered.map((row, idx) => (
            <div
              key={row.id || `${row.maCan}-${idx}`}
              className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-xl ring-1 ring-gray-200/50 hover:ring-blue-200/50 transition-all duration-300 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-xl text-gray-900">{row.maCan}</div>
                      {row.phanKhu && (
                        <div className="text-xs text-gray-500 font-medium">{row.phanKhu}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.giaTot && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
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
              <div className="p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 text-lg mb-1">{row.tenNK}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
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
                <div className="bg-gray-50/50 rounded-2xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-blue-600 text-sm">💬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Nội dung trao đổi
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {row.noteText || "Chưa có ghi chú nào"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => {
                    setSelected(row);
                    setSelectedIdx(idx);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Ghi chú CRM
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Không tìm thấy kết quả</h3>
            <p className="text-gray-500">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        )}
      </main>

      {/* Modal ghi CRM */}
      {selected && (
        <NoteModal
          key={`${selected.canHoId || selected.maCan}-${selected.chuNhaId || ""}`}
          row={selected}
          allRows={initial}
          onClose={() => setSelected(null)}
          onSave={(u) => {
            onSave?.(u);
            setSelected({ ...selected, ...u });
          }}
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

// Enhanced Components
function Th({ children, className = "" }) {
  return (
    <th className={`px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td className={`px-4 py-4 align-middle ${className}`}>
      {children}
    </td>
  );
}

function Select({ label, value, onChange, children, icon }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <span className="text-base">{icon}</span>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none h-11 rounded-2xl border-0 bg-white/90 backdrop-blur-sm px-4 pr-10 text-sm font-medium text-gray-900 shadow-lg ring-1 ring-gray-200/50 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
        >
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, highlight = false }) {
  return (
    <div className={`p-3 rounded-2xl border ${highlight ? 'bg-green-50 border-green-200' : 'bg-gray-50/50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {highlight && <span className="text-green-500 text-xs">⭐</span>}
      </div>
      <div className={`font-bold text-sm ${highlight ? 'text-green-700' : 'text-gray-900'}`}>
        {value || "Chưa cập nhật"}
      </div>
    </div>
  );
}

// Utility Functions
function fmtArea(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n)) return String(v);
  return `${n.toString().replace(".", ",")} m²`;
}

function fmtGia(v) {
  const n = Number(v);
  if (!n && n !== 0) return "";
  return `${n.toLocaleString("vi-VN")} tỷ`;
}

function modernBadge(kind) {
  const styles = {
    success: "bg-gradient-to-r from-green-100 to-green-50 text-green-700 ring-1 ring-green-200/50 shadow-sm",
    primary: "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 ring-1 ring-blue-200/50 shadow-sm",
    warning: "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 ring-1 ring-amber-200/50 shadow-sm",
    info: "bg-gradient-to-r from-teal-100 to-teal-50 text-teal-700 ring-1 ring-teal-200/50 shadow-sm",
    purple: "bg-gradient-to-r from-violet-100 to-violet-50 text-violet-700 ring-1 ring-violet-200/50 shadow-sm",
    danger: "bg-gradient-to-r from-rose-100 to-rose-50 text-rose-700 ring-1 ring-rose-200/50 shadow-sm",
    default: "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 ring-1 ring-gray-200/50 shadow-sm",
  };
  return `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm ${styles[kind] || styles.default}`;
}

function getNhuCauColor(nhuCau) {
  const colorMap = {
    "Bán": "primary",
    "Thuê": "warning",
    "KNC": "info",
    "CNM": "purple",
    "GLS": "danger",
  };
  return colorMap[nhuCau] || "default";
}

function getNhuCauIcon(nhuCau) {
  const iconMap = {
    "Bán": "🔵",
    "Thuê": "🟡",
    "KNC": "🟢",
    "CNM": "🟣",
    "GLS": "🔴",
  };
  return iconMap[nhuCau] || "⚫";
}
