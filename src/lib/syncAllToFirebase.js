// src/lib/syncAllToFirebase.js
import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "./firebase";

// Loại bỏ undefined, Infinity và NaN (đổi thành null). Áp dụng đệ quy cho object/array.
function clean(value) {
  if (value === undefined || Number.isNaN(value) || value === Infinity || value === -Infinity) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((v) => clean(v));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;           // BỎ field undefined
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

export async function syncAllToFirebase(tenantId, payload, { dropBeforeWrite = false } = {}) {
  if (!tenantId) throw new Error("Missing tenantId");
  if (!payload) throw new Error("Missing payload");

  const { canHo = {}, chuNha = {}, chuNha_canHo = [] } = payload;
  const path = (sub) => `tenants/${tenantId}/${sub}`;

  // Xoá sạch (nếu chọn)
  if (dropBeforeWrite) {
    for (const sub of ["canHo", "chuNha", "links"]) {
      const snap = await getDocs(collection(db, path(sub)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }

  // Ghi canHo + chuNha
  {
    const batch = writeBatch(db);
    Object.entries(canHo).forEach(([id, data]) => {
      batch.set(doc(db, path("canHo"), id), clean({ id, ...data }), { merge: true });
    });
    Object.entries(chuNha).forEach(([id, data]) => {
      batch.set(doc(db, path("chuNha"), id), clean({ id, ...data }), { merge: true });
    });
    await batch.commit();
  }

  // Ghi links
  {
    const batch = writeBatch(db);
    chuNha_canHo.forEach((lnk) => {
      const id = `${lnk.canHoId}__${lnk.chuNhaId}`;
      batch.set(
        doc(db, path("links"), id),
        clean({
          canHoId: lnk.canHoId,
          chuNhaId: lnk.chuNhaId,
          isPrimaryContact: !!lnk.isPrimaryContact,
          role: lnk.role || "Chủ sở hữu",
        }),
        { merge: true }
      );
    });
    await batch.commit();
  }

  return {
    canHo: Object.keys(canHo).length,
    chuNha: Object.keys(chuNha).length,
    links: chuNha_canHo.length,
  };
}
