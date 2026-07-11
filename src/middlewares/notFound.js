import { ApiError } from '#utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(new ApiError(404, `Ruta no encontrada: ${req.originalUrl}`));
};
