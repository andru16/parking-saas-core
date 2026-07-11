/**
 * Respuesta estándar de la API.
 * Formato único: success, message, data, errors, timestamp.
 */
export const buildResponse = ({ success, message = null, data = null, errors = null }) => ({
  success,
  message,
  data,
  errors,
  timestamp: new Date().toISOString(),
});

export const sendSuccess = (res, { statusCode = 200, message = null, data = null }) => {
  res.status(statusCode).json(buildResponse({ success: true, message, data }));
};

export const sendError = (res, { statusCode = 500, message, errors = null }) => {
  res.status(statusCode).json(buildResponse({ success: false, message, errors }));
};
