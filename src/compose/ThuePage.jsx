// src/compose/ThuePage.jsx
import React from "react";
import { CRMBase } from "./CRMBase";

export default function ThuePage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  return (
    <CRMBase
      mode="Thuê"
      data={data}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}
