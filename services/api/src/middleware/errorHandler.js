function errorHandler(error, req, res, next) {
  console.error("unhandled express error", error);
  res.status(error?.status || 500).json({
    code: error?.code || "internal_error",
    message: error?.message || "서버가 잠시 꼬였습니다. 잠깐 뒤에 다시 시도해 주세요.",
  });
}

module.exports = {
  errorHandler,
};
