import React from "react";
import { CRMBase } from "./CRMBase";

function CanHoPage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  // Căn hộ: hiển thị tất cả; CRMBase sẽ cho lọc/sort/search
  return (
    <CRMBase
      mode="all" // hiển thị tất cả
      data={Array.isArray(data) ? data : []}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}

export default React.memo(CanHoPage);
