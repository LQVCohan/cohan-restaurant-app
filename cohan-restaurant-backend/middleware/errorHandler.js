const errorHandler = (err, req, res, next) => {
  console.error("Lỗi xử lý:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ error: "Lỗi server nội bộ" });
};
export default errorHandler;
