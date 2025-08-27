import React from "react";

const StatsCard = ({ icon, title, value, bgColor }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div
        className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center mb-4 mx-auto`}
      >
        {icon}
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm text-gray-600">{title}</div>
      </div>
    </div>
  );
};

export default StatsCard;
