import { useEffect, useMemo, useRef } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";

import { useNotification } from "@/hooks/useNotification";

const TABLE_PATH_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;

const TABLE_PROOF_UPDATES = gql`
  query PublicTableProofUpdates(
    $restaurantId: ID!
    $tableId: ID!
    $token: String!
  ) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      orders {
        id
        orderCode
        items {
          id
          name
          requiresProofImage
          proofImages
        }
      }
    }
  }
`;

export default function TableProofUpdateNotifier() {
  const location = useLocation();
  const { showNotification } = useNotification();
  const match = location.pathname.match(TABLE_PATH_PATTERN);
  const restaurantId = match?.[1] || "";
  const tableId = match?.[2] || "";
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search],
  );
  const previousProofKeysRef = useRef(null);

  const { data } = useQuery(TABLE_PROOF_UPDATES, {
    variables: { restaurantId, tableId, token },
    skip: !restaurantId || !tableId || !token,
    fetchPolicy: "cache-and-network",
    pollInterval: 12000,
  });

  const proofEntries = useMemo(
    () =>
      (data?.publicActiveTableSessionOrders?.orders || []).flatMap((order) =>
        (order.items || []).flatMap((item) =>
          item.requiresProofImage
            ? (item.proofImages || []).map((src) => ({
                key: `${order.id}:${item.id}:${src}`,
                itemName: item.name,
              }))
            : [],
        ),
      ),
    [data?.publicActiveTableSessionOrders?.orders],
  );

  useEffect(() => {
    const nextKeys = new Set(proofEntries.map((entry) => entry.key));
    const previousKeys = previousProofKeysRef.current;
    previousProofKeysRef.current = nextKeys;
    if (!previousKeys) return;

    const added = proofEntries.filter((entry) => !previousKeys.has(entry.key));
    if (!added.length) return;

    const uniqueNames = [...new Set(added.map((entry) => entry.itemName).filter(Boolean))];
    showNotification(
      uniqueNames.length === 1
        ? `Nhân viên vừa cập nhật ảnh minh chứng cân ký cho ${uniqueNames[0]}.`
        : `Nhân viên vừa cập nhật ${added.length} ảnh minh chứng cân ký.`,
      "success",
    );
  }, [proofEntries, showNotification]);

  useEffect(() => {
    previousProofKeysRef.current = null;
  }, [restaurantId, tableId, token]);

  return null;
}
