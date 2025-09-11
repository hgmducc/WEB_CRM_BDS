import React from "react";
import { toast } from "../components/Toast";

/* ==== Helpers ==== */
// Parser số thập phân an toàn: nhận cả . và ,
function toNumber(val) {
  if (val === undefined || val === null || String(val).trim() === "") return undefined;
  let s = String(val).trim().replace(/[^\d.,-]/g, "");
  const dotCount = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g) || []).length;

  if (dotCount && commaCount) {
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) {
      s = s.replace(/,/g, "");
      if (dotCount > 1) s = s.replace(/\.(?=.*\.)/g, "");
    } else {
      s = s.replace(/\./g, "");
      if (commaCount > 1) s = s.replace(/,(?=.*,)/g, "");
      s = s.replace(",", ".");
    }
  } else if (commaCount) {
    s = commaCount === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (dotCount > 1) {
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}
function toInt(val) {
  const n = toNumber(val);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
function normalizeNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}
function inferPhanKhu(code) {
  if (!code) return "";
  const tok = String(code).trim().split(/\s+/)[0].toUpperCase();
  return /^TI/.test(tok) ? "ĐẢO" : tok;
}
function formatVN(d) {
  if (!d) return "";
  const [y, m, dd] = String(d).split("-");
  return `${dd}/${m}/${y}`;
}
function normalizeBaoPhi(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("50")) return "Phí 50-50";
  if (s.includes("kh")) return "Không bao phí";
  if (s.includes("ko")) return "Không bao phí";
  if (s.includes("bao")) return "Bao phí";
  const plain = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["bao phi", "khong bao phi", "phi 50-50"].includes(plain)) return v;
  return v;
}
// Chuẩn hoá số điện thoại giống UploadData
function normalizePhone(raw) {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  let digits = s.replace(/\D/g, "");
  if (/^(?:\+?84|0084)/.test(s)) digits = digits.replace(/^(\+?84|0084)/, "0");
  else if (/^84\d{8,10}$/.test(digits)) digits = "0" + digits.slice(2);
  if (digits.length === 9 && digits[0] !== "0") digits = "0" + digits;
  if (digits.length > 11) digits = digits.slice(0, 11);
  if (digits.length === 10 || digits.length === 11) return digits;
  return "";
}

