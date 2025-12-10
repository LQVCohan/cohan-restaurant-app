// src/components/order-tracking/OrderTrackingMap.jsx
import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DEFAULT_ZOOM = 13;

function getCenterLocation(locations) {
  const valid = locations.filter(
    (l) => l && typeof l.lat === "number" && typeof l.lng === "number"
  );
  if (!valid.length) return { lat: 10.762622, lng: 106.660172 }; // HCM fallback

  const lat = valid.reduce((sum, l) => sum + l.lat, 0) / valid.length;
  const lng = valid.reduce((sum, l) => sum + l.lng, 0) / valid.length;

  return { lat, lng };
}

export default function OrderTrackingMap({
  driverLocation,
  customerLocation,
  restaurantLocation,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = getCenterLocation([
      driverLocation,
      customerLocation,
      restaurantLocation,
    ]);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [center.lng, center.lat],
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cập nhật markers + flyTo khi location thay đổi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMarker = (location, markerRef, emoji, markerClass) => {
      if (!location || typeof location.lat !== "number") return;

      if (!markerRef.current) {
        const el = document.createElement("div");
        el.className = `marker ${markerClass}`;
        el.textContent = emoji;
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([location.lng, location.lat])
          .addTo(map);
      } else {
        markerRef.current.setLngLat([location.lng, location.lat]);
      }
    };

    // Nhà hàng
    updateMarker(
      restaurantLocation,
      restaurantMarkerRef,
      "🍽️",
      "marker-restaurant"
    );

    // Khách
    updateMarker(customerLocation, customerMarkerRef, "🏠", "marker-customer");

    // Tài xế + flyTo
    if (driverLocation && typeof driverLocation.lat === "number") {
      updateMarker(driverLocation, driverMarkerRef, "🛵", "marker-driver");

      try {
        map.flyTo({
          center: [driverLocation.lng, driverLocation.lat],
          zoom: DEFAULT_ZOOM,
          speed: 0.8,
          curve: 1.4,
          essential: true,
        });
      } catch (e) {
        // ignore
      }
    } else {
      // nếu chưa có vị trí tài xế, focus vào trung điểm giữa 2 điểm còn lại
      const center = getCenterLocation([customerLocation, restaurantLocation]);
      map.setCenter([center.lng, center.lat]);
    }
  }, [driverLocation, customerLocation, restaurantLocation]);

  return (
    <div className="tracking-map">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
