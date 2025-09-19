import "./Card.scss";

// Card gốc
const Card = ({
  children,
  className = "",
  hover = false,
  padding = "default",
  ...props
}) => {
  const cardClass = [
    "card",
    `card--padding-${padding}`,
    hover && "card--hover",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
};

// Subcomponents
const CardTitle = ({ children, className = "" }) => (
  <h3 className={`card-title ${className}`}>{children}</h3>
);

const CardHeader = ({ children, className = "" }) => (
  <div className={`card-header ${className}`}>{children}</div>
);

const CardDescription = ({ children, className = "" }) => (
  <p className={`card-description ${className}`}>{children}</p>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`card-content ${className}`}>{children}</div>
);

// Gắn subcomponents vào Card (compound API)
Card.Title = CardTitle;
Card.Header = CardHeader;
Card.Description = CardDescription;
Card.Content = CardContent;

// ✅ Export một COMPONENT thật sự
export default Card;
