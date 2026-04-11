function notFoundHandler(req, res) {
  res.status(404).json({
    code: "not_found",
    message: "요청 경로를 찾을 수 없습니다.",
  });
}

module.exports = {
  notFoundHandler,
};
