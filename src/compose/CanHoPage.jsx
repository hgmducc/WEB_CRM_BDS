// src/compose/CanHoPage.jsx
import React from "react";
import { CRMBase } from "./CRMBase";

export default function CanHoPage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  return (
    <CRMBase
      mode="all"
      data={data}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}
