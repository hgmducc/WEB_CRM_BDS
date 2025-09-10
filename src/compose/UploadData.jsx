import React, { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

/** ====== Cấu hình chung ====== */
const LS_KEY = "CRM_BDS_PAYLOAD_V1";

/** Chuẩn hoá chuỗi */
export function norm(input = "") {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** HEADER_MAP */
const HEADER_MAP = {
  // căn hộ & thuộc tính
  "ma can": "maCan",
  "ma can ho": "maCan",
  "macan": "maCan",
  "loai can": "loaiCan",
  "goc": "goc",
  "dt dat": "dtDat",
  "dien tich dat": "dtDat",
  "dien tich": "dienTich",
  "huong": "huong",
  "gia": "gia",
  "nhu cau": "nhuCau",
  "noi that": "noiThat",
  "so phong ngu": "soPhongNgu",
  "phong ngu": "soPhongNgu",
  "bao phi": "baoPhi",
  "gia bao phi": "baoPhi",
  "ghi chu": "ghiChu",
  "nguon data": "nguonData",
  "ngay cap nhat": "ngayCapNhat",

  // chủ nhà / liên hệ
  "ten nk": "hoTen",
  "ten nguoi ke": "hoTen",
  "nguoi ke": "hoTen",
  "ten chu nha": "hoTen",
  "chu nha": "hoTen",
  "ten": "hoTen",

  // SĐT patterns
  "sdt1": "sdt1",
  "sdt 1": "sdt1",
  "so dt 1": "sdt1",
  "so dien thoai 1": "sdt1",
  "dien thoai 1": "sdt1",
  "so di dong 1": "sdt1",
  "so di dong": "sdt1",
  "so dt": "sdt1",
  "so dien thoai": "sdt1",
  "sdt": "sdt1",
  "dien thoai": "sdt1",
  "mobile": "sdt1",
  "so dt lh": "sdt1",
  "dien thoai lh": "sdt1",

  "sdt2": "sdt2",
  "sdt 2": "sdt2",
  "so dt 2": "sdt2",
  "so dien thoai 2": "sdt2",
  "dien thoai 2": "sdt2",
  "so di dong 2": "sdt2",
};

/** ====== Helpers chuẩn hoá giá trị ====== */
// Parser số thập phân giống NoteModal
const toNumber = (val) => {
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
};
const toInt = (v) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};
const normalizeBaoPhi = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return undefined;
  if (s.includes("50")) return "Phí 50-50";
  if (s.includes("kh")) return "Không bao phí";
  if (s.includes("ko")) return "Không bao phí";
  if (s.includes("bao")) return "Bao phí";
  const plain = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["bao phi", "khong bao phi", "phi 50-50"].includes(plain)) return v;
  return v;
};
const inferPhanKhu = (maCanRaw) => {
  const s = String(maCanRaw || "").trim();
  if (!s) return "";
  const tok = s.split(/\s+/)[0].toUpperCase();
  if (/^TI/.test(tok)) return "ĐẢO";
  return tok;
};
const normalizePhone = (raw) => {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  let digits = s.replace(/\D/g, "");
  if (/^(?:\+?84|0084)/.test(s)) digits = digits.replace(/^(\+?84|0084)/, "0");
  else if (/^84\d{8,10}$/.test(digits)) digits = "0" + digits.slice(2);
  if (digits.length === 9 && digits[0] !== "0") digits = "0" + digits;
  if (digits.length > 11) digits = digits.slice(0, 11);
  if (digits.length === 10 || digits.length === 11) return digits;
  return "";
};
const mergePhones = (current = {}, p1 = "", p2 = "") => {
  const s = new Set([current.sdt1, current.sdt2, p1, p2].filter(Boolean).map((x) => String(x)));
  const arr = Array.from(s);
  return { sdt1: arr[0] || "", sdt2: arr[1] || "" };
};
const findHeaderRow = (rows2d) => {
  let bestIdx = 0;
  let bestHit = 0;
  const maxScan = Math.min(rows2d.length, 50);
  for (let r = 0; r < maxScan; r++) {
    const row = rows2d[r] || [];
    let hit = 0;
    for (const cell of row) {
      const key = norm(cell);
      if (HEADER_MAP[key]) hit++;
    }
    if (hit > bestHit) {
      bestHit = hit;
      bestIdx = r;
    }
    if (hit >= 2) return r;
  }
  return bestIdx;
};

