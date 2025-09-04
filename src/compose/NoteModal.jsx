import React from "react";

export default function NoteModal({
  row,
  onClose,
  onSave,
  onPrev,
  onNext,
  isFirst,
  isLast,
  allRows = [],
  onJumpToRow,
  onCreateUnitByMaCan,
  onDeleteOwner, // ({ linkId, canHoId, chuNhaId }) => void
}) {
  const r = row ?? {};

  // ======= States: base fields (có thể sửa khi _isNew/_editableBase) =======
  const [maCan, setMaCan] = React.useState(r.maCan || "");
  const [phanKhu, setPhanKhu] = React.useState(r.phanKhu || inferPhanKhu(r.maCan));
  const [huong, setHuong] = React.useState(r.huong || "");
  const [loaiCan, setLoaiCan] = React.useState(r.loaiCan || "");
  const [dienTich, setDienTich] = React.useState(r.dienTich ?? "");

  // ======= States: CRM =======
  const [gia, setGia] = React.useState(r.gia ?? "");
  const [noteInput, setNoteInput] = React.useState("");
  const [nhuCau, setNhuCau] = React.useState(r.nhuCau || "");
  const [giaTot, setGiaTot] = React.useState(!!r.giaTot);
  const [sdt2, setSdt2] = React.useState(r.sdt2 || "");
  const [editingSdt2, setEditingSdt2] = React.useState(false);

  // Panel thêm căn theo mã
  const [newMaCan, setNewMaCan] = React.useState("");

  // Popup xác nhận xóa chủ hộ
  const [showConfirm, setShowConfirm] = React.useState(false);

  // ======= Timeline =======
  const timeline = Array.isArray(r.ghiChu) ? [...r.ghiChu] : [];
  timeline.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || String(b.date).localeCompare(String(a.date)));
  const [showAll, setShowAll] = React.useState(false);
  const listShow = showAll ? timeline : timeline.slice(0, 2);

  // Các căn khác cùng SĐT
  const phoneKey = (r.sdt1 || r.sdt2 || "").trim();
  const related = React.useMemo(() => {
    if (!phoneKey || !Array.isArray(allRows)) return [];
    return allRows.filter(
      (x) =>
        x &&
        (x.sdt1 === phoneKey || x.sdt2 === phoneKey) &&
        (x.id ?? `${x.maCan}|${x.phanKhu}`) !== (r.id ?? `${r.maCan}|${r.phanKhu}`)
    );
  }, [allRows, phoneKey, r.id, r.maCan, r.phanKhu]);

  // Đồng bộ state khi chuyển căn trong modal
  React.useEffect(() => {
    setMaCan(r.maCan || "");
    setPhanKhu(r.phanKhu || inferPhanKhu(r.maCan));
    setHuong(r.huong || "");
    setLoaiCan(r.loaiCan || "");
    setDienTich(r.dienTich ?? "");

    setGia(r.gia ?? "");
    setNhuCau(r.nhuCau || "");
    setGiaTot(!!r.giaTot);

    setSdt2(r.sdt2 || "");
    setEditingSdt2(false);
    setNoteInput("");
  }, [
    r.maCan,
    r.phanKhu,
    r.huong,
    r.loaiCan,
    r.dienTich,
    r.gia,
    r.nhuCau,
    r.giaTot,
    r.sdt2,
    r.canHoId,
    r.chuNhaId,
  ]);

  if (!row) return null;

  const editableBase = !!(r._isNew || r._editableBase);

  // ======= Helpers =======
  function copyToClipboard(text) {
    if (!text) return;
    if (navigator?.clipboard?.writeText) navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  function buildNewNotesIfAny() {
    if (!noteInput.trim()) return r.ghiChu || [];
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const item = { date: `${yyyy}-${mm}-${dd}`, ts: now.getTime(), content: noteInput.trim() };
    return [item, ...(Array.isArray(r.ghiChu) ? r.ghiChu : [])];
  }

  function handleSave() {
    const payload = {
      ...r,
      ...(editableBase
        ? {
            maCan: (maCan || "").trim(),
            phanKhu: (phanKhu || "").trim() || inferPhanKhu(maCan),
            huong: (huong || "").trim(),
            loaiCan: (loaiCan || "").trim(),
            dienTich: normalizeNumber(dienTich),
          }
        : {}),
      gia: gia === "" ? null : Number(String(gia).replace(",", ".")),
      nhuCau: nhuCau || null,
      giaTot: !!giaTot,
      ghiChu: buildNewNotesIfAny(),
      sdt2: sdt2 || null,
    };
    onSave?.(payload);
    setNoteInput("");
    setEditingSdt2(false);
  }

  // Thêm căn theo mã, copy chủ hộ hiện tại
  async function handleAddNewUnit() {
    const v = (newMaCan || "").trim();
    if (!v) return;
    const phone = phoneKey || null;
    const owner = r.tenNK || "";
    try {
      const created = await Promise.resolve(onCreateUnitByMaCan?.(v, phone, owner));
      setNewMaCan("");
      if (created) onJumpToRow?.(created);
    } catch (e) {
      console.error("Create unit error:", e);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 md:p-4 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full w-7 h-7 flex items-center justify-center transition-all"
          >
            ✕
          </button>
          <h2 className="text-lg md:text-xl font-bold pr-10">Căn hộ {r.maCan}</h2>
        </div>

        {/* Body */}
        <div className="flex-1 p-3 md:p-4 min-h-0">
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Cột 1: Thông tin + Liên hệ + Căn khác + (base fields editable) */}
            <div className="space-y-3">
              {/* Thông tin căn */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">🏠 Thông tin căn</h3>

                {!editableBase ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <InfoCompact label="Mã căn" value={r.maCan} />
                    <InfoCompact label="Phân khu" value={r.phanKhu} />
                    <InfoCompact label="Hướng" value={r.huong} />
                    <InfoCompact label="Loại căn" value={r.loaiCan} />
                    <InfoCompact label="Diện tích" value={r.dienTich ? `${r.dienTich}m²` : "-"} />
                    <InfoCompact label="Tên NK" value={r.tenNK} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Field label="Mã căn">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={maCan}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMaCan(v);
                          if (!phanKhu) setPhanKhu(inferPhanKhu(v));
                        }}
                      />
                    </Field>
                    <Field label="Phân khu">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={phanKhu}
                        onChange={(e) => setPhanKhu(e.target.value)}
                        placeholder={inferPhanKhu(maCan) || "VD: VT"}
                      />
                    </Field>
                    <Field label="Hướng">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={huong}
                        onChange={(e) => setHuong(e.target.value)}
                        placeholder="VD: ĐB / N / TB..."
                      />
                    </Field>
                    <Field label="Loại căn">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={loaiCan}
                        onChange={(e) => setLoaiCan(e.target.value)}
                        placeholder="Đơn lập / Song lập…"
                      />
                    </Field>
                    <Field label="Diện tích (m²)">
                      <input
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={dienTich}
                        onChange={(e) => setDienTich(e.target.value)}
                        placeholder="VD: 409.5"
                        inputMode="decimal"
                      />
                    </Field>
                    <InfoCompact label="Tên NK" value={r.tenNK} />
                  </div>
                )}
              </div>

              {/* Liên hệ */}
              <div className="bg-blue-50 rounded-lg p-3">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">📞 Liên hệ</h3>
                {/* SĐT 1 */}
                <div className="mb-2">
                  <div className="text-xs text-gray-600 mb-1">SĐT 1</div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-mono">{r.sdt1 || "Chưa có"}</span>
                    {r.sdt1 && (
                      <button
                        className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                        onClick={() => copyToClipboard(r.sdt1)}
                      >
                        📋
                      </button>
                    )}
                  </div>
                </div>
                {/* SĐT 2 */}
                <div>
                  <div className="text-xs text-gray-600 mb-1">SĐT 2</div>
                  {!editingSdt2 ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-mono">{sdt2 || "Chưa có"}</span>
                      {sdt2 && (
                        <button
                          className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                          onClick={() => copyToClipboard(sdt2)}
                        >
                          📋
                        </button>
                      )}
                      <button
                        className="px-2 py-1 text-xs rounded border text-blue-600 hover:bg-blue-50"
                        onClick={() => setEditingSdt2(true)}
                      >
                        ✏️
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        className="flex-1 border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                        value={sdt2}
                        onChange={(e) => setSdt2(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={() => setEditingSdt2(false)}
                      >
                        ✓
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                        onClick={() => {
                          setSdt2(r.sdt2 || "");
                          setEditingSdt2(false);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Căn khác + Thêm căn mới */}
              {(phoneKey || related.length > 0) && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">🏷️ Căn khác của chủ hộ</h3>
                    {phoneKey && <span className="text-xs text-gray-500">SĐT: {phoneKey}</span>}
                  </div>

                  {related.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {related.map((it) => (
                        <button
                          key={it.id || `${it.maCan}|${it.phanKhu}`}
                          onClick={() => onJumpToRow?.(it)}
                          className="px-2.5 py-1 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          title={`Tới ${it.maCan}`}
                        >
                          {it.maCan}
                          {it.phanKhu ? ` · ${it.phanKhu}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mb-3">Chưa ghi nhận căn khác.</div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nhập mã căn để thêm mới (VD: VT 7)"
                      value={newMaCan}
                      onChange={(e) => setNewMaCan(e.target.value)}
                    />
                    <button
                      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                      onClick={handleAddNewUnit}
                    >
                      Thêm
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    * Căn mới sẽ copy tên/SĐT chủ hộ hiện tại; cho phép chỉnh sửa Hướng, Diện tích, Loại căn…
                  </p>
                </div>
              )}
            </div>

            {/* Cột 2: Form cập nhật */}
            <div className="space-y-3">
              <div className="bg-orange-50 rounded-lg p-3 h-full">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">⚙️ Cập nhật</h3>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giá (tỷ VNĐ)</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={gia}
                    onChange={(e) => setGia(e.target.value)}
                    placeholder="7.8"
                    type="number"
                    step="0.1"
                  />
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nhu cầu</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    value={nhuCau}
                    onChange={(e) => setNhuCau(e.target.value)}
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Bán">Bán</option>
                    <option value="Thuê">Thuê</option>
                    <option value="KNC">KNC</option>
                    <option value="CNM">CNM</option>
                    <option value="GLS">GLS</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border hover:bg-green-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giaTot}
                    onChange={(e) => setGiaTot(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium">💰 Giá tốt</span>
                </label>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú mới</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Nhập nội dung..."
                  />
                </div>
              </div>
            </div>

            {/* Cột 3: Lịch sử */}
            <div className="bg-purple-50 rounded-lg p-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="font-semibold text-gray-800 text-sm">📝 Lịch sử ({timeline.length})</h3>
                {timeline.length > 2 && (
                  <button
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? "Thu gọn" : "Xem tất cả"}
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {listShow.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <div className="text-3xl mb-1">📝</div>
                    <p className="text-xs">Chưa có ghi chú</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listShow.map((n, i) => (
                      <div key={i} className="bg-white rounded-lg p-2 border border-gray-200">
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-purple-700 mb-1">{formatVN(n.date)}</div>
                            <p className="text-xs text-gray-800 leading-relaxed break-words">{n.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Nút xoá chủ hộ: mở popup xác nhận */}
            <button
              onClick={() => setShowConfirm(true)}
              className="px-3 py-2 rounded-lg border text-red-600 border-red-200 hover:bg-red-50"
            >
              Xóa chủ hộ
            </button>

            <button
              onClick={onPrev}
              disabled={isFirst}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-all ${
                isFirst
                  ? "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "hover:bg-gray-100 text-gray-700 border border-gray-300"
              }`}
            >
              ◀ <span className="hidden sm:inline">Trước</span>
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Lưu
            </button>

            <button
              onClick={onNext}
              disabled={isLast}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-all ${
                isLast
                  ? "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400"
                  : "hover:bg-gray-100 text-gray-700 border border-gray-300"
              }`}
            >
              <span className="hidden sm:inline">Sau</span> ▶
            </button>
          </div>
        </div>
      </div>

      {/* ===== Popup xác nhận xoá chủ hộ (gỡ liên kết hiện tại) ===== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-3">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xóa chủ hộ?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Thao tác này chỉ <b>gỡ liên kết</b> chủ hộ khỏi căn <b>{r.maCan}</b>. Các căn khác của
              chủ hộ sẽ được giữ nguyên.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onDeleteOwner?.({ linkId: r.id, canHoId: r.canHoId, chuNhaId: r.chuNhaId });
                  onClose?.();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== small building blocks ======
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-semibold mb-1">{label}</div>
      {children}
    </div>
  );
}

function InfoCompact({ label, value }) {
  return (
    <div className="bg-white rounded p-2 border border-gray-200">
      <div className="text-xs text-gray-500 font-semibold mb-0.5 truncate">{label}</div>
      <div className="text-xs font-medium text-gray-800 truncate" title={value || "Chưa có"}>
        {value || "-"}
      </div>
    </div>
  );
}

function formatVN(d) {
  if (!d) return "";
  const [y, m, dd] = String(d).split("-");
  return `${dd}/${m}/${y}`;
}

function inferPhanKhu(code) {
  if (!code) return "";
  const m = String(code).trim().match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : "";
}

function normalizeNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
