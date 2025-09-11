// src/compose/CanHoPage.jsx
import React from "react";
import { CRMBase } from "./CRMBase";

function CanHoPage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  // Căn hộ: hiển thị tất cả; CRMBase sẽ hỗ trợ lọc/sort/search
  return (
    <CRMBase
      mode="all"
      data={Array.isArray(data) ? data : []}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}

export default React.memo(CanHoPage);