/** Đọc file Excel/CSV → mảng object thô */
const readFileToObjects = async (file) => {
  const name = (file?.name || "").toLowerCase();
  const isCSV = name.endsWith(".csv");
  const isExcel = /\.(xlsx|xlsm|xls|xlsb)$/.test(name);

  const buf = await file.arrayBuffer();

  const processRows = (rows2d) => {
    const headerRowIdx = findHeaderRow(rows2d);
    const header = rows2d[headerRowIdx] || [];
    const dataRows = rows2d.slice(headerRowIdx + 1);

    return dataRows
      .map((row) => {
        const obj = {};
        header.forEach((h, i) => {
          obj[String(h || "").trim()] = row[i];
        });
        return obj;
      })
      .filter((o) =>
        Object.values(o).some(
          (v) => v !== undefined && v !== null && String(v).trim() !== ""
        )
      );
  };

  if (isCSV || isExcel) {
    const wb = XLSX.read(buf, { type: "array" });
    let chosen = wb.SheetNames[0];

    if (isExcel) {
      for (const s of wb.SheetNames) {
        const ws = wb.Sheets[s];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        if (rows && rows.length > 1) {
          chosen = s;
          break;
        }
      }
    }

    const ws = wb.Sheets[chosen];
    const rows2d = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    return processRows(rows2d);
  }

  throw new Error("Định dạng không hỗ trợ. Hãy dùng .xlsx/.xls/.csv");
};

const mapHeaders = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = norm(k);
    const mapped = HEADER_MAP[key];
    if (mapped) out[mapped] = v;
  }
  return out;
};

const guessPhonesFromRow = (rawRow) => {
  const entries = Object.entries(rawRow || {});
  const phoneCols = entries
    .map(([k, v]) => ({ kNorm: norm(k), k, v }))
    .filter(({ kNorm }) =>
      /(sdt|so dien thoai|so di dong|dien thoai|mobile|so dt lh|dien thoai lh)/.test(kNorm)
    );

  const vals = phoneCols
    .map(({ v }) => String(v ?? ""))
    .filter(Boolean)
    .slice(0, 2);
  return { p1: vals[0] || "", p2: vals[1] || "" };
};

/** ====== Lõi xử lý → 3 bảng ====== */
const buildTables = (rows, { requirePhone = true } = {}) => {
  const canHo = {};
  const chuNha = {};
  const links = [];

  let totalRows = 0;
  let keptByPhone = 0;
  let droppedNoPhone = 0;

  const seenPrimary = new Set();
  const linkKeySet = new Set();
  const phoneToOwner = new Map();

  for (const raw of rows) {
    totalRows += 1;
    const r = mapHeaders(raw);

    let rawP1 = r.sdt1 ?? "";
    let rawP2 = r.sdt2 ?? "";
    if (!rawP1 && !rawP2) {
      const g = guessPhonesFromRow(raw);
      rawP1 = g.p1;
      rawP2 = g.p2;
    }

    const p1 = normalizePhone(rawP1);
    const p2 = normalizePhone(rawP2);
    const phones = [p1, p2].filter(Boolean);

    const maCan = (r.maCan || "").toString().trim();
    if (!maCan) continue;

    if (phones.length === 0) {
      if (requirePhone) {
        droppedNoPhone += 1;
        continue;
      }
    } else {
      keptByPhone += 1;
    }

    const hoTen = (r.hoTen || "").toString().trim();
    const phanKhu = inferPhanKhu(maCan);
    const canHoId = `${maCan}|${phanKhu}`;

    // Upsert canHo
    if (!canHo[canHoId]) {
      canHo[canHoId] = {
        id: canHoId,
        maCan,
        phanKhu,
        loaiCan: (r.loaiCan || "").toString().trim() || undefined,
        goc: (r.goc || "").toString().trim() || undefined,
        dtDat: toNumber(r.dtDat),
        dienTich: toNumber(r.dienTich),
        huong: (r.huong || "").toString().trim() || undefined,
        nhuCau: (r.nhuCau || "").toString().trim() || undefined,
        gia: toNumber(r.gia),
        noiThat: (r.noiThat || "").toString().trim() || undefined,
        soPhongNgu: toInt(r.soPhongNgu),
        baoPhi: normalizeBaoPhi(r.baoPhi) || undefined,
        giaTot: undefined,
        ghiChu: (r.ghiChu || "").toString().trim() || undefined,
      };
    } else {
      const c = canHo[canHoId];
      c.loaiCan ||= (r.loaiCan || "").toString().trim() || undefined;
      c.goc ||= (r.goc || "").toString().trim() || undefined;
      c.dtDat ||= toNumber(r.dtDat);
      c.dienTich ||= toNumber(r.dienTich);
      c.huong ||= (r.huong || "").toString().trim() || undefined;
      c.nhuCau ||= (r.nhuCau || "").toString().trim() || undefined;
      c.gia ||= toNumber(r.gia);
      c.noiThat ||= (r.noiThat || "").toString().trim() || undefined;
      c.soPhongNgu ||= toInt(r.soPhongNgu);
      c.baoPhi ||= normalizeBaoPhi(r.baoPhi) || undefined;
      c.ghiChu ||= (r.ghiChu || "").toString().trim() || undefined;
    }

    // Gộp chủ theo bất kỳ số nào
    let ownerId = null;
    for (const ph of phones) {
      if (phoneToOwner.has(ph)) {
        ownerId = phoneToOwner.get(ph);
        break;
      }
    }
    if (!ownerId) ownerId = phones[0] || "";

    if (!chuNha[ownerId]) {
      const merged = mergePhones({}, p1, p2);
      chuNha[ownerId] = {
        id: ownerId,
        hoTen: hoTen || undefined,
        sdt1: merged.sdt1 || undefined,
        sdt2: merged.sdt2 || undefined,
      };
    } else {
      const exist = chuNha[ownerId];
      const merged = mergePhones(exist, p1, p2);
      exist.sdt1 = merged.sdt1 || undefined;
      exist.sdt2 = merged.sdt2 || undefined;
      if (!exist.hoTen && hoTen) exist.hoTen = hoTen;
    }
    for (const ph of phones) phoneToOwner.set(ph, ownerId);

    const isPrimary = !seenPrimary.has(canHoId);
    if (isPrimary) seenPrimary.add(canHoId);
    const role = isPrimary ? "Chủ sở hữu" : "Đồng sở hữu";

    const linkKey = `${canHoId}__${ownerId}`;
    if (!linkKeySet.has(linkKey)) {
      linkKeySet.add(linkKey);
      links.push({
        canHoId,
        chuNhaId: ownerId,
        isPrimaryContact: isPrimary,
        role,
      });
    }
  }

  return {
    canHo,
    chuNha,
    chuNha_canHo: links,
    meta: { totalRows, keptByPhone, droppedNoPhone },
  };
};