// Chuẩn hoá chuỗi kiểu VN để so sánh không dấu/hoa-thường
const vnNorm = (s = "") =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const NOITHAT_OPTIONS = [
  "hoàn thiện",
  "hoàn thiện cơ bản",
  "căn thô",
  "hoàn thiện bên ngoài",
  "đang sửa",
];
const NOITHAT_CANON = NOITHAT_OPTIONS.map(vnNorm);

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
  onDeleteOwner,
}) {
  const r = row ?? {};
  const displayName = r.tenNK || r.hoTen || r.tenChuNha || "";

  /* ======= States ======= */
  const editableBase = !!(r._isNew || r._editableBase);
  const [maCan, setMaCan] = React.useState(r.maCan || "");
  const [phanKhu, setPhanKhu] = React.useState(r.phanKhu || inferPhanKhu(r.maCan));
  const [huong, setHuong] = React.useState(r.huong || "");
  const [loaiCan, setLoaiCan] = React.useState(r.loaiCan || "");
  const [dienTich, setDienTich] = React.useState(r.dienTich ?? "");

  const [gia, setGia] = React.useState(r.gia ?? "");
  const [noteInput, setNoteInput] = React.useState("");
  const [nhuCau, setNhuCau] = React.useState(r.nhuCau || "");
  const [giaTot, setGiaTot] = React.useState(!!r.giaTot);
  const [noiThat, setNoiThat] = React.useState(r.noiThat || "");
  const [soPhongNgu, setSoPhongNgu] = React.useState(r.soPhongNgu ?? r.phongNgu ?? "");
  const [baoPhi, setBaoPhi] = React.useState(r.baoPhi || "");

  // Phones
  const [sdt1, setSdt1] = React.useState(r.sdt1 || "");
  const [sdt2, setSdt2] = React.useState(r.sdt2 || "");
  const [editingPhone1, setEditingPhone1] = React.useState(false);
  const [editingPhone2, setEditingPhone2] = React.useState(false);

  // Thêm căn
  const [newMaCan, setNewMaCan] = React.useState("");

  // Xoá liên kết
  const [showConfirm, setShowConfirm] = React.useState(false);

  // Mobile
  const [activeTab, setActiveTab] = React.useState("info");

  // Timeline
  const timeline = Array.isArray(r.ghiChu) ? [...r.ghiChu] : [];
  timeline.sort(
    (a, b) => (b.ts ?? 0) - (a.ts ?? 0) || String(b.date).localeCompare(String(a.date))
  );
  const [showAll, setShowAll] = React.useState(false);
  const listShow = showAll ? timeline : timeline.slice(0, 2);

  // Căn khác cùng SĐT
  const phoneKey = (r.sdt1 || r.sdt2 || "").trim();
  const related = React.useMemo(() => {
    if (!phoneKey || !Array.isArray(allRows)) return [];
    const selfKey = r.id ?? `${r.maCan}|${r.phanKhu}`;
    return allRows.filter(
      (x) =>
        x &&
        (x.sdt1 === phoneKey || x.sdt2 === phoneKey) &&
        (x.id ?? `${x.maCan}|${x.phanKhu}`) !== selfKey
    );
  }, [allRows, phoneKey, r.id, r.maCan, r.phanKhu]);

  // Đồng bộ khi đổi row
  React.useEffect(() => {
    setMaCan(r.maCan || "");
    setPhanKhu(r.phanKhu || inferPhanKhu(r.maCan));
    setHuong(r.huong || "");
    setLoaiCan(r.loaiCan || "");
    setDienTich(r.dienTich ?? "");

    setGia(r.gia ?? "");
    setNhuCau(r.nhuCau || "");
    setGiaTot(!!r.giaTot);

    setNoiThat(r.noiThat || "");
    setSoPhongNgu(r.soPhongNgu ?? r.phongNgu ?? "");
    setBaoPhi(r.baoPhi || "");

    setSdt1(r.sdt1 || "");
    setSdt2(r.sdt2 || "");
    setEditingPhone1(false);
    setEditingPhone2(false);

    setNoteInput("");
    setActiveTab("info");
  }, [
    r.maCan,
    r.phanKhu,
    r.huong,
    r.loaiCan,
    r.dienTich,
    r.gia,
    r.nhuCau,
    r.giaTot,
    r.noiThat,
    r.soPhongNgu,
    r.phongNgu,
    r.baoPhi,
    r.sdt1,
    r.sdt2,
    r.canHoId,
    r.chuNhaId,
  ]);

  /* ======= Helpers ======= */
  function copyToClipboard(text, which = "") {
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
    toast({ title: "Đã sao chép", message: `${which}: ${text}`, type: "info" });
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
      gia: toNumber(gia), // số thực (tỷ)
      nhuCau: nhuCau || null,
      giaTot: !!giaTot,
      noiThat: (noiThat || "").trim() || undefined,
      soPhongNgu: toInt(soPhongNgu),
      baoPhi: normalizeBaoPhi(baoPhi) || undefined,
      ghiChu: buildNewNotesIfAny(),
      // cập nhật chủ hộ (SĐT)
      chuNhaId: r.chuNhaId,
      sdt1: normalizePhone(sdt1) || undefined,
      sdt2: normalizePhone(sdt2) || undefined,
    };
    onSave?.(payload);
    setNoteInput("");
    toast({
      title: "Lưu thành công",
      message: `Đã cập nhật căn ${r.maCan || maCan}.`,
      type: "success",
    });
  }

  function handleAddNewUnit() {
    const v = (newMaCan || "").trim();
    if (!v) return;
    onCreateUnitByMaCan?.(v, r.chuNhaId); // liên kết ngay với chủ hiện tại
    setNewMaCan("");
    toast({ title: "Đã thêm căn mới", message: `Tạo ${v} & liên kết chủ hiện tại.`, type: "success" });
  }

  const canHoId =
    r.canHoId || (r.maCan && r.phanKhu ? `${r.maCan}|${r.phanKhu}` : undefined);

  const tabs = [
    { id: "info", label: "Thông tin", icon: "🏠" },
    { id: "update", label: "Cập nhật", icon: "⚙️" },
    { id: "history", label: "Lịch sử", icon: "📝" },
  ];

  /* ======= UI ======= */
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-0 sm:p-2 md:p-4">
      <div className="bg-white w-full max-w-6xl h-screen sm:h-[95vh] sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 sm:p-4 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center transition-all text-lg sm:text-base"
          >
            ✕
          </button>
          <h2 className="text-lg sm:text-xl font-bold pr-12 sm:pr-10">Căn hộ {r.maCan || "—"}</h2>
          <div className="text-sm text-white/80 mt-1">{displayName || "Chưa có thông tin chủ hộ"}</div>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-3 sm:p-4 min-h-0 overflow-hidden">
          {/* Desktop */}
          <div className="hidden lg:grid h-full grid-cols-3 gap-4">
            <div className="space-y-3 overflow-y-auto">
              <InfoSection
                r={r}
                displayName={displayName}
                editableBase={editableBase}
                maCan={maCan}
                setMaCan={setMaCan}
                phanKhu={phanKhu}
                setPhanKhu={setPhanKhu}
                huong={huong}
                setHuong={setHuong}
                loaiCan={loaiCan}
                setLoaiCan={setLoaiCan}
                dienTich={dienTich}
                setDienTich={setDienTich}
                copyToClipboard={copyToClipboard}
                phoneKey={phoneKey}
                related={related}
                newMaCan={newMaCan}
                setNewMaCan={setNewMaCan}
                onJumpToRow={onJumpToRow}
                handleAddNewUnit={handleAddNewUnit}
                // phones
                sdt1={sdt1}
                setSdt1={setSdt1}
                sdt2={sdt2}
                setSdt2={setSdt2}
                editingPhone1={editingPhone1}
                setEditingPhone1={setEditingPhone1}
                editingPhone2={editingPhone2}
                setEditingPhone2={setEditingPhone2}
              />
            </div>

            <div className="space-y-3 overflow-y-auto">
              <UpdateSection
                gia={gia}
                setGia={setGia}
                nhuCau={nhuCau}
                setNhuCau={setNhuCau}
                giaTot={giaTot}
                setGiaTot={setGiaTot}
                noiThat={noiThat}
                setNoiThat={setNoiThat}
                soPhongNgu={soPhongNgu}
                setSoPhongNgu={setSoPhongNgu}
                baoPhi={baoPhi}
                setBaoPhi={setBaoPhi}
                noteInput={noteInput}
                setNoteInput={setNoteInput}
              />
            </div>

            <div className="overflow-y-auto">
              <HistorySection
                timeline={timeline}
                listShow={listShow}
                showAll={showAll}
                setShowAll={setShowAll}
              />
            </div>
          </div>

          {/* Mobile */}
          <div className="lg:hidden h-full overflow-y-auto">
            {activeTab === "info" && (
              <InfoSection
                r={r}
                displayName={displayName}
                editableBase={editableBase}
                maCan={maCan}
                setMaCan={setMaCan}
                phanKhu={phanKhu}
                setPhanKhu={setPhanKhu}
                huong={huong}
                setHuong={setHuong}
                loaiCan={loaiCan}
                setLoaiCan={setLoaiCan}
                dienTich={dienTich}
                setDienTich={setDienTich}
                copyToClipboard={copyToClipboard}
                phoneKey={phoneKey}
                related={related}
                newMaCan={newMaCan}
                setNewMaCan={setNewMaCan}
                onJumpToRow={onJumpToRow}
                handleAddNewUnit={handleAddNewUnit}
                isMobile={true}
                sdt1={sdt1}
                setSdt1={setSdt1}
                sdt2={sdt2}
                setSdt2={setSdt2}
                editingPhone1={editingPhone1}
                setEditingPhone1={setEditingPhone1}
                editingPhone2={editingPhone2}
                setEditingPhone2={setEditingPhone2}
              />
            )}

            {activeTab === "update" && (
              <UpdateSection
                gia={gia}
                setGia={setGia}
                nhuCau={nhuCau}
                setNhuCau={setNhuCau}
                giaTot={giaTot}
                setGiaTot={setGiaTot}
                noiThat={noiThat}
                setNoiThat={setNoiThat}
                soPhongNgu={soPhongNgu}
                setSoPhongNgu={setSoPhongNgu}
                baoPhi={baoPhi}
                setBaoPhi={setBaoPhi}
                noteInput={noteInput}
                setNoteInput={setNoteInput}
                isMobile={true}
              />
            )}

            {activeTab === "history" && (
              <HistorySection
                timeline={timeline}
                listShow={listShow}
                showAll={showAll}
                setShowAll={setShowAll}
                isMobile={true}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-3 sm:p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-3 py-2 rounded-lg border text-red-600 border-red-200 hover:bg-red-50 text-xs sm:text-sm"
              >
                <span className="hidden xs:inline">Xóa chủ hộ</span>
                <span className="xs:hidden">Xóa</span>
              </button>

              <button
                onClick={onPrev}
                disabled={isFirst}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
                  isFirst
                    ? "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400"
                    : "hover:bg-gray-100 text-gray-700 border border-gray-300"
                }`}
              >
                ◀ <span className="hidden sm:inline">Trước</span>
              </button>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg text-xs sm:text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Lưu
            </button>

            <button
              onClick={onNext}
              disabled={isLast}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
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

      {/* Xác nhận xoá liên kết chủ */}
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
                  onDeleteOwner?.({ canHoId, chuNhaId: r.chuNhaId });
                  toast({ title: "Đã gỡ liên kết", type: "warning" });
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

/* ===== Section Components ===== */
function InfoSection({
  r,
  displayName,
  editableBase,
  maCan,
  setMaCan,
  phanKhu,
  setPhanKhu,
  huong,
  setHuong,
  loaiCan,
  setLoaiCan,
  dienTich,
  setDienTich,
  copyToClipboard,
  phoneKey,
  related,
  newMaCan,
  setNewMaCan,
  onJumpToRow,
  handleAddNewUnit,
  isMobile = false,
  // phones
  sdt1,
  setSdt1,
  sdt2,
  setSdt2,
  editingPhone1,
  setEditingPhone1,
  editingPhone2,
  setEditingPhone2,
}) {
  const isAddDisabled = !String(newMaCan || "").trim();

  return (
    <div className="space-y-4">
      {/* Thông tin căn */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
          🏠 <span>Thông tin căn</span>
        </h3>

        {!editableBase ? (
          <div className={`grid gap-3 text-xs ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <InfoCompact label="Mã căn" value={r.maCan} />
            <InfoCompact label="Phân khu" value={r.phanKhu} />
            <InfoCompact label="Hướng" value={r.huong} />
            <InfoCompact label="Loại căn" value={r.loaiCan} />
            <InfoCompact label="Diện tích" value={r.dienTich ? `${r.dienTich}m²` : "-"} />
            <InfoCompact label="Tên NK" value={displayName} />
          </div>
        ) : (
          <div className={`grid gap-3 text-xs ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            <Field label="Mã căn">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={phanKhu}
                onChange={(e) => setPhanKhu(e.target.value)}
                placeholder={inferPhanKhu(maCan) || "VD: VT"}
              />
            </Field>
            <Field label="Hướng">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={huong}
                onChange={(e) => setHuong(e.target.value)}
                placeholder="VD: ĐB / N / TB..."
              />
            </Field>
            <Field label="Loại căn">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={loaiCan}
                onChange={(e) => setLoaiCan(e.target.value)}
                placeholder="Đơn lập / Song lập…"
              />
            </Field>
            <Field label="Diện tích (m²)">
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={dienTich}
                onChange={(e) => setDienTich(e.target.value)}
                placeholder="VD: 409.5"
                inputMode="decimal"
              />
            </Field>
            <InfoCompact label="Tên NK" value={displayName} />
          </div>
        )}
      </div>

      {/* Liên hệ */}
      <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
          📞 <span>Liên hệ</span>
        </h3>
        <div className="space-y-3">
          {/* SĐT 1 */}
          <div>
            <div className="text-xs text-gray-600 mb-1 font-medium">SĐT 1</div>
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 text-sm font-mono rounded px-3 py-2 border bg-white ${
                  editingPhone1 ? "focus:ring-2 focus:ring-blue-500 focus:border-transparent" : "opacity-90"
                }`}
                value={sdt1}
                onChange={(e) => setSdt1(e.target.value)}
                readOnly={!editingPhone1}
                placeholder="Nhập số..."
                inputMode="numeric"
              />
              <button
                className="px-3 py-2 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 bg-white"
                onClick={() => copyToClipboard(sdt1, "SĐT 1")}
                title="Sao chép"
              >
                📋
              </button>
              <button
                className={`px-3 py-2 text-xs rounded-lg border ${
                  editingPhone1 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
                onClick={() => {
                  setEditingPhone1((v) => !v);
                  toast({
                    title: editingPhone1 ? "Khoá chỉnh sửa SĐT 1" : "Chỉnh sửa SĐT 1",
                    type: editingPhone1 ? "success" : "info",
                  });
                }}
                title={editingPhone1 ? "Khoá chỉnh sửa" : "Chỉnh sửa"}
              >
                {editingPhone1 ? "✅" : "✏️"}
              </button>
            </div>
          </div>

          {/* SĐT 2 */}
          <div>
            <div className="text-xs text-gray-600 mb-1 font-medium">SĐT 2</div>
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 text-sm font-mono rounded px-3 py-2 border bg-white ${
                  editingPhone2 ? "focus:ring-2 focus:ring-blue-500 focus:border-transparent" : "opacity-90"
                }`}
                value={sdt2}
                onChange={(e) => setSdt2(e.target.value)}
                readOnly={!editingPhone2}
                placeholder="Nhập số..."
                inputMode="numeric"
              />
              <button
                className="px-3 py-2 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 bg-white"
                onClick={() => copyToClipboard(sdt2, "SĐT 2")}
                title="Sao chép"
              >
                📋
              </button>
              <button
                className={`px-3 py-2 text-xs rounded-lg border ${
                  editingPhone2 ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
                onClick={() => {
                  setEditingPhone2((v) => !v);
                  toast({
                    title: editingPhone2 ? "Khoá chỉnh sửa SĐT 2" : "Chỉnh sửa SĐT 2",
                    type: editingPhone2 ? "success" : "info",
                  });
                }}
                title={editingPhone2 ? "Khoá chỉnh sửa" : "Chỉnh sửa"}
              >
                {editingPhone2 ? "✅" : "✏️"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Căn khác */}
      {(phoneKey || related.length > 0) && (
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              🏷️ <span>Căn khác của chủ hộ</span>
            </h3>
            {phoneKey && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {phoneKey}
              </span>
            )}
          </div>

          {related.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {related.map((it) => (
                <button
                  key={it.id || `${it.maCan}|${it.phanKhu}`}
                  onClick={() => onJumpToRow?.(it)}
                  className="px-3 py-2 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  title={`Tới ${it.maCan}`}
                >
                  {it.maCan}
                  {it.phanKhu ? ` · ${it.phanKhu}` : ""}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg text-center">
              Chưa ghi nhận căn khác
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nhập mã căn để thêm mới (VD: VT 7)"
              value={newMaCan}
              onChange={(e) => setNewMaCan(e.target.value)}
            />
            <button
              className={`px-4 py-2 rounded-lg text-white text-sm transition-colors whitespace-nowrap ${
                isAddDisabled
                  ? "bg-blue-400 opacity-50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={handleAddNewUnit}
              disabled={isAddDisabled}
            >
              Thêm
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-tight">
            * Căn mới sẽ được tạo và <b>liên kết ngay với chủ hiện tại</b>.
          </p>
        </div>
      )}
    </div>
  );
}

