import { useMemo, useState } from "react";

/**
 * React component: CRM Apartments List (Responsive)
 * - TailwindCSS classes for styling
 * - Tabs: Bán | Căn hộ (demo)
 * - Filters: Phân khu, Nhu cầu, Sắp xếp theo
 * - Desktop: data table; Mobile: stacked cards
 * - Actions: Xuất báo cáo, + Căn mới
 */
export default function CRMPage() {
  // ===== Mock data (you can replace with API data) =====
  const initial = [
    {
      id: 1,
      maCan: "VT1",
      tenNK: "Phạm Đăng Tâm",
      dienTich: 409,
      huong: "Ban",
      gia: 7.9,
      nhuCau: "Bán",
      note: "2/7: knc/18/8: knc",
      phanKhu: "VT"
    },
    {
      id: 2,
      maCan: "VT3",
      tenNK: "Đỗ Thị Hà",
      dienTich: 409.5,
      huong: "Ban",
      gia: 8.5,
      nhuCau: "Bán",
      note: "4/8: knc/cm",
      phanKhu: "VT"
    },
    {
      id: 3,
      maCan: "VT4",
      tenNK: "Nguyễn Đức Tuấn",
      dienTich: 7.5,
      huong: "Ban",
      gia: 7.5,
      nhuCau: "Bán",
      note: "sai số/knc",
      phanKhu: "VT"
    },
    {
      id: 4,
      maCan: "6V7",
      tenNK: "Nguyễn Thị Hoa",
      dienTich: 6.8,
      huong: "Bán",
      gia: 6.8,
      nhuCau: "Bán",
      note: "knc/cm",
      phanKhu: "6V"
    },
    {
      id: 5,
      maCan: "VT7",
      tenNK: "Nguyễn Thị Hoa",
      dienTich: 6.15,
      huong: "Bán",
      gia: 6.0,
      nhuCau: "Thuê",
      note: "knc/cm",
      phanKhu: "VT"
    },
    {
      id: 6,
      maCan: "VT8",
      tenNK: "Nguyễn Đức Tuấn",
      dienTich: 215,
      huong: "Ban",
      gia: 5.0,
      nhuCau: "Bán",
      note: "knc/cm",
      phanKhu: "VT",
      giaTot: true
    },
    {
      id: 7,
      maCan: "VT7",
      tenNK: "Nguyễn Thị Hoa",
      dienTich: 6.8,
      huong: "Thuê",
      gia: 6.8,
      nhuCau: "Thuê",
      note: "tqqc/cm",
      phanKhu: "VT"
    }
  ];

  const [tab, setTab] = useState("ban"); // "ban" | "canho" (demo)
  const [khu, setKhu] = useState("all");
  const [nhuCau, setNhuCau] = useState("all");
  const [sortBy, setSortBy] = useState("gia"); // gia | dienTich | maCan
  const [query, setQuery] = useState("");

  const phanKhuOptions = useMemo(() => {
    const s = new Set(initial.map((x) => x.phanKhu));
    return ["all", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    let list = initial.filter((x) =>
      [x.maCan, x.tenNK, x.note].join(" ").toLowerCase().includes(query.toLowerCase())
    );
    if (khu !== "all") list = list.filter((x) => x.phanKhu === khu);
    if (nhuCau !== "all") list = list.filter((x) => x.nhuCau === nhuCau);

    const sorter =
      sortBy === "gia"
        ? (a, b) => a.gia - b.gia
        : sortBy === "dienTich"
        ? (a, b) => a.dienTich - b.dienTich
        : (a, b) => String(a.maCan).localeCompare(String(b.maCan));

    return [...list].sort(sorter);
  }, [khu, nhuCau, sortBy, query]);

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-gray-800">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">CRM</h1>

          {/* Tabs */}
          <nav className="ml-4 flex gap-2">
            <button
              onClick={() => setTab("ban")}
              className={tw(
                "px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold border",
                tab === "ban"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
            >
              Bán
            </button>
            <button
              onClick={() => setTab("canho")}
              className={tw(
                "px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold border",
                tab === "canho"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              )}
            >
              Căn hộ
            </button>
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <button className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium">
              <DownloadIcon className="w-4 h-4" />
              Xuất báo cáo
            </button>
            <button className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm">
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">+ Căn mới</span>
              <span className="sm:hidden">Thêm</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select label="Phân khu" value={khu} onChange={setKhu}>
            {phanKhuOptions.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? "Tất cả" : v}
              </option>
            ))}
          </Select>

          <Select label="Nhu cầu" value={nhuCau} onChange={setNhuCau}>
            <option value="all">Tất cả</option>
            <option value="Bán">Bán</option>
            <option value="Thuê">Thuê</option>
          </Select>

          <Select label="Sắp xếp theo" value={sortBy} onChange={setSortBy}>
            <option value="gia">Giá</option>
            <option value="dienTich">Diện tích</option>
            <option value="maCan">Mã căn</option>
          </Select>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1">Tìm kiếm</label>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã căn, tên người kê, ghi chú…"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm font-semibold text-gray-600">
                <Th className="w-10 text-center">#</Th>
                <Th>Mã Căn</Th>
                <Th>Tên NK</Th>
                <Th>Diện tích</Th>
                <Th>Hướng</Th>
                <Th>Giá</Th>
                <Th>Nhu cầu</Th>
                <Th>Nội dung trao đổi</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={row.id} className="border-t text-sm hover:bg-gray-50">
                  <Td className="text-center text-gray-500">{idx + 1}</Td>
                  <Td className="font-semibold">{row.maCan}</Td>
                  <Td>{row.tenNK}</Td>
                  <Td>{fmtArea(row.dienTich)}</Td>
                  <Td>{row.huong}</Td>
                  <Td>
                    <span
                      className={tw(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
                        row.giaTot
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                          : "bg-gray-100 text-gray-700"
                      )}
                    >
                      {row.gia.toLocaleString("vi-VN")} tỷ
                      {row.giaTot && (
                        <span className="text-[10px] font-bold uppercase">Giá tốt</span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={tw(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        row.nhuCau === "Bán"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                      )}
                    >
                      {row.nhuCau}
                    </span>
                  </Td>
                  <Td className="flex items-center gap-2">
                    <span className="truncate max-w-[32ch]" title={row.note}>
                      {row.note}
                    </span>
                    <button className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50">
                      Ghi
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.map((row, idx) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="text-xs text-gray-500">#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-lg">{row.maCan}</div>
                    {row.giaTot && (
                      <span className="text-[10px] font-bold uppercase text-green-700 bg-green-50 ring-1 ring-inset ring-green-200 px-1.5 py-0.5 rounded">
                        Giá tốt
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700">{row.tenNK}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <Info label="Diện tích" value={fmtArea(row.dienTich)} />
                    <Info label="Hướng" value={row.huong} />
                    <Info label="Giá" value={`${row.gia.toLocaleString("vi-VN")} tỷ`} />
                    <Info label="Nhu cầu" value={row.nhuCau} />
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Trao đổi:</span> {row.note}
                  </div>
                </div>
                <button className="shrink-0 rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-semibold">Ghi</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ===================== Small UI helpers =====================
function Th({ children, className = "" }) {
  return (
    <th className={tw("px-3 py-3", className)}>
      <div className="px-1">{children}</div>
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={tw("px-3 py-3 align-middle", className)}>{children}</td>;
}
function Select({ label, value, onChange, children }) {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-semibold mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// ===================== Icons (SVG) =====================
function ChevronDown(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.168l3.71-2.938a.75.75 0 11.94 1.172l-4.18 3.31a.75.75 0 01-.94 0l-4.18-3.31a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}
function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
    </svg>
  );
}
function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

// ===================== Utils =====================
function tw(...cls) {
  return cls.filter(Boolean).join(" ");
}
function fmtArea(v) {
  return `${v.toString().replace(".", ",")} m²`;
}
