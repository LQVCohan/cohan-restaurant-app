"use client";
import "./Button.scss";

const Button = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  disabled = false,
  loading = false,
  onClick,
  className = "",
  ...props
}) => {
  const buttonClass = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    loading && "btn--loading",
    disabled && "btn--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <i className="fas fa-spinner fa-spin btn__loading-icon"></i>}
      {!loading && icon && iconPosition === "left" && (
        <i className={`${icon} btn__icon btn__icon--left`}></i>
      )}
      <span className="btn__text">{children}</span>
      {!loading && icon && iconPosition === "right" && (
        <i className={`${icon} btn__icon btn__icon--right`}></i>
      )}
    </button>
  );
};

export default Button;
