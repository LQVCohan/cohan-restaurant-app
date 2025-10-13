// src/hooks/useRestaurant.js
import { useState, useEffect, useMemo } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

/* GraphQL: lấy 1 nhà hàng theo id */
const GET_RESTAURANT = gql`
  query GetRestaurant($id: ID!) {
    restaurant(id: $id) {
      id
      name
      avatar
      coverImage
      spaceImages
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      phone
      email
      featuredMenu
      amenities
      seatingCapacity
      priceRange
      openingHours
      closingHours
      description
      notesOnHours
      notesOnAmenities
      cuisineType
      status
      avgRating
      manager {
        id
        fullName
        email
      }
      tables {
        id
        code
        capacity
        status
      }
      categories {
        id
        name
        parentId
        order
      }
    }
  }
`;

export const useRestaurant = (restaurantId) => {
  const [error, setError] = useState(null);

  const {
    data,
    loading,
    error: gqlError,
    refetch,
  } = useQuery(GET_RESTAURANT, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    onError: (e) => {
      setError(
        e?.graphQLErrors?.[0]?.message ||
          e?.networkError?.message ||
          "Không thể tải nhà hàng"
      );
    },
  });

  useEffect(() => {
    if (restaurantId) {
      setError(null);
      refetch && refetch({ id: restaurantId });
    }
  }, [restaurantId, refetch]);

  const restaurant = useMemo(() => {
    const r = data?.restaurant;
    if (!r) return null;

    // Ánh xạ về shape mà FE đang dùng
    return {
      ...r,
      photos: r.spaceImages || [],
      cuisine: r.cuisineType || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
      rating: typeof r.avgRating === "number" ? r.avgRating : undefined,
      // fallback hiển thị
      image: r.coverImage || r.avatar || "",
      // một vài field cho UI khác có thể cần
      addressText: [
        r.address?.line1,
        r.address?.line2,
        r.address?.ward,
        r.address?.district,
        r.address?.city,
        r.address?.country,
      ]
        .filter(Boolean)
        .join(", "),
    };
  }, [data]);

  const toggleFavorite = () => {
    if (!restaurant) return;
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    const isFavorite = favorites.includes(restaurant.id);
    const updated = isFavorite
      ? favorites.filter((id) => id !== restaurant.id)
      : [...favorites, restaurant.id];
    localStorage.setItem("favorites", JSON.stringify(updated));
  };

  const shareRestaurant = async () => {
    if (!restaurant) return;
    const shareData = {
      title: restaurant.name,
      text: `Khám phá ${restaurant.name} - ${restaurant.cuisine}${
        restaurant.district ? ` tại ${restaurant.district}` : ""
      }`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Đã sao chép link vào clipboard!");
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  return {
    restaurant,
    loading,
    error: error || (gqlError && "Không thể tải nhà hàng"),
    toggleFavorite,
    shareRestaurant,
  };
};
