// src/components/ui/Icon.jsx
import React from "react";

const icons = {
  clock: (p) => (
    <path d="M12 7v5l3 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" {...p} />
  ),
  truck: (p) => (
    <>
      <path
        d="M3 7h10v8H3zM13 10h4l3 3v2h-7M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        {...p}
      />
    </>
  ),
  mapPin: (p) => (
    <>
      <path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z" {...p} />
      <circle cx="12" cy="11" r="2.5" {...p} fill="none" />
    </>
  ),
  phone: (p) => (
    <path
      d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 5.2 2 2 0 0 1 4.11 3h2a2 2 0 0 1 2 1.72c.12.9.33 1.77.61 2.6a2 2 0 0 1-.45 2.11L7.09 10.9a16 16 0 0 0 6 6l1.47-1.17a2 2 0 0 1 2.11-.45c.83.28 1.7.49 2.6.61A2 2 0 0 1 22 16.92Z"
      {...p}
    />
  ),
  check: (p) => <path d="m20 6-11 11L4 12" {...p} />,
  x: (p) => <path d="M18 6 6 18M6 6l12 12" {...p} />,
  creditCard: (p) => (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" {...p} fill="none" />
      <path d="M2 10h20" {...p} />
    </>
  ),
  restaurant: (p) => (
    <>
      <path d="M4 3v7a3 3 0 0 0 3 3h1v8M20 21V8a5 5 0 0 0-5-5h-1" {...p} />
      <path d="M10 3v10" {...p} />
    </>
  ),
  receipt: (p) => (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" {...p} fill="none" />
      <path d="M8 6h8M8 10h8M8 14h6" {...p} />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  stroke = 2,
  className = "",
  ...rest
}) {
  const Path = icons[name] || icons["check"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {Path({})}
    </svg>
  );
}
