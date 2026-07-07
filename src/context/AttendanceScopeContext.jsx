import { createContext } from "react";

// Optional fallback scope. Attendance screens still pass restaurantId explicitly.
export const AttendanceScopeContext = createContext(null);

export default AttendanceScopeContext;
