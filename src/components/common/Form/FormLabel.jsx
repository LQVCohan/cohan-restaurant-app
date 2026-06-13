import React from "react";

const FormLabel = ({ children, required = false, htmlFor }) => {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
      {required && <span className="required">*</span>}
    </label>
  );
};

export default FormLabel;
