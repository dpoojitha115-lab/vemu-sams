function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = {
  createError,
  asyncHandler,
};

