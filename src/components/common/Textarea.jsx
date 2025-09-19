import "./Textarea.scss";

const Textarea = ({
  className = "",
  rows = 3,
  resize = "vertical",
  disabled = false,
  error = false,
  ...props
}) => {
  const textareaClasses = [
    "textarea",
    `textarea--resize-${resize}`,
    disabled && "textarea--disabled",
    error && "textarea--error",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <textarea
      className={textareaClasses}
      rows={rows}
      disabled={disabled}
      {...props}
    />
  );
};

export default Textarea;
