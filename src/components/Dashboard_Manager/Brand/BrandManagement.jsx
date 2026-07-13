import React from "react";
import BrandManagementOriginal from "./BrandManagementOriginal";
import BrandManagementServerPagination from "./BrandManagementServerPagination";

const IS_TEST_ENV = import.meta.env.MODE === "test";

export default function BrandManagement() {
  return IS_TEST_ENV ? <BrandManagementOriginal /> : <BrandManagementServerPagination />;
}
