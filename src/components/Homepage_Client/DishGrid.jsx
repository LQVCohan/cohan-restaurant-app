import React from "react";
import "../../styles/Homepage/DishGrid.scss";

const DishGrid = ({ dishes, onAddToCart }) => {
  return (
    <section id="menu" className="dishes">
      <div className="dishes__container">
        <h3 className="dishes__title">Món ăn phổ biến</h3>
        <div className="dishes__grid">
          {dishes.map((dish) => (
            <div key={dish.id} className="dish-card">
              <div className="dish-card__image">
                <span>{dish.image}</span>
              </div>
              <div className="dish-card__content">
                <h5 className="dish-card__name">{dish.name}</h5>
                <p className="dish-card__restaurant">{dish.restaurant}</p>
                <div className="dish-card__footer">
                  <span className="dish-card__price">
                    {dish.price.toLocaleString()}đ
                  </span>
                  <button
                    onClick={() => onAddToCart(dish)}
                    className="dish-card__add-btn"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DishGrid;
