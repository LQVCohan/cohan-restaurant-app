import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import "./BulkForYouMetadataModal.scss";

const DIET_OPTIONS = [
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
  { value: "halal", label: "Halal" },
];

const ALLERGEN_OPTIONS = [
  { value: "seafood", label: "Hải sản" },
  { value: "peanut", label: "Đậu phộng" },
  { value: "milk", label: "Sữa" },
  { value: "egg", label: "Trứng" },
  { value: "gluten", label: "Gluten" },
];

const SUGAR_OPTIONS = [0, 30, 50, 70, 100];
const SPICE_OPTIONS = ["Không", "Vừa", "Nồng", "Rất cay"];

const createDefaultForm = () => ({
  dietTags: [],
  allergenTags: [],
  tasteProfile: {
    containsOnion: false,
    containsCilantro: false,
    sugar: 100,
    spice: "Vừa",
  },
});

const createDefaultEnabled = () => ({
  dietTags: false,
  allergenTags: false,
  containsOnion: false,
  containsCilantro: false,
  sugar: false,
  spice: false,
});

export const buildBulkForYouPatch = (item, form, enabledFields) => {
  const patch = {};

  if (enabledFields.dietTags) {
    patch.dietTags = form.dietTags;
  }

  if (enabledFields.allergenTags) {
    patch.allergenTags = form.allergenTags;
  }

  const tastePatch = {};

  if (enabledFields.containsOnion) {
    tastePatch.containsOnion = form.tasteProfile.containsOnion;
  }

  if (enabledFields.containsCilantro) {
    tastePatch.containsCilantro = form.tasteProfile.containsCilantro;
  }

  if (enabledFields.sugar) {
    tastePatch.sugar = form.tasteProfile.sugar;
  }

  if (enabledFields.spice) {
    tastePatch.spice = form.tasteProfile.spice;
  }

  if (Object.keys(tastePatch).length > 0) {
    patch.tasteProfile = {
      ...(item?.tasteProfile || {}),
      ...tastePatch,
    };
  }

  return patch;
};

export default function BulkForYouMetadataModal({
  isOpen,
  items = [],
  isSubmitting = false,
  submitProgress = null,
  submitErrors = [],
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(createDefaultForm);
  const [enabledFields, setEnabledFields] = useState(createDefaultEnabled);

  useEffect(() => {
    if (!isOpen && !isSubmitting) {
      setForm(createDefaultForm());
      setEnabledFields(createDefaultEnabled());
    }
  }, [isOpen, isSubmitting]);

  const hasEnabled = useMemo(
    () => Object.values(enabledFields).some(Boolean),
    [enabledFields],
  );

  const isSaveDisabled = !hasEnabled || isSubmitting || items.length === 0;

  const toggleEnabled = (field) => {
    setEnabledFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleTag = (group, value) => {
    setForm((prev) => {
      const current = Array.isArray(prev[group]) ? prev[group] : [];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return { ...prev, [group]: next };
    });
  };

  const setTasteValue = (field, value) => {
    setForm((prev) => ({
      ...prev,
      tasteProfile: {
        ...prev.tasteProfile,
        [field]: value,
      },
    }));
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const handleSubmit = () => {
    if (isSaveDisabled) return;
    onSubmit?.({ form, enabledFields });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Khai báo khẩu vị hàng loạt">
      <div className="bulk-foryou-modal">
        <p className="bulk-foryou-modal__subtitle">
          Áp dụng thông tin khẩu vị, dị ứng và hương vị cho các món đã chọn.
        </p>
        <p className="bulk-foryou-modal__target">Áp dụng cho {items.length} món</p>

        <section className="bulk-foryou-modal__group">
          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.dietTags}
              onChange={() => toggleEnabled("dietTags")}
            />
            Áp dụng chế độ ăn
          </label>
          {enabledFields.dietTags && (
            <div className="bulk-foryou-modal__options">
              {DIET_OPTIONS.map((option) => (
                <label className="bulk-foryou-modal__option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={form.dietTags.includes(option.value)}
                    onChange={() => toggleTag("dietTags", option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bulk-foryou-modal__group">
          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.allergenTags}
              onChange={() => toggleEnabled("allergenTags")}
            />
            Áp dụng dị ứng
          </label>
          {enabledFields.allergenTags && (
            <div className="bulk-foryou-modal__options">
              {ALLERGEN_OPTIONS.map((option) => (
                <label className="bulk-foryou-modal__option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={form.allergenTags.includes(option.value)}
                    onChange={() => toggleTag("allergenTags", option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bulk-foryou-modal__group">
          <h4 className="bulk-foryou-modal__group-title">Khẩu vị / hương vị</h4>

          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.containsOnion}
              onChange={() => toggleEnabled("containsOnion")}
            />
            Áp dụng thông tin hành
          </label>
          {enabledFields.containsOnion && (
            <div className="bulk-foryou-modal__segmented">
              <button
                type="button"
                className={form.tasteProfile.containsOnion ? "active" : ""}
                onClick={() => setTasteValue("containsOnion", true)}
              >
                Có hành
              </button>
              <button
                type="button"
                className={!form.tasteProfile.containsOnion ? "active" : ""}
                onClick={() => setTasteValue("containsOnion", false)}
              >
                Không hành
              </button>
            </div>
          )}

          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.containsCilantro}
              onChange={() => toggleEnabled("containsCilantro")}
            />
            Áp dụng thông tin ngò
          </label>
          {enabledFields.containsCilantro && (
            <div className="bulk-foryou-modal__segmented">
              <button
                type="button"
                className={form.tasteProfile.containsCilantro ? "active" : ""}
                onClick={() => setTasteValue("containsCilantro", true)}
              >
                Có ngò
              </button>
              <button
                type="button"
                className={!form.tasteProfile.containsCilantro ? "active" : ""}
                onClick={() => setTasteValue("containsCilantro", false)}
              >
                Không ngò
              </button>
            </div>
          )}

          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.sugar}
              onChange={() => toggleEnabled("sugar")}
            />
            Áp dụng mức ngọt
          </label>
          {enabledFields.sugar && (
            <select
              value={form.tasteProfile.sugar}
              onChange={(event) => setTasteValue("sugar", Number(event.target.value))}
            >
              {SUGAR_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}

          <label className="bulk-foryou-modal__apply">
            <input
              type="checkbox"
              checked={enabledFields.spice}
              onChange={() => toggleEnabled("spice")}
            />
            Áp dụng mức cay
          </label>
          {enabledFields.spice && (
            <select
              value={form.tasteProfile.spice}
              onChange={(event) => setTasteValue("spice", event.target.value)}
            >
              {SPICE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </section>

        {submitProgress && (
          <p className="bulk-foryou-modal__progress">
            Đang cập nhật: {submitProgress.done}/{submitProgress.total}
          </p>
        )}

        {submitErrors.length > 0 && (
          <ul className="bulk-foryou-modal__errors">
            {submitErrors.map((error) => (
              <li key={error.id}>
                {error.name}: {error.message}
              </li>
            ))}
          </ul>
        )}

        <div className="bulk-foryou-modal__actions">
          <button
            className="mm-btn mm-btn--secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Đóng
          </button>
          <button
            className="mm-btn mm-btn--primary"
            disabled={isSaveDisabled}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
