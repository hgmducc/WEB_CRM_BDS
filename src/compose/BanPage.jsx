// src/compose/BanPage.jsx
import React, { useMemo } from "react";
import { CRMBase } from "./CRMBase";

/** Chuẩn hoá nhu cầu về ASCII, thường */
const norm = (s = "") =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function BanPage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  // Chỉ lấy các dòng nhu cầu = 'ban'
  const filtered = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((r) => norm(r.nhuCau) === "ban");
  }, [data]);

  return (
    <CRMBase
      mode="ban"                 // dùng ASCII 'ban'
      data={filtered}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}

export default React.memo(BanPage);
