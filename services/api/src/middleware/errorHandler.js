function errorHandler(error, req, res, next) {
  console.error("unhandled express error", error);
  res.status(error?.status || 500).json({
    code: error?.code || "internal_error",
    message: error?.message || "서버가 잠시 불안정합니다. 잠시 뒤 다시 시도해 주세요.",
  });
}

module.exports = {
  errorHandler,
};
