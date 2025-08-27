import React from "react";
import { Edit2, Pause, Play, Trash2, ChefHat } from "lucide-react";
import Button from "../../../common/Button";
import {
  formatPrice,
  getDisplayPrice,
  getCategoryIcon,
  getCategoryText,
  getStatusText,
} from "../../../../utils/formatters";
import "./MenuItemCard.scss";

const MenuItemCard = ({
  item,
  onEdit,
  onToggleStatus,
  onDelete,
  viewMode = "grid",
}) => {
  const renderCookingMethods = () => {
    if (!item.cookingMethods || item.cookingMethods.length === 0) {
      return null;
    }

    return (
      <div
        className={`cooking-methods ${
          viewMode === "list" ? "cooking-methods--list" : ""
        }`}
      >
        <div className="cooking-methods__title">
          <ChefHat size={12} />
          Cách chế biến
        </div>
        <div className="cooking-methods__list">
          {item.cookingMethods.map((method, index) => (
            <div key={index} className="cooking-method-item">
              <span className="cooking-method-item__name">{method.name}</span>
              <span className="cooking-method-item__price">
                {formatPrice(method.price)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (viewMode === "list") {
    return (
      <div className="menu-item-card menu-item-card--list">
        <div className="menu-item-card__content">
          <div
            className="menu-item-card__image"
            onClick={() => onEdit(item.id)}
          >
            <span className="menu-item-card__emoji">{item.emoji}</span>
            <div
              className={`menu-item-card__status menu-item-card__status--${item.status}`}
            >
              {getStatusText(item.status)}
            </div>
          </div>

          <div className="menu-item-card__info" onClick={() => onEdit(item.id)}>
            <h3 className="menu-item-card__name">{item.name}</h3>
            <p className="menu-item-card__description">{item.description}</p>
            {renderCookingMethods()}
            <div className="menu-item-card__meta">
              <span>
                {getCategoryIcon(item.category)}{" "}
                {getCategoryText(item.category)}
              </span>
              <span>⏱️ {item.prepTime} phút</span>
              <span>📋 {item.ingredients.split(",").length} thành phần</span>
            </div>
          </div>

          <div className="menu-item-card__price">{getDisplayPrice(item)}</div>

          <div className="menu-item-card__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item.id);
              }}
            >
              <Edit2 size={16} />
              Sửa
            </Button>
            <Button
              variant={item.status === "available" ? "warning" : "success"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(item.id);
              }}
            >
              {item.status === "available" ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}
              {item.status === "available" ? "Tạm ngừng" : "Kích hoạt"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <Trash2 size={16} />
              Xóa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-item-card">
      <div className="menu-item-card__image" onClick={() => onEdit(item.id)}>
        <span className="menu-item-card__emoji">{item.emoji}</span>
        <div
          className={`menu-item-card__status menu-item-card__status--${item.status}`}
        >
          {getStatusText(item.status)}
        </div>
      </div>

      <div className="menu-item-card__content">
        <div className="menu-item-card__header" onClick={() => onEdit(item.id)}>
          <div>
            <h3 className="menu-item-card__name">{item.name}</h3>
            <span className="menu-item-card__category">
              {getCategoryIcon(item.category)} {getCategoryText(item.category)}
            </span>
          </div>
          <div className="menu-item-card__price">{getDisplayPrice(item)}</div>
        </div>

        <p
          className="menu-item-card__description"
          onClick={() => onEdit(item.id)}
        >
          {item.description}
        </p>

        {renderCookingMethods()}

        <div className="menu-item-card__meta" onClick={() => onEdit(item.id)}>
          <span>⏱️ {item.prepTime}p</span>
          <span>📋 {item.ingredients.split(",").length} thành phần</span>
        </div>

        <div className="menu-item-card__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item.id);
            }}
          >
            <Edit2 size={16} />
            Sửa
          </Button>
          <Button
            variant={item.status === "available" ? "warning" : "success"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(item.id);
            }}
          >
            {item.status === "available" ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            {item.status === "available" ? "Tạm ngừng" : "Kích hoạt"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 size={16} />
            Xóa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
