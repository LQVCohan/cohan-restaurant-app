"use client";

import React, { useState, useRef, useEffect } from "react";
import "./DropdownMenu.scss";

const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="dropdown-menu" ref={dropdownRef}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { isOpen, setIsOpen })
      )}
    </div>
  );
};

const DropdownMenuTrigger = ({ asChild, children, isOpen, setIsOpen }) => {
  const handleClick = () => setIsOpen(!isOpen);

  return React.cloneElement(children, { onClick: handleClick });
};

const DropdownMenuContent = ({
  align = "start",
  className = "",
  children,
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <div className={`dropdown-content dropdown-content--${align} ${className}`}>
      {children}
    </div>
  );
};

const DropdownMenuItem = ({ className = "", onClick, children, ...props }) => {
  return (
    <button
      className={`dropdown-item ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
};
