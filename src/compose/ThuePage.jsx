// src/compose/ThuePage.jsx
import React, { useMemo } from "react";
import { CRMBase } from "./CRMBase";

const norm = (s = "") =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function ThuePage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  // Chỉ lấy các dòng nhu cầu = 'thue'
  const filtered = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((r) => norm(r.nhuCau) === "thue");
  }, [data]);

  return (
    <CRMBase
      mode="thue"               // dùng ASCII 'thue'
      data={filtered}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}

export default React.memo(ThuePage);
