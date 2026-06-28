import { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

export const MY_BRANDS_QUERY = gql`
  query MyBrands {
    myBrands {
      id
      name
      slug
      logoUrl
      status
      restaurantCount
      restaurants(limit: 100) { id name brandId }
    }
  }
`;

export default function useBrandManagement() {
  const { data, loading, error, refetch } = useQuery(MY_BRANDS_QUERY, { fetchPolicy: "cache-and-network" });
  const brands = data?.myBrands || [];
  const [selectedBrandId, setSelectedBrandId] = useState(() => localStorage.getItem("manager.selectedBrandId") || "");
  useEffect(() => { if (!selectedBrandId && brands.length === 1) setSelectedBrandId(brands[0].id); }, [brands, selectedBrandId]);
  useEffect(() => { selectedBrandId ? localStorage.setItem("manager.selectedBrandId", selectedBrandId) : localStorage.removeItem("manager.selectedBrandId"); }, [selectedBrandId]);
  const selectedBrand = useMemo(() => brands.find((b) => b.id === selectedBrandId) || null, [brands, selectedBrandId]);
  return { brands, loading, error, refetch, selectedBrandId, setSelectedBrandId, selectedBrand, restaurantsInSelectedBrand: selectedBrand?.restaurants || [] };
}
