import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { message } from "antd";
import {
  FiArrowRight,
  FiBookOpen,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiList,
  FiPackage,
  FiX,
} from "react-icons/fi";
import { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";
import "./RestaurantCuisineOnboarding.scss";

const GET_CUISINE_TEMPLATES = gql`
  query RestaurantCuisineTemplates {
    restaurantCuisineTemplates {
      key
      version
      name
      cuisineType
      description
      ingredientCount
      menuCount
      menuItemCount
      recipeCount
      dishNames
    }
  }
`;

const APPLY_CUISINE_TEMPLATE = gql`
  mutation ApplyRestaurantCuisineTemplate($restaurantId: ID!, $templateKey: String!) {
    applyRestaurantCuisineTemplate(restaurantId: $restaurantId, templateKey: $templateKey) {
      success
      ingredientCount
      menuCount
      menuItemCount
      warnings
      restaurant {
        id
        name
        cuisineType
        publicationStatus
        initialSetup {
          status
          templateKey
          templateVersion
          completedAt
          completedBy
        }
      }
    }
  }
`;

const SKIP_CUISINE_SETUP = gql`
  mutation SkipRestaurantCuisineSetup($restaurantId: ID!) {
    skipRestaurantCuisineSetup(restaurantId: $restaurantId) {
      id
      initialSetup {
        status
        completedAt
        completedBy
      }
    }
  }
`;

const TEMPLATE_ICONS = {
  vietnamese: "🍜",
  korean: "🥘",
  japanese: "🍣",
  italian: "🍝",
  seafood: "🦐",
  countryside: "🍚",
  thai: "🌶️",
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message || error?.message || fallback;

const readFocusable = (node) =>
  [...(node?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), summary, [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) || [])].filter((element) => !element.hasAttribute("hidden"));

export default function RestaurantCuisineOnboarding({ restaurant, openRequest = 0 }) {
  const restaurantId = String(restaurant?.id || restaurant?._id || "");
  const pending = restaurant?.initialSetup?.status === "pending";
  const [dismissed, setDismissed] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [submitError, setSubmitError] = useState("");
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const { data, loading, error: queryError } = useQuery(GET_CUISINE_TEMPLATES, {
    skip: !restaurantId || !pending || dismissed,
    fetchPolicy: "cache-first",
  });
  const templates = data?.restaurantCuisineTemplates || [];
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) || null,
    [selectedKey, templates],
  );

  const mutationOptions = {
    refetchQueries: [MY_BRANDS_QUERY],
    awaitRefetchQueries: true,
  };
  const [applyTemplate, { loading: applying }] = useMutation(
    APPLY_CUISINE_TEMPLATE,
    mutationOptions,
  );
  const [skipSetup, { loading: skipping }] = useMutation(
    SKIP_CUISINE_SETUP,
    mutationOptions,
  );
  const busy = applying || skipping;

  useEffect(() => {
    setDismissed(false);
    setSelectedKey("");
    setSubmitError("");
  }, [restaurantId]);

  useEffect(() => {
    if (!pending) return;
    setDismissed(false);
    setSubmitError("");
  }, [openRequest, pending]);

  useEffect(() => {
    if (!selectedKey && templates[0]?.key) setSelectedKey(templates[0].key);
  }, [selectedKey, templates]);

  useEffect(() => {
    if (!pending || dismissed) return undefined;
    previousFocusRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      readFocusable(dialogRef.current)[0]?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        setDismissed(true);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = readFocusable(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [busy, dismissed, pending]);

  if (!restaurantId || !pending || dismissed) return null;

  const handleApply = async () => {
    if (!selectedTemplate || busy) return;
    setSubmitError("");
    try {
      const result = await applyTemplate({
        variables: { restaurantId, templateKey: selectedTemplate.key },
      });
      const applied = result?.data?.applyRestaurantCuisineTemplate;
      message.success(
        `Đã tạo ${applied?.menuItemCount || selectedTemplate.menuItemCount} món mẫu cho ${restaurant.name}`,
      );
      window.dispatchEvent(new CustomEvent("manager:navigate", {
        detail: { page: "menu", source: "cuisine-onboarding" },
      }));
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Không thể thiết lập chi nhánh. Vui lòng thử lại."));
    }
  };

  const handleSkip = async () => {
    if (busy) return;
    setSubmitError("");
    try {
      await skipSetup({ variables: { restaurantId } });
      message.success("Đã chuyển sang tự thiết lập chi nhánh");
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Không thể bỏ qua thiết lập ban đầu."));
    }
  };

  return createPortal(
    <div className="cuisine-onboarding" role="presentation">
      <div
        ref={dialogRef}
        className="cuisine-onboarding__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cuisine-onboarding-title"
        aria-describedby="cuisine-onboarding-description"
      >
        <button
          className="cuisine-onboarding__close"
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Để sau"
          disabled={busy}
        >
          <FiX aria-hidden="true" />
        </button>

        <div className="cuisine-onboarding__intro">
          <span className="cuisine-onboarding__eyebrow">THIẾT LẬP CHI NHÁNH MỚI</span>
          <h2 id="cuisine-onboarding-title">Chọn mô hình ẩm thực cho {restaurant.name}</h2>
          <p id="cuisine-onboarding-description">
            Xem trước dữ liệu của từng mẫu rồi chọn gói phù hợp. COHAN sẽ tạo món ăn,
            nguyên liệu và công thức chế biến để bạn tiếp tục chỉnh sửa trước khi xuất bản.
          </p>
          <div className="cuisine-onboarding__draft-note">
            <FiClock aria-hidden="true" /> Chi nhánh vẫn ở trạng thái bản nháp sau khi thiết lập.
          </div>
        </div>

        {loading ? (
          <div className="cuisine-onboarding__status" role="status">
            Đang tải các mô hình ẩm thực…
          </div>
        ) : queryError ? (
          <div className="cuisine-onboarding__error" role="alert">
            {getErrorMessage(queryError, "Không thể tải danh sách mô hình ẩm thực.")}
          </div>
        ) : templates.length === 0 ? (
          <div className="cuisine-onboarding__status" role="status">
            Chưa có mô hình ẩm thực để lựa chọn.
          </div>
        ) : (
          <fieldset className="cuisine-onboarding__templates" disabled={busy}>
            <legend className="sr-only">Mô hình ẩm thực</legend>
            {templates.map((template) => {
              const selected = selectedKey === template.key;
              const dishNames = Array.isArray(template.dishNames) ? template.dishNames : [];

              return (
                <article
                  key={template.key}
                  className={`cuisine-template-card ${selected ? "cuisine-template-card--selected" : ""}`}
                >
                  <label className="cuisine-template-card__select">
                    <input
                      type="radio"
                      name="restaurant-cuisine-template"
                      value={template.key}
                      checked={selected}
                      onChange={(event) => {
                        setSelectedKey(event.target.value);
                        setSubmitError("");
                      }}
                    />
                    <span className="cuisine-template-card__icon" aria-hidden="true">
                      {TEMPLATE_ICONS[template.key] || "🍽️"}
                    </span>
                    <span className="cuisine-template-card__body">
                      <span className="cuisine-template-card__heading">
                        <strong>{template.name}</strong>
                        {selected ? (
                          <span className="cuisine-template-card__selected-label">
                            <FiCheck aria-hidden="true" /> Đã chọn
                          </span>
                        ) : null}
                      </span>
                      <span className="cuisine-template-card__description">
                        {template.description}
                      </span>
                      <span className="cuisine-template-card__metrics">
                        <span>
                          <FiList aria-hidden="true" />
                          <strong>{template.menuItemCount}</strong>
                          <small>Món</small>
                        </span>
                        <span>
                          <FiPackage aria-hidden="true" />
                          <strong>{template.ingredientCount}</strong>
                          <small>Nguyên liệu</small>
                        </span>
                        <span>
                          <FiBookOpen aria-hidden="true" />
                          <strong>{template.recipeCount}</strong>
                          <small>Công thức</small>
                        </span>
                      </span>
                    </span>
                  </label>

                  <details className="cuisine-template-card__details">
                    <summary>
                      <span>Xem {dishNames.length || template.menuItemCount} món sẽ được tạo</span>
                      <FiChevronDown aria-hidden="true" />
                    </summary>
                    <ul>
                      {dishNames.map((dishName) => (
                        <li key={dishName}>{dishName}</li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
          </fieldset>
        )}

        {submitError ? (
          <div className="cuisine-onboarding__error" role="alert">{submitError}</div>
        ) : null}

        <div className="cuisine-onboarding__footer">
          <div>
            <button
              type="button"
              className="cuisine-onboarding__text-button"
              onClick={() => setDismissed(true)}
              disabled={busy}
            >
              Để sau
            </button>
            <button
              type="button"
              className="cuisine-onboarding__text-button"
              onClick={handleSkip}
              disabled={busy}
            >
              {skipping ? "Đang chuyển…" : "Tôi sẽ tự thiết lập"}
            </button>
          </div>
          <button
            type="button"
            className="cuisine-onboarding__primary"
            onClick={handleApply}
            disabled={!selectedTemplate || loading || busy || Boolean(queryError)}
          >
            {applying ? "Đang tạo dữ liệu mẫu…" : "Thiết lập nhà hàng"}
            {!applying ? <FiArrowRight aria-hidden="true" /> : null}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
