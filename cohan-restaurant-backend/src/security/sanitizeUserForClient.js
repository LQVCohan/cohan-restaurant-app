import { sanitizeAuthUser } from "./userDtos.js";

export function sanitizeUserForClient(user) {
  return sanitizeAuthUser(user);
}
