import React from "react";
import "./Form.scss";

const FormGroup = ({ children, className = "", style }) => {
  return (
    <div className={`form-group ${className}`} style={style}>
      {children}
    </div>
  );
};

export default FormGroup;
