export const isImmersiveVrRoute = (pathname = "") =>
  String(pathname).startsWith("/vr/");
