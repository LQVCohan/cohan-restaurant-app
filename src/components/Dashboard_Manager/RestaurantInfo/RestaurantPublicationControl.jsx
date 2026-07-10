import React from "react";
import { Alert, Button, Space, Switch, Typography, message } from "antd";
import { gql, useMutation, useQuery } from "@apollo/client";

const { Text } = Typography;

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
      <Alert
        type="error"
        showIcon
        message="Không tải được trạng thái hiển thị nhà hàng"
        action={<Button onClick={() => refetch()}>Thử lại</Button>}
      />
    );
  }

  return (
    <Alert
      type={isPublished && isBusinessActive ? "success" : "warning"}
      showIcon
      message={
        loading
          ? "Đang kiểm tra trạng thái hiển thị..."
          : isPublished
            ? "Nhà hàng đang hiển thị trên trang khách"
            : "Nhà hàng đang ở chế độ nháp"
      }
      description={
        isBusinessActive
          ? "Bật công khai để nhà hàng xuất hiện ở trang chính và danh sách nhà hàng."
          : "Nhà hàng phải có trạng thái kinh doanh đang hoạt động mới xuất hiện ở trang khách."
      }
      action={
        <Space>
          <Switch
            aria-label="Hiển thị công khai"
            checked={isPublished}
            loading={loading || saving}
            disabled={loading || saving || !restaurant}
            onChange={savePublication}
          />
          <Text>{isPublished ? "Công khai" : "Bản nháp"}</Text>
        </Space>
      }
    />
  );
};

export default RestaurantPublicationControl;
