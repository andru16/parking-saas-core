import { ApiError } from '#utils/ApiError.js';
import { withTransaction } from '#database/withTransaction.js';
import { BootstrapContext } from './bootstrapContext.js';
import { createDefaultBootstrapSteps } from './bootstrapSteps.registry.js';

/**
 * Servicio central de inicialización de organizaciones.
 * Único punto de entrada para crear un parqueadero completo en el sistema.
 */
export class OrganizationBootstrapService {
  constructor(steps = createDefaultBootstrapSteps()) {
    this.steps = steps;
  }

  /**
   * Ejecuta el pipeline completo de bootstrap dentro de una transacción MongoDB.
   *
   * @param {object} input
   * @param {object} input.organization - Datos del parqueadero
   * @param {object} input.admin - Datos del administrador inicial
   * @param {string} [input.planId] - Plan SaaS; Trial por defecto si se omite
   * @param {'SELF_SIGNUP'|'SUPER_ADMIN'|'API'} input.origin - Origen de la operación
   * @param {import('mongoose').Types.ObjectId} [input.responsibleUserId] - Obligatorio para SUPER_ADMIN y API
   * @param {object} [input.auditContext] - ip, userAgent
   */
  async execute(input) {
    const context = BootstrapContext.create(input);

    try {
      await withTransaction(async (session) => {
        for (const step of this.steps) {
          await step.execute(context, session);
        }
      });

      return context.toResult();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error.code === 11000) {
        throw new ApiError(409, 'Conflicto de datos: el registro ya existe');
      }

      throw new ApiError(500, 'Error al inicializar la organización', error.message);
    }
  }
}

export const organizationBootstrapService = new OrganizationBootstrapService();
