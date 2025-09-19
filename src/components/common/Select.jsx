"use client";
import "./Select.scss";

const Select = ({
  options = [],
  value,
  onChange,
  placeholder = "Chọn...",
  variant = "default",
  size = "md",
  disabled = false,
  error = false,
  className = "",
  ...props
}) => {
  const selectClasses = [
    "select",
    `select--${variant}`,
    `select--${size}`,
    error && "select--error",
    disabled && "select--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="select-wrapper">
      <select
        className={selectClasses}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="select-arrow">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default Select;
