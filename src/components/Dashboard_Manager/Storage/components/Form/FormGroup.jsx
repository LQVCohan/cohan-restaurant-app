import React from "react";
import "./Form.scss";

const FormGroup = ({ children, className = "" }) => {
  return <div className={`form-group ${className}`}>{children}</div>;
};

export default FormGroup;
