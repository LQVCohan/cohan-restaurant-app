import React from "react";

const FormTextarea = ({
  placeholder,
  value,
  onChange,
  rows = 4,
  required = false,
  disabled = false,
  className = "",
  ...props
}) => {
  return (
    <textarea
      className={`form-textarea ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      required={required}
      disabled={disabled}
      {...props}
    />
  );
};

export default FormTextarea;
