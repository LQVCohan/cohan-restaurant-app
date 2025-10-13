import React from "react";

const FormInput = ({
  type = "text",
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
  ...props
}) => {
  return (
    <input
      type={type}
      className={`form-input ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      {...props}
    />
  );
};

export default FormInput;
