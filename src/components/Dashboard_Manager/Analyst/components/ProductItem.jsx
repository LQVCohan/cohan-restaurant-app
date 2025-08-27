import React from "react";

const ProductItem = ({ rank, name, quantity, revenue, change, changeType }) => {
  const getRankNumber = (rank) => {
    const rankMap = { first: "1", second: "2", third: "3", fourth: "4" };
    return rankMap[rank];
  };

  return (
    <div className="product-item">
      <div className="product-left">
        <div className={`product-rank ${rank}`}>
          <span>{getRankNumber(rank)}</span>
        </div>
        <div className="product-info">
          <h4>{name}</h4>
          <p>{quantity}</p>
        </div>
      </div>
      <div className="product-right">
        <p className="revenue">{revenue}</p>
        <p
          className={`change ${
            changeType === "positive" ? "positive" : "negative"
          }`}
        >
          {change}
        </p>
      </div>
    </div>
  );
};

export default ProductItem;
