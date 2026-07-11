import env from '#config/env.js';
import { buildResponse } from '#utils/apiResponse.js';

/**
 * Manejador global de errores — formato unificado de respuesta API.
 */
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message ?? 'Error interno del servidor';
  let errors = err.errors ?? null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Error de validación';
    errors = Object.values(err.errors).map((e) => e.message);
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Identificador inválido';
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Registro duplicado';
  }

  const response = buildResponse({ success: false, message, errors });

  if (env.isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
