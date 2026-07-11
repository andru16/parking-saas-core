import { PRINT_DOCUMENT_TYPES, normalizeDocumentType } from '../constants.js';
import {
  buildTicketEntryDocument,
  buildTicketExitDocument,
} from './ticket.templates.js';
import {
  buildCashOpenDocument,
  buildCashCloseDocument,
  buildCashAuditDocument,
} from './cash.templates.js';
import {
  buildMembershipPaymentDocument,
  buildMembershipRenewalDocument,
  buildMembershipNewDocument,
} from './membership.templates.js';

/**
 * Registro de plantillas reutilizables.
 * Ningún controlador debe generar HTML directamente.
 */
const TEMPLATE_BUILDERS = Object.freeze({
  [PRINT_DOCUMENT_TYPES.TICKET_ENTRY]: (ctx) => buildTicketEntryDocument(ctx),
  [PRINT_DOCUMENT_TYPES.ENTRY]: (ctx) => buildTicketEntryDocument(ctx),
  [PRINT_DOCUMENT_TYPES.TICKET_EXIT]: (ctx) => buildTicketExitDocument(ctx),
  [PRINT_DOCUMENT_TYPES.EXIT]: (ctx) => buildTicketExitDocument(ctx),
  [PRINT_DOCUMENT_TYPES.CASH_OPEN]: (ctx) => buildCashOpenDocument(ctx),
  [PRINT_DOCUMENT_TYPES.CASH_CLOSE]: (ctx) => buildCashCloseDocument(ctx),
  [PRINT_DOCUMENT_TYPES.CASH_AUDIT]: (ctx) => buildCashAuditDocument(ctx),
  [PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT]: (ctx) => buildMembershipPaymentDocument(ctx),
  [PRINT_DOCUMENT_TYPES.MEMBERSHIP_RENEWAL]: (ctx) => buildMembershipRenewalDocument(ctx),
  [PRINT_DOCUMENT_TYPES.MEMBERSHIP_NEW]: (ctx) => buildMembershipNewDocument(ctx),
  [PRINT_DOCUMENT_TYPES.PAYMENT_RECEIPT]: (ctx) => buildTicketExitDocument(ctx),
});

export function getTemplateBuilder(type) {
  const normalized = normalizeDocumentType(type);
  const builder = TEMPLATE_BUILDERS[normalized];
  if (!builder) {
    throw new Error(`Plantilla de impresión no registrada: ${type}`);
  }
  return builder;
}

export function renderTemplate(type, context) {
  return getTemplateBuilder(type)(context);
}

export {
  buildTicketEntryDocument,
  buildTicketExitDocument,
  buildCashOpenDocument,
  buildCashCloseDocument,
  buildCashAuditDocument,
  buildMembershipPaymentDocument,
  buildMembershipRenewalDocument,
  buildMembershipNewDocument,
};
