import React from "react";
import "./Card.scss";

const Card = ({
  children,
  className = "",
  hover = false,
  padding = "default",
  ...props
}) => {
  const cardClass = [
    "card",
    `card--padding-${padding}`,
    hover && "card--hover",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
};

export default Card;
