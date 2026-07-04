import React, { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { ChefHat, GlassWater } from "lucide-react";
import styles from "./PrepStationControl.module.scss";

const UPDATE_PREP_STATION = gql`
  mutation UpdateMenuItemPrepStation($input: UpdateMenuItemInput!) {
    updateMenuItem(input: $input) {
      id
      prepStation
    }
  }
`;

const STATION_OPTIONS = [
  { value: "kitchen", label: "Bếp chính", Icon: ChefHat },
  { value: "bar", label: "Quầy bar", Icon: GlassWater },
];

const PrepStationControl = ({ item, canUpdate }) => {
  const itemId = item?.id || item?._id || null;
  const currentStation = item?.prepStation || "";
  const [error, setError] = useState("");
  const [updatePrepStation, { loading }] = useMutation(UPDATE_PREP_STATION);

  const handleChange = async (event) => {
    event.stopPropagation();
    const prepStation = event.target.value;
    if (!itemId || !canUpdate || !prepStation || prepStation === currentStation) {
      return;
    }

    setError("");
    try {
      await updatePrepStation({
        variables: { input: { id: itemId, prepStation } },
        optimisticResponse: {
          updateMenuItem: {
            __typename: "MenuItem",
            id: itemId,
            prepStation,
          },
        },
      });
    } catch (updateError) {
      setError(updateError?.message || "Không thể cập nhật khu chế biến.");
    }
  };

  const selectedOption = STATION_OPTIONS.find(
    (option) => option.value === currentStation,
  );
  const SelectedIcon = selectedOption?.Icon || ChefHat;

  return (
    <div className={styles.root} onClick={(event) => event.stopPropagation()}>
      <div className={styles.label}>
        <SelectedIcon size={15} aria-hidden="true" />
        <span>Khu chế biến</span>
      </div>
      <select
        className={styles.select}
        aria-label={`Khu chế biến của món ${item?.name || ""}`}
        value={currentStation}
        disabled={!canUpdate || loading || !itemId}
        onChange={handleChange}
      >
        <option value="" disabled>
          Chưa cấu hình
        </option>
        {STATION_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error ? (
        <small className={styles.error} role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
};

export default PrepStationControl;