/** ====== StatusIndicator Component ====== */
const StatusIndicator = React.memo(({ status, counts, existing }) => {
  if (!status && !counts && !existing) return null;

  return (
    <div className="space-y-3">
      {status && (
        <div
          className={`text-sm p-3 rounded-lg border ${
            status.includes("thành công")
              ? "bg-green-50 text-green-800 border-green-200"
              : status.includes("Lỗi") || status.includes("thất bại") || status.startsWith("❌")
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {status}
        </div>
      )}

      {(counts || existing) && (
        <div className="bg-gray-50 rounded-lg p-4 border">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Thống kê dữ liệu
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-2xl font-bold text-blue-600">
                {counts?.totalCanHo ?? existing?.canHo ?? 0}
              </div>
              <div className="text-xs text-gray-600 mt-1">Căn hộ</div>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-2xl font-bold text-green-600">
                {counts?.totalChuNha ?? existing?.chuNha ?? 0}
              </div>
              <div className="text-xs text-gray-600 mt-1">Chủ nhà</div>
            </div>
            <div className="bg-white rounded-lg p-3 border">
              <div className="text-2xl font-bold text-purple-600">
                {counts?.totalLinks ?? existing?.links ?? 0}
              </div>
              <div className="text-xs text-gray-600 mt-1">Liên kết</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/** ====== ActionButton Component ====== */
const ActionButton = React.memo(({ onClick, children, variant = "default", className = "", ...props }) => {
  const variants = {
    default: "bg-white hover:bg-gray-50 border-gray-300",
    primary: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

/** ====== Main UploadData Component ====== */
export default function UploadData({ onLoaded }) {
  const [status, setStatus] = useState("");
  const [counts, setCounts] = useState(null);
  const [requirePhone, setRequirePhone] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileRef = useRef(null);
  const jsonImportRef = useRef(null);

  const existing = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return {
        canHo: Object.keys(payload.canHo || {}).length,
        chuNha: Object.keys(payload.chuNha || {}).length,
        links: (payload.chuNha_canHo || []).length,
      };
    } catch {
      return null;
    }
  }, [counts]);

  const handleFile = useCallback(
    async (file) => {
      if (isProcessing) return;

      setIsProcessing(true);
      try {
        setStatus("🔄 Đang đọc file…");
        const rawRows = await readFileToObjects(file);

        if (!rawRows.length) {
          setStatus("❌ Không tìm thấy dữ liệu trong file.");
          return;
        }

        setStatus("⚙️ Đang xử lý dữ liệu…");
        const payload = buildTables(rawRows, { requirePhone });

        if (
          !Object.keys(payload.canHo).length ||
          !Object.keys(payload.chuNha).length ||
          !payload.chuNha_canHo.length
        ) {
          const m = payload.meta || {};
          setStatus(
            `⚠️ Không tìm thấy dữ liệu hợp lệ. ` +
              `Tổng dòng: ${m.totalRows ?? 0}, ` +
              `Có SDT: ${m.keptByPhone ?? 0}, ` +
              `Thiếu SDT: ${m.droppedNoPhone ?? 0}. ` +
              (requirePhone
                ? "Thử bỏ chọn 'Chỉ giữ dòng có SDT' để kiểm tra."
                : "Kiểm tra lại header 'Mã Căn' và 'SDT'.")
          );
          return;
        }

        window.localStorage.setItem(LS_KEY, JSON.stringify(payload));

        const totalCanHo = Object.keys(payload.canHo).length;
        const totalChuNha = Object.keys(payload.chuNha).length;
        const totalLinks = payload.chuNha_canHo.length;

        setCounts({ totalCanHo, totalChuNha, totalLinks });
        setStatus(`✅ Nhập thành công từ ${file.name}`);

        onLoaded?.(payload);
      } catch (err) {
        console.error("File processing error:", err);
        setStatus(`❌ Lỗi xử lý file: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [onLoaded, requirePhone, isProcessing]
  );

  const onChangeFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFile(file);
      }
      e.target.value = "";
    },
    [handleFile]
  );

  const handleExportJSON = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) {
        setStatus("⚠️ Chưa có dữ liệu để xuất.");
        return;
      }

      const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm_bds_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("📥 Đã tải xuống file JSON.");
    } catch (e) {
      setStatus("❌ Xuất JSON thất bại.");
    }
  }, []);

  const handleImportJSON = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setStatus("🔄 Đang nạp file JSON…");
        const text = await file.text();
        const payload = JSON.parse(text);

        if (!payload || !payload.canHo || !payload.chuNha || !Array.isArray(payload.chuNha_canHo)) {
          setStatus("❌ File JSON không đúng định dạng.");
          return;
        }

        window.localStorage.setItem(LS_KEY, JSON.stringify(payload));

        const totalCanHo = Object.keys(payload.canHo).length;
        const totalChuNha = Object.keys(payload.chuNha).length;
        const totalLinks = payload.chuNha_canHo.length;

        setCounts({ totalCanHo, totalChuNha, totalLinks });
        setStatus("✅ Nạp JSON thành công.");
        onLoaded?.(payload);
      } catch (e2) {
        setStatus("❌ File JSON không hợp lệ.");
      } finally {
        e.target.value = "";
      }
    },
    [onLoaded]
  );

  const handleClear = useCallback(() => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu?")) {
      window.localStorage.removeItem(LS_KEY);
      setCounts(null);
      setStatus("🗑️ Đã xóa dữ liệu local.");
    }
  }, []);

  return (
    <div className="bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Nhập & Xuất Dữ Liệu
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Hỗ trợ Excel (.xlsx/.xls) và CSV. Tự động phát hiện header và chuẩn hóa dữ liệu.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* File Upload Section */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onChangeFile}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors file:cursor-pointer disabled:opacity-50"
            />

            <label className="flex items-center space-x-3 text-sm">
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={(e) => setRequirePhone(e.target.checked)}
                disabled={isProcessing}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-gray-700">
                Chỉ giữ dòng có số điện thoại hợp lệ
                <span className="text-xs text-gray-500 ml-1">(khuyến nghị)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={handleExportJSON}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Xuất JSON
            </ActionButton>

            <label className="inline-block cursor-pointer">
              <ActionButton as="span">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
                  />
                </svg>
                Nạp JSON
              </ActionButton>
              <input ref={jsonImportRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
            </label>

            <ActionButton onClick={handleClear} variant="danger">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 01-1 1v3M4 7h16"
                />
              </svg>
              Xóa dữ liệu
            </ActionButton>
          </div>
        </div>

        {/* Status & Statistics */}
        <StatusIndicator status={status} counts={counts} existing={existing} />
      </div>
    </div>
  );
}
