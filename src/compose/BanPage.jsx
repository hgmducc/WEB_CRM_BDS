// src/compose/BanPage.jsx
import React from "react";
import { CRMBase } from "./CRMBase";

export default function BanPage({ data = [], onSave, onCreateUnitByMaCan, onDeleteOwner }) {
  return (
    <CRMBase
      mode="Bán"
      data={data}
      onSave={onSave}
      onCreateUnitByMaCan={onCreateUnitByMaCan}
      onDeleteOwner={onDeleteOwner}
    />
  );
}
