// src/compose/UploadData.jsx
import { useState, useRef } from "react";
import * as XLSX from "xlsx";

const HEADER_MAP = {
  "mã căn": "maCan",
  "ten nk": "tenNK",
  "tên nk": "tenNK",
  "số di động": "sdt1",
  "so di dong": "sdt1",
  "sdt 2": "sdt2",
  "loại căn": "loaiCan",
  "loai can": "loaiCan",
  "góc": "goc",
  "goc": "goc",
  "dt đất": "dtDat",
  "dt dat": "dtDat",
  "hướng": "huong",
  "huong": "huong",
  "nội dung trao đổi": "ghiChu",
  "noi dung trao doi": "ghiChu",
  "nhu cầu": "nhuCau",
  "nhu cau": "nhuCau",
};

export default function UploadData({ onParsed }) {
  const [count, setCount] = useState(0);
  const jsonInputRef = useRef(null);

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim();

  const parsePhanKhu = (maCan = "") => {
    const m = String(maCan).trim().match(/^([^\s]+)/);
    return m ? m[1].toUpperCase() : "";
  };
  const normalizePhone = (p) => {
    const s = typeof p === "number" ? String(p) : String(p ?? "");
    const digits = s.replace(/[^0-9]/g, "");
    return digits ? (digits.startsWith("0") ? digits : "0" + digits) : "";
  };
  const num = (v) =>
    v === undefined || v === null || v === "" ? null : Number(String(v).replace(/\./g, "").replace(",", "."));
  const boolGoc = (v) => ["goc", "góc", "1", "true"].includes(norm(v));

  const downloadJson = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  function mapRow(row) {
    // ánh xạ linh hoạt theo header
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const key = HEADER_MAP[norm(k)];
      if (!key) continue;
      out[key] = v;
    }
    out.maCan = String(out.maCan || "").trim();
    out.phanKhu = parsePhanKhu(out.maCan);
    out.sdt1 = normalizePhone(out.sdt1);
    out.sdt2 = normalizePhone(out.sdt2);
    out.dtDat = num(out.dtDat);
    out.goc = boolGoc(out.goc);
    out.nhuCau = (out.nhuCau || "").toString().trim() || null;
    return out;
  }

  function handleExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const wb = XLSX.read(reader.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const mapped = json.map(mapRow).filter((x) => x.maCan);
      setCount(mapped.length);

      // Chuẩn hoá thành 3 bảng (canHo, chuNha, chuNha_canHo)
      const canHoMap = new Map();
      const chuNhaMap = new Map();
      const links = new Map();
      const slug = (s) =>
        norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      mapped.forEach((r) => {
        const canKey = `${r.maCan}|${r.phanKhu}`;
        if (!canHoMap.has(canKey))
          canHoMap.set(canKey, {
            id: canKey,
            maCan: r.maCan,
            phanKhu: r.phanKhu,
            loaiCan: r.loaiCan || null,
            goc: !!r.goc,
            dtDat: r.dtDat,
            huong: r.huong || null,
            ghiChu: r.ghiChu || null,
            nhuCau: r.nhuCau || null,
          });

        const chuKey = r.sdt1 || `${slug(r.tenNK || "unknown")}|${r.sdt2 || ""}`;
        if (!chuNhaMap.has(chuKey))
          chuNhaMap.set(chuKey, {
            id: chuKey,
            hoTen: r.tenNK?.toString().trim() || null,
            sdt1: r.sdt1 || null,
            sdt2: r.sdt2 || null,
          });

        const linkKey = `${canKey}|${chuKey}`;
        if (!links.has(linkKey))
          links.set(linkKey, {
            id: linkKey,
            canHoId: canKey,
            chuNhaId: chuKey,
            isPrimaryContact: false,
            role: "đồng sở hữu",
          });
      });

      // chọn primary 1 người/căn
      const byCan = {};
      for (const L of links.values()) (byCan[L.canHoId] ||= []).push(L);
      Object.values(byCan).forEach((arr) => {
        arr.sort(
          (a, b) =>
            (chuNhaMap.get(b.chuNhaId)?.sdt1 || "").length -
            (chuNhaMap.get(a.chuNhaId)?.sdt1 || "").length
        );
        if (arr[0]) arr[0].isPrimaryContact = true;
      });

      const payload = {
        canHo: Array.from(canHoMap.values()),
        chuNha: Array.from(chuNhaMap.values()),
        chuNha_canHo: Array.from(links.values()),
      };

      // Lưu để tái sử dụng
      localStorage.setItem("crm_payload", JSON.stringify(payload));
      onParsed?.(payload);
    };
    reader.readAsBinaryString(file);
  }

  function handleLoadJsonFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        localStorage.setItem("crm_payload", JSON.stringify(payload));
        onParsed?.(payload);
      } catch {
        alert("File JSON không hợp lệ");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDownloadJson() {
    const s = localStorage.getItem("crm_payload");
    if (!s) return;
    const payload = JSON.parse(s);
    const ts = new Date();
    const name = `crm-data-${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(
      ts.getDate()
    ).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(
      2,
      "0"
    )}.json`;
    downloadJson(name, payload);
  }

  return (
    <div className="inline-flex items-center gap-3">
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} />
      <button
        type="button"
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        onClick={handleDownloadJson}
      >
        Tải JSON
      </button>
      <button
        type="button"
        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        onClick={() => document.getElementById("json-loader").click()}
      >
        Tải lên JSON
      </button>
      <input id="json-loader" hidden type="file" accept=".json" onChange={handleLoadJsonFile} />
      {count > 0 && <span className="text-xs text-gray-600">Đã đọc {count} dòng</span>}
    </div>
  );
}
