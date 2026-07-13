import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { gql } from "@apollo/client";

import { apolloClient } from "@/apollo/client";
import { toUserFacingErrorMessage } from "@/utils/userFacingError";
import "@/styles/CustomerReviewOwnerPortal.css";

const GET_OWNER_REVIEW_CONTEXT = gql`
  query GetOwnedRestaurantReviews($restaurantId: ID!) {
    me {
      id
    }
    reviews(
      restaurantId: $restaurantId
      targetType: "restaurant"
      limit: 100
      skip: 0
    ) {
      items {
        id
        customerId
        rating
        title
        content
        staffId
        status
        createdAt
        updatedAt
      }
    }
    publicRestaurantStaff(restaurantId: $restaurantId) {
      id
      fullName
    }
  }
`;

const UPDATE_OWN_REVIEW = gql`
  mutation UpdateOwnReviewFromCustomerPage(
    $id: ID!
    $input: ReviewUpdateInput!
  ) {
    updateReview(id: $id, input: $input) {
      id
      rating
      title
      content
      staffId
      status
      updatedAt
    }
  }
`;

const DELETE_OWN_REVIEW = gql`
  mutation DeleteOwnReviewFromCustomerPage($id: ID!) {
    deleteReview(id: $id)
  }
`;

const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 120;
const MANAGER_ROOT_ID = "customer-review-owner-manager-root";
const ACTION_HOST_ATTRIBUTE = "data-owner-review-actions-host";
const OWNER_REVIEW_ATTRIBUTE = "data-owner-review-id";

