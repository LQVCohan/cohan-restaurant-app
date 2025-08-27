import React from "react";

const ServiceItem = ({
  type,
  icon,
  name,
  orders,
  percentage,
  change,
  changeType,
}) => {
  return (
    <div className={`service-item ${type}`}>
      <div className="service-left">
        <div className={`service-icon ${type}`}>
          <i className={icon}></i>
        </div>
        <div className="service-info">
          <h4>{name}</h4>
          <p>{orders}</p>
        </div>
      </div>
      <div className="service-right">
        <p className={`service-percentage ${type}`}>{percentage}</p>
        <p
          className={`service-change ${
            changeType === "positive" ? "positive" : "negative"
          }`}
        >
          {change}
        </p>
      </div>
    </div>
  );
};

export default ServiceItem;
