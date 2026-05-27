import React, { useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import "./BulkForYouMetadataModal.scss";

const DEFAULT_FORM = { dietTags: [], allergenTags: [], tasteProfile: { containsOnion: false, containsCilantro: false, sugar: 100, spice: "Vừa" } };
const DEFAULT_ENABLED = { dietTags: false, allergenTags: false, containsOnion: false, containsCilantro: false, sugar: false, spice: false };

export const buildBulkForYouPatch = (item, form, enabledFields) => {
  const patch = {};
  if (enabledFields.dietTags) patch.dietTags = form.dietTags;
  if (enabledFields.allergenTags) patch.allergenTags = form.allergenTags;
  const tastePatch = {};
  if (enabledFields.containsOnion) tastePatch.containsOnion = form.tasteProfile.containsOnion;
  if (enabledFields.containsCilantro) tastePatch.containsCilantro = form.tasteProfile.containsCilantro;
  if (enabledFields.sugar) tastePatch.sugar = form.tasteProfile.sugar;
  if (enabledFields.spice) tastePatch.spice = form.tasteProfile.spice;
  if (Object.keys(tastePatch).length) patch.tasteProfile = { ...(item?.tasteProfile || {}), ...tastePatch };
  return patch;
};

export default function BulkForYouMetadataModal({ isOpen, items = [], isSubmitting = false, submitProgress = null, submitErrors = [], onClose, onSubmit }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [enabledFields, setEnabledFields] = useState(DEFAULT_ENABLED);
  const hasEnabled = useMemo(() => Object.values(enabledFields).some(Boolean), [enabledFields]);
  const toggle = (field) => setEnabledFields((p) => ({ ...p, [field]: !p[field] }));
  const onSave = () => onSubmit?.({ form, enabledFields });

  return <Modal isOpen={isOpen} onClose={onClose} title="Khai báo khẩu vị hàng loạt">
    <div className="bulk-foryou-modal"><p className="bulk-foryou-modal__subtitle">Áp dụng thông tin khẩu vị, dị ứng và hương vị cho các món đã chọn.</p><p>{items.length} món</p>
      <label><input type="checkbox" checked={enabledFields.dietTags} onChange={() => toggle("dietTags")} /> Áp dụng chế độ ăn</label>
      <label><input type="checkbox" checked={enabledFields.allergenTags} onChange={() => toggle("allergenTags")} /> Áp dụng dị ứng</label>
      <label><input type="checkbox" checked={enabledFields.containsOnion} onChange={() => toggle("containsOnion")} /> Áp dụng có hành</label>
      <label><input type="checkbox" checked={enabledFields.containsCilantro} onChange={() => toggle("containsCilantro")} /> Áp dụng có ngò</label>
      <label><input type="checkbox" checked={enabledFields.sugar} onChange={() => toggle("sugar")} /> Áp dụng mức ngọt</label>
      <label><input type="checkbox" checked={enabledFields.spice} onChange={() => toggle("spice")} /> Áp dụng mức cay</label>
      <input placeholder="diet tags: vegan,keto" onChange={(e)=>setForm((p)=>({...p,dietTags:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)}))}/>
      <input placeholder="allergen tags: seafood,peanut" onChange={(e)=>setForm((p)=>({...p,allergenTags:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)}))}/>
      <div className="bulk-foryou-modal__actions"><button className="mm-btn mm-btn--secondary" onClick={onClose}>Đóng</button><button className="mm-btn mm-btn--primary" disabled={!hasEnabled || isSubmitting} onClick={onSave}>Lưu</button></div>
      {submitProgress && <p>Đang cập nhật: {submitProgress.done}/{submitProgress.total}</p>}
      {submitErrors?.length > 0 && <ul>{submitErrors.map((error)=><li key={error.id}>{error.name}: {error.message}</li>)}</ul>}
    </div>
  </Modal>;
}
