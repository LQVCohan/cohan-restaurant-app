import React from "react";
import "../../styles/Homepage/Cart.scss";

const Cart = ({ isOpen, onClose, cart, onUpdateQuantity, totalPrice }) => {
  return (
    <div className={`cart ${isOpen ? "cart--open" : ""}`}>
      <div className="cart__header">
        <h3 className="cart__title">Giỏ hàng</h3>
        <button onClick={onClose} className="cart__close">
          ✕
        </button>
      </div>

      <div className="cart__items">
        {cart.length === 0 ? (
          <p className="cart__empty">Giỏ hàng trống</p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="cart-item">
              <div className="cart-item__info">
                <span className="cart-item__image">{item.image}</span>
                <div className="cart-item__details">
                  <h6 className="cart-item__name">{item.name}</h6>
                  <p className="cart-item__price">
                    {item.price.toLocaleString()}đ
                  </p>
                </div>
              </div>
              <div className="cart-item__controls">
                <button
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  className="cart-item__btn cart-item__btn--decrease"
                >
                  -
                </button>
                <span className="cart-item__quantity">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  className="cart-item__btn cart-item__btn--increase"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cart__footer">
        <div className="cart__total">
          <span className="cart__total-label">Tổng cộng:</span>
          <span className="cart__total-price">
            {totalPrice.toLocaleString()}đ
          </span>
        </div>
        <button className="cart__checkout">Thanh toán</button>
      </div>
    </div>
  );
};

export default Cart;
