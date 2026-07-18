class ApiError extends Error {
  constructor(message, statusCode, code = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
