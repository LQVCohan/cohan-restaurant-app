import "./Label.scss";

const Label = ({
  children,
  htmlFor,
  required = false,
  disabled = false,
  size = "md",
  className = "",
  ...props
}) => {
  const labelClasses = [
    "label",
    `label--${size}`,
    disabled && "label--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label htmlFor={htmlFor} className={labelClasses} {...props}>
      {children}
      {required && <span className="label__required">*</span>}
    </label>
  );
};

export default Label;