function getRestaurantId() {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/\/restaurant\/([^/?#]+)/i);
  return decodeURIComponent(match?.[1] || "");
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function isMeaningfullyEdited(review) {
  const created = new Date(review?.createdAt).getTime();
  const updated = new Date(review?.updatedAt).getTime();
  return (
    Number.isFinite(created) &&
    Number.isFinite(updated) &&
    updated - created > 60_000
  );
}

function cleanupOwnerDecorations(validIds = new Set()) {
  document.querySelectorAll(`[${OWNER_REVIEW_ATTRIBUTE}]`).forEach((card) => {
    const reviewId = card.getAttribute(OWNER_REVIEW_ATTRIBUTE) || "";
    if (validIds.has(reviewId)) return;
    card.classList.remove("review-item--owner");
    card.removeAttribute(OWNER_REVIEW_ATTRIBUTE);
    card.querySelector(`[${ACTION_HOST_ATTRIBUTE}]`)?.remove();
    card.querySelector(".review-owner-inline-badge")?.remove();
    card.querySelector(".review-owner-edited-badge")?.remove();
  });
}

function findReviewCard(review, usedCards) {
  const expectedTitle = normalizeText(review?.title || "");
  const expectedContent = normalizeText(review?.content || "");
  const cards = Array.from(
    document.querySelectorAll(".reviews-section .reviews-list .review-item"),
  );

  return (
    cards.find((card) => {
      if (usedCards.has(card)) return false;
      const title = normalizeText(
        card.querySelector(".review-title")?.textContent || "",
      );
      const content = normalizeText(
        card.querySelector(".review-text")?.textContent || "",
      );
      return title === expectedTitle && content === expectedContent;
    }) || null
  );
}

function decorateReviewCard(review, card) {
  card.classList.add("review-item--owner");
  card.setAttribute(OWNER_REVIEW_ATTRIBUTE, String(review.id));

  const name = card.querySelector(".reviewer-name");
  if (name && !card.querySelector(".review-owner-inline-badge")) {
    const badge = document.createElement("span");
    badge.className = "review-owner-inline-badge";
    badge.textContent = "Đánh giá của bạn";
    name.insertAdjacentElement("afterend", badge);
  }

  const meta = card.querySelector(".review-meta");
  if (
    meta &&
    isMeaningfullyEdited(review) &&
    !card.querySelector(".review-owner-edited-badge")
  ) {
    const badge = document.createElement("span");
    badge.className = "review-owner-edited-badge";
    badge.textContent = "Đã chỉnh sửa";
    meta.appendChild(badge);
  }

  const actionRow = card.querySelector(".review-actions");
  if (!actionRow) return null;

  let host = actionRow.querySelector(`[${ACTION_HOST_ATTRIBUTE}]`);
  if (!host) {
    host = document.createElement("span");
    host.setAttribute(ACTION_HOST_ATTRIBUTE, String(review.id));
    actionRow.appendChild(host);
  }
  return host;
}

function OwnerReviewEditor({ review, staffOptions, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    rating: Number(review?.rating || 5),
    title: review?.title || "",
    content: review?.content || "",
    staffId: review?.staffId || "",
  }));
  const [localError, setLocalError] = useState("");

  const submit = () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (content.length < MIN_CONTENT_LENGTH) {
      setLocalError(
        `Nội dung đánh giá phải có ít nhất ${MIN_CONTENT_LENGTH} ký tự.`,
      );
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      setLocalError(`Nội dung đánh giá tối đa ${MAX_CONTENT_LENGTH} ký tự.`);
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      setLocalError(`Tiêu đề đánh giá tối đa ${MAX_TITLE_LENGTH} ký tự.`);
      return;
    }
    setLocalError("");
    onSave({
      rating: Number(form.rating),
      title,
      content,
      staffId: form.staffId || null,
    });
  };

  return (
    <div
      className="review-owner-portal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="review-owner-portal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-review-edit-title"
      >
        <header>
          <div>
            <span>Đánh giá của bạn</span>
            <h3 id="owner-review-edit-title">Chỉnh sửa đánh giá</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="review-owner-portal-form">
          <div className="review-owner-rating-field">
            <span>Điểm đánh giá</span>
            <div role="radiogroup" aria-label="Điểm đánh giá">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-label={`${value} sao`}
                  aria-checked={Number(form.rating) === value}
                  className={value <= Number(form.rating) ? "is-active" : ""}
                  onClick={() =>
                    setForm((current) => ({ ...current, rating: value }))
                  }
                  disabled={busy}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label>
            <span>Tiêu đề</span>
            <input
              value={form.title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              disabled={busy}
            />
            <small>{form.title.length}/{MAX_TITLE_LENGTH} ký tự</small>
          </label>

          <label>
            <span>Nội dung đánh giá</span>
            <textarea
              rows={5}
              value={form.content}
              minLength={MIN_CONTENT_LENGTH}
              maxLength={MAX_CONTENT_LENGTH}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              disabled={busy}
            />
            <small>
              Tối thiểu {MIN_CONTENT_LENGTH} ký tự · {form.content.length}/
              {MAX_CONTENT_LENGTH}
            </small>
          </label>

          <label>
            <span>Nhân viên phục vụ (không bắt buộc)</span>
            <select
              value={form.staffId}
              onChange={(event) =>
                setForm((current) => ({ ...current, staffId: event.target.value }))
              }
              disabled={busy}
            >
              <option value="">Không gắn với nhân viên cụ thể</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </label>

          {(localError || error) && (
            <p className="review-owner-portal-error" role="alert">
              {localError || error}
            </p>
          )}

          <footer>
            <button
              type="button"
              className="owner-review-cancel"
              onClick={onClose}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="button"
              className="owner-review-save"
              onClick={submit}
              disabled={busy}
            >
              {busy ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function DeleteOwnerReviewDialog({ busy, onClose, onConfirm }) {
  return (
    <div
      className="review-owner-portal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="review-owner-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="owner-review-delete-title"
      >
        <div aria-hidden="true">🗑️</div>
        <h3 id="owner-review-delete-title">Xóa đánh giá này?</h3>
        <p>
          Đánh giá sẽ biến mất khỏi trang nhà hàng và điểm trung bình sẽ được tính
          lại. Thao tác này không thể hoàn tác.
        </p>
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>
            Giữ lại
          </button>
          <button
            type="button"
            className="owner-review-delete"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xóa..." : "Xóa đánh giá"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function OwnerActionButtons({ review, onEdit, onDelete }) {
  const isReviewing = review.status === "reported";
  return (
    <span className="review-owner-inline-actions">
      <button
        type="button"
        className="review-action review-owner-action review-owner-action--edit"
        onClick={() => onEdit(review)}
        disabled={isReviewing}
        title={isReviewing ? "Tạm khóa sửa trong lúc đánh giá được xem xét" : "Sửa đánh giá"}
        aria-label="Sửa đánh giá của bạn"
      >
        ✎ Sửa
      </button>
      <button
        type="button"
        className="review-action review-owner-action review-owner-action--delete"
        onClick={() => onDelete(review)}
        aria-label="Xóa đánh giá của bạn"
      >
        🗑 Xóa
      </button>
    </span>
  );
}

function CustomerReviewOwnerManager({ restaurantId }) {
  const [reviews, setReviews] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [targets, setTargets] = useState([]);
  const [editingReview, setEditingReview] = useState(null);
  const [deletingReview, setDeletingReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const result = await apolloClient.query({
        query: GET_OWNER_REVIEW_CONTEXT,
        variables: { restaurantId },
        fetchPolicy: "network-only",
        errorPolicy: "all",
      });
      const viewerId = String(result?.data?.me?.id || "");
      if (!viewerId) {
        setReviews([]);
        setStaffOptions([]);
        return;
      }
      setReviews(
        (result?.data?.reviews?.items || []).filter(
          (review) =>
            String(review?.customerId || "") === viewerId &&
            review?.status !== "hidden",
        ),
      );
      setStaffOptions(result?.data?.publicRestaurantStaff || []);
      setError("");
    } catch (loadError) {
      setReviews([]);
      setError(
        toUserFacingErrorMessage(loadError, "Không thể tải đánh giá của bạn."),
      );
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const validIds = new Set(reviews.map((review) => String(review.id)));
    let frameId = null;

    const sync = () => {
      frameId = null;
      cleanupOwnerDecorations(validIds);
      const usedCards = new Set();
      const nextTargets = [];

      reviews.forEach((review) => {
        const existingCard = document.querySelector(
          `[${OWNER_REVIEW_ATTRIBUTE}="${CSS.escape(String(review.id))}"]`,
        );
        const card = existingCard || findReviewCard(review, usedCards);
        if (!card) return;
        usedCards.add(card);
        const host = decorateReviewCard(review, card);
        if (host) nextTargets.push({ review, host });
      });

      setTargets((current) => {
        const unchanged =
          current.length === nextTargets.length &&
          current.every(
            (target, index) =>
              target.review.id === nextTargets[index]?.review.id &&
              target.host === nextTargets[index]?.host &&
              target.review.updatedAt === nextTargets[index]?.review.updatedAt &&
              target.review.status === nextTargets[index]?.review.status,
          );
        return unchanged ? current : nextTargets;
      });
    };

    const scheduleSync = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(sync);
    };

    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      cleanupOwnerDecorations(new Set());
    };
  }, [reviews]);

  useEffect(() => {
    if (!editingReview && !deletingReview) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || busy) return;
      setEditingReview(null);
      setDeletingReview(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, deletingReview, editingReview]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const refreshAllReviews = useCallback(async () => {
    await apolloClient.refetchQueries({ include: "active" });
    await load();
  }, [load]);

  const saveReview = async (input) => {
    if (!editingReview?.id || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apolloClient.mutate({
        mutation: UPDATE_OWN_REVIEW,
        variables: { id: editingReview.id, input },
      });
      if (!result?.data?.updateReview?.id)
        throw new Error("Không thể lưu thay đổi.");
      setEditingReview(null);
      setMessage("Đã cập nhật đánh giá của bạn.");
      await refreshAllReviews();
    } catch (saveError) {
      setError(
        toUserFacingErrorMessage(saveError, "Không thể cập nhật đánh giá."),
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteReview = async () => {
    if (!deletingReview?.id || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await apolloClient.mutate({
        mutation: DELETE_OWN_REVIEW,
        variables: { id: deletingReview.id },
      });
      if (result?.data?.deleteReview !== true)
        throw new Error("Không thể xóa đánh giá.");
      setDeletingReview(null);
      setMessage("Đã xóa đánh giá của bạn.");
      await refreshAllReviews();
    } catch (deleteError) {
      setError(toUserFacingErrorMessage(deleteError, "Không thể xóa đánh giá."));
    } finally {
      setBusy(false);
    }
  };

  const portals = useMemo(
    () =>
      targets.map(({ review, host }) =>
        createPortal(
          <OwnerActionButtons
            key={review.id}
            review={review}
            onEdit={(item) => {
              setError("");
              setEditingReview(item);
            }}
            onDelete={(item) => {
              setError("");
              setDeletingReview(item);
            }}
          />,
          host,
          review.id,
        ),
      ),
    [targets],
  );

  return (
    <>
      {portals}
      {message && (
        <div className="review-owner-toast" role="status">
          ✓ {message}
        </div>
      )}
      {error && !editingReview && !deletingReview && (
        <div className="review-owner-toast review-owner-toast--error" role="alert">
          {error}
        </div>
      )}
      {editingReview && (
        <OwnerReviewEditor
          review={editingReview}
          staffOptions={staffOptions}
          busy={busy}
          error={error}
          onClose={() => {
            setError("");
            setEditingReview(null);
          }}
          onSave={saveReview}
        />
      )}
      {deletingReview && (
        <DeleteOwnerReviewDialog
          busy={busy}
          onClose={() => {
            setError("");
            setDeletingReview(null);
          }}
          onConfirm={deleteReview}
        />
      )}
    </>
  );
}

const roots = new Map();

function mountCustomerReviewOwnerManager() {
  const restaurantId = getRestaurantId();
  const reviewSection = document.querySelector(".reviews-section.tab-panel-shell");
  if (!restaurantId || !reviewSection) return;

  let host = document.getElementById(MANAGER_ROOT_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MANAGER_ROOT_ID;
    document.body.appendChild(host);
  }

  if (!roots.has(host)) roots.set(host, createRoot(host));
  roots.get(host).render(
    <CustomerReviewOwnerManager restaurantId={restaurantId} />,
  );
}

export function installCustomerReviewOwnerActions() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let frameId = null;
  const scheduleMount = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      mountCustomerReviewOwnerManager();
    });
  };

  scheduleMount();
  const observer = new MutationObserver(scheduleMount);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleMount);
  window.addEventListener("hashchange", scheduleMount);
}

export default installCustomerReviewOwnerActions;
