function isValidCoordinatePair(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function buildRestaurantLocationFromAddress(address) {
  const lat = Number(address?.lat);
  const lng = Number(address?.lng);
  if (!isValidCoordinatePair(lat, lng)) return undefined;

  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}

function setDocumentPath(doc, path, value) {
  if (typeof doc?.set === "function") {
    doc.set(path, value);
  } else {
    doc[path] = value;
  }
}

export function applyRestaurantUpdateToDocument(doc, update = {}) {
  if (!doc || typeof doc !== "object") {
    throw new TypeError("Restaurant document is required");
  }

  const nextUpdate = { ...(update || {}) };
  const hasAddress = Object.prototype.hasOwnProperty.call(nextUpdate, "address");

  if (hasAddress) {
    const address = nextUpdate.address;
    setDocumentPath(doc, "address", address);
    doc.markModified?.("address");

    setDocumentPath(doc, "location", buildRestaurantLocationFromAddress(address));
    doc.markModified?.("location");

    delete nextUpdate.address;
  }

  if (Object.keys(nextUpdate).length > 0) {
    if (typeof doc.set === "function") {
      doc.set(nextUpdate);
    } else {
      Object.assign(doc, nextUpdate);
    }
  }

  return doc;
}