function UpdateSection({
  gia,
  setGia,
  nhuCau,
  setNhuCau,
  giaTot,
  setGiaTot,
  noiThat,
  setNoiThat,
  soPhongNgu,
  setSoPhongNgu,
  baoPhi,
  setBaoPhi,
  noteInput,
  setNoteInput,
  isMobile = false,
}) {
  return (
    <div className="bg-orange-50 rounded-lg p-3 sm:p-4 h-full">
      <h3 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
        ⚙️ <span>Cập nhật</span>
      </h3>

      <div className="space-y-4">
        {/* Giá (tỷ) */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Giá (tỷ VNĐ)
          </label>
          <input
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            value={gia}
            onChange={(e) => setGia(e.target.value)}
            placeholder="7.8 hoặc 7,845"
            type="text"
            inputMode="decimal"
          />
        </div>

        {/* Nội thất */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Nội thất
          </label>
          <select
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
            value={noiThat}
            onChange={(e) => setNoiThat(e.target.value)}
          >
            <option value="">-- Chọn --</option>
            {NOITHAT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {noiThat &&
              !NOITHAT_CANON.includes(vnNorm(noiThat)) && (
                <option value={noiThat}>{noiThat}</option>
              )}
          </select>
        </div>

        {/* Số phòng ngủ */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Số phòng ngủ
          </label>
          <input
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            value={soPhongNgu}
            onChange={(e) => setSoPhongNgu(e.target.value)}
            placeholder="3"
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
          />
        </div>

        {/* Bao phí */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Giá bao phí
          </label>
          <select
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
            value={baoPhi}
            onChange={(e) => setBaoPhi(e.target.value)}
          >
            <option value="">-- Chọn --</option>
            <option value="Bao phí">Bao phí</option>
            <option value="Không bao phí">Không bao phí</option>
            <option value="Phí 50-50">Phí 50-50</option>
          </select>
        </div>

        {/* Nhu cầu */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Nhu cầu
          </label>
          <select
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none"
            value={nhuCau}
            onChange={(e) => setNhuCau(e.target.value)}
          >
            <option value="">-- Chọn --</option>
            <option value="Bán">🔵 Bán</option>
            <option value="Thuê">🟡 Thuê</option>
            <option value="KNC">🟢 KNC</option>
            <option value="CNM">🟣 CNM</option>
            <option value="GLS">🔴 GLS</option>
          </select>
        </div>

        <label className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:bg-green-50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={giaTot}
            onChange={(e) => setGiaTot(e.target.checked)}
            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
          />
          <span className="text-sm font-medium">💰 Giá tốt</span>
        </label>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Ghi chú mới
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white"
            rows={isMobile ? 4 : 3}
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Nhập nội dung..."
          />
        </div>
      </div>
    </div>
  );
}

function HistorySection({ timeline, listShow, showAll, setShowAll, isMobile = false }) {
  return (
    <div className="bg-purple-50 rounded-lg p-3 sm:p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          📝 <span>Lịch sử ({timeline.length})</span>
        </h3>
        {timeline.length > 2 && (
          <button
            className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-100 transition-colors"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Thu gọn" : "Tất cả"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {listShow.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">Chưa có ghi chú</p>
            <p className="text-xs text-gray-400 mt-1">Thêm ghi chú đầu tiên ở tab Cập nhật</p>
          </div>
        ) : (
          <div className="space-y-3">
            {listShow.map((n, i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                        {formatVN(n.date)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {n.ts
                          ? new Date(n.ts).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed break-words">
                      {n.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== UI atoms ===== */
function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-semibold mb-2">{label}</div>
      {children}
    </div>
  );
}
function InfoCompact({ label, value }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <div className="text-xs text-gray-500 font-semibold mb-1 truncate">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate" title={value || "Chưa có"}>
        {value || "-"}
      </div>
    </div>
  );
}
