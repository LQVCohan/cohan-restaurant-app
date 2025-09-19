"use client";
import "./Input.scss";

const Input = ({
  type = "text",
  variant = "default",
  size = "md",
  placeholder,
  value,
  onChange,
  disabled = false,
  error = false,
  className = "",
  ...props
}) => {
  const inputClasses = [
    "input",
    `input--${variant}`,
    `input--${size}`,
    error && "input--error",
    disabled && "input--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      type={type}
      className={inputClasses}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  );
};

export default Input;
