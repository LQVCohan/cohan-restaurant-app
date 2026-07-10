import React from "react";
import { Button, Switch, message } from "antd";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { gql, useMutation, useQuery } from "@apollo/client";
import "./RestaurantPublicationControl.scss";

const GET_RESTAURANT_PUBLICATION = gql`
  query RestaurantPublicationStatus($id: ID!) {
    restaurant(id: $id) {
      id
      name
      businessStatus
      publicationStatus
    }
  }
`;

const UPDATE_RESTAURANT_PUBLICATION = gql`
  mutation UpdateRestaurantPublication($id: ID!, $publicationStatus: String!) {
    updateRestaurant(
      id: $id
      input: { publicationStatus: $publicationStatus }
    ) {
      id
      name
      businessStatus
      publicationStatus
    }
  }
`;

const RestaurantPublicationControl = ({ restaurantId }) => {
  const { data, loading, error, refetch } = useQuery(
    GET_RESTAURANT_PUBLICATION,
    {
      variables: { id: restaurantId },
      skip: !restaurantId,
      fetchPolicy: "network-only",
    },
  );
  const [updatePublication, { loading: saving }] = useMutation(
    UPDATE_RESTAURANT_PUBLICATION,
  );

  if (!restaurantId) return null;

  const restaurant = data?.restaurant;
  const isPublished = restaurant?.publicationStatus === "published";
  const isBusinessActive = restaurant?.businessStatus === "active";

  const savePublication = async (checked) => {
    const publicationStatus = checked ? "published" : "draft";
    try {
      const result = await updatePublication({
        variables: { id: restaurantId, publicationStatus },
      });
      if (!result?.data?.updateRestaurant) {
        throw new Error("Mutation không trả về nhà hàng đã cập nhật.");
      }
      await refetch();
      message.success(
        checked
          ? "Nhà hàng đã được hiển thị trên trang khách."
          : "Nhà hàng đã được chuyển về chế độ nháp.",
      );
    } catch (updateError) {
      message.error(
        updateError?.message || "Không thể cập nhật trạng thái hiển thị.",
      );
    }
  };

  if (error) {
    return (
      <div className="restaurant-publication-slot">
        <section
          className="restaurant-publication-control is-error"
          aria-label="Trạng thái hiển thị nhà hàng"
        >
          <div className="restaurant-publication-control__icon" aria-hidden="true">
            <EyeOff size={18} />
          </div>
          <div className="restaurant-publication-control__copy">
            <span>Trang khách</span>
            <strong>Không tải được trạng thái hiển thị</strong>
          </div>
          <Button
            type="text"
            icon={<RefreshCw size={16} />}
            onClick={() => refetch()}
          >
            Thử lại
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="restaurant-publication-slot">
      <section
        className={`restaurant-publication-control ${isPublished ? "is-published" : "is-draft"}`}
        aria-label="Trạng thái hiển thị nhà hàng"
        aria-live="polite"
      >
        <div className="restaurant-publication-control__icon" aria-hidden="true">
          {isPublished ? <Eye size={18} /> : <EyeOff size={18} />}
        </div>

        <div className="restaurant-publication-control__copy">
          <span>Trang khách</span>
          <strong>
            {loading
              ? "Đang kiểm tra..."
              : isPublished
                ? "Đang công khai"
                : "Bản nháp"}
          </strong>
          <small>
            {isBusinessActive
              ? "Xuất hiện ở trang chính và danh sách nhà hàng."
              : "Cần bật trạng thái kinh doanh trước khi khách có thể thấy."}
          </small>
        </div>

        <div className="restaurant-publication-control__action">
          <span>Hiển thị công khai</span>
          <Switch
            aria-label="Hiển thị công khai"
            checked={isPublished}
            loading={loading || saving}
            disabled={loading || saving || !restaurant}
            onChange={savePublication}
          />
        </div>
      </section>
    </div>
  );
};

export default RestaurantPublicationControl;
