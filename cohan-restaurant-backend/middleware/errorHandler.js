import process from "process";
const errorHandler = (err, req, res, next) => {
  console.log("ErrorHandler loaded");
  console.error("Lỗi xử lý:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Trả về chi tiết hơn nếu dev (check env)
  const isDev = process.env.NODE_ENV === "development";
  console.log("NODE_ENV", isDev);
  res.status(500).json({
    error: isDev ? err.message : "Lỗi server nội bộoo", // Trả về err.message ở dev, chung chung ở prod
    details: isDev ? { stack: err.stack } : undefined, // Optional: Thêm stack nếu dev
  });
};
export default errorHandler;
