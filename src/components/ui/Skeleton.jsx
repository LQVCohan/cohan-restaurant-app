import React from "react";
import "./Skeleton.scss";

export default function Skeleton({ rows = 4 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="sk-line sk-title" />
          <div className="sk-line" />
          <div className="sk-line" />
          <div className="sk-line short" />
        </div>
      ))}
    </div>
  );
}
