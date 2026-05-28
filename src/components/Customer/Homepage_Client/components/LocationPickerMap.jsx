import React, { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const RecenterMap = ({ lat, lng }) => {
  const map = useMap();

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);

  return null;
};

const LocationPickerMap = ({
  lat,
  lng,
  label,
  onChangeLocation,
  onConfirm,
  onClose,
}) => {
  const position = [lat, lng];
  const displayLabel = label || "Vị trí hiện tại của bạn";

  return (
    <div
      className="location-picker"
      role="region"
      aria-label="Xác nhận vị trí trên bản đồ"
    >
      <div className="location-picker__header">
        <div>
          <p className="location-picker__eyebrow">Xác nhận vị trí giao hàng</p>
          <h2 className="location-picker__title">
            Kéo marker nếu cần chỉnh lại
          </h2>
        </div>
        <button
          className="location-picker__close"
          type="button"
          onClick={onClose}
          aria-label="Đóng bản đồ chọn vị trí"
        >
          ×
        </button>
      </div>

      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={false}
        className="location-picker__map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={lat} lng={lng} />
        <Marker
          position={position}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target;
              const nextPosition = marker.getLatLng();
              onChangeLocation({
                lat: nextPosition.lat,
                lng: nextPosition.lng,
              });
            },
          }}
        />
      </MapContainer>

      <div className="location-picker__summary">
        <span className="location-picker__pin" aria-hidden="true">
          📍
        </span>
        <p className="location-picker__address" title={displayLabel}>
          {displayLabel}
        </p>
      </div>

      <div className="location-picker__actions">
        <button
          className="location-picker__confirm"
          type="button"
          onClick={onConfirm}
        >
          Xác nhận vị trí này
        </button>
        <button
          className="location-picker__cancel"
          type="button"
          onClick={onClose}
        >
          Đóng
        </button>
      </div>
    </div>
  );
};

export default LocationPickerMap;
