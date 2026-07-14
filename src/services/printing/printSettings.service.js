import Organization from '#modules/organization/organization.model.js';
import { settingsService } from '#modules/systemSettings/settings.service.js';
import { DEFAULT_PRINT_CONFIG } from './constants.js';

/**
 * PrintSettings — configuración de impresión por Organization.
 * Desacoplada de Tickets/Caja; datos comerciales con override opcional.
 */
export class PrintSettingsService {
  async getConfig(organizationId) {
    const [organization, setting] = await Promise.all([
      Organization.findById(organizationId)
        .select('name legalName taxId address city phone email logo')
        .lean(),
      settingsService.getOrgSetting(organizationId, 'ticket currency timezone dateFormat timeFormat'),
    ]);

    const ticket = setting?.ticket ?? {};
    const print = this.#normalizePrint(ticket);

    const displayName =
      print.businessName || organization?.name || organization?.legalName || '';
    const taxId = print.businessTaxId || organization?.taxId || '';
    const city = print.businessCity || organization?.city || '';
    const addressRaw = print.businessAddress || organization?.address || '';
    const phone = print.businessPhone || organization?.phone || '';

    return {
      organization: {
        name: displayName,
        legalName: organization?.legalName ?? '',
        taxId,
        address: [addressRaw, city].filter(Boolean).join(', '),
        city,
        phone,
        email: organization?.email ?? '',
        logoUrl: organization?.logo?.url ?? print.logoUrl ?? null,
      },
      print,
      locale: {
        currency: setting?.currency ?? 'COP',
        timezone: setting?.timezone ?? 'America/Bogota',
        dateFormat: setting?.dateFormat ?? 'DD/MM/YYYY',
        timeFormat: setting?.timeFormat ?? '24h',
      },
    };
  }

  /**
   * Fusiona un borrador de UI sobre la config persistida (vista previa).
   */
  mergeDraft(baseConfig, draft = {}) {
    const printDraft = { ...draft };
    delete printDraft.organization;

    return {
      ...baseConfig,
      organization: {
        ...baseConfig.organization,
        ...(draft.organization ?? {}),
        ...(draft.businessName ? { name: draft.businessName } : {}),
        ...(draft.businessTaxId ? { taxId: draft.businessTaxId } : {}),
        ...(draft.businessPhone ? { phone: draft.businessPhone } : {}),
        ...(draft.businessAddress || draft.businessCity
          ? {
              address: [
                draft.businessAddress || baseConfig.organization.address?.split(',')[0],
                draft.businessCity || baseConfig.organization.city,
              ]
                .filter(Boolean)
                .join(', '),
              city: draft.businessCity || baseConfig.organization.city,
            }
          : {}),
      },
      print: this.#normalizePrint({
        ...baseConfig.print,
        ...printDraft,
        customMessages: {
          ...baseConfig.print.customMessages,
          ...(draft.customMessages ?? {}),
        },
        logoUrl: draft.logoUrl !== undefined ? draft.logoUrl : baseConfig.print.logoUrl,
      }),
    };
  }

  #normalizePrint(ticket = {}) {
    return {
      showLogo: ticket.showLogo ?? DEFAULT_PRINT_CONFIG.showLogo,
      showParkingName: ticket.showParkingName ?? DEFAULT_PRINT_CONFIG.showParkingName,
      showAddress: ticket.showAddress ?? DEFAULT_PRINT_CONFIG.showAddress,
      showPhone: ticket.showPhone ?? DEFAULT_PRINT_CONFIG.showPhone,
      showTaxId: ticket.showTaxId ?? DEFAULT_PRINT_CONFIG.showTaxId,
      logoUrl: ticket.logoUrl ?? DEFAULT_PRINT_CONFIG.logoUrl,
      businessName: ticket.businessName ?? DEFAULT_PRINT_CONFIG.businessName,
      businessTaxId: ticket.businessTaxId ?? DEFAULT_PRINT_CONFIG.businessTaxId,
      businessAddress: ticket.businessAddress ?? DEFAULT_PRINT_CONFIG.businessAddress,
      businessCity: ticket.businessCity ?? DEFAULT_PRINT_CONFIG.businessCity,
      businessPhone: ticket.businessPhone ?? DEFAULT_PRINT_CONFIG.businessPhone,
      header: ticket.header ?? DEFAULT_PRINT_CONFIG.header,
      footer: ticket.footer ?? DEFAULT_PRINT_CONFIG.footer,
      welcomeMessage: ticket.welcomeMessage ?? DEFAULT_PRINT_CONFIG.welcomeMessage,
      farewellMessage: ticket.farewellMessage ?? DEFAULT_PRINT_CONFIG.farewellMessage,
      lostTicketPolicy: ticket.lostTicketPolicy ?? DEFAULT_PRINT_CONFIG.lostTicketPolicy,
      paperSize: ticket.paperSize ?? DEFAULT_PRINT_CONFIG.paperSize,
      copies: ticket.copies ?? DEFAULT_PRINT_CONFIG.copies,
      enableQr: ticket.enableQr ?? DEFAULT_PRINT_CONFIG.enableQr,
      enableBarcode: ticket.enableBarcode ?? DEFAULT_PRINT_CONFIG.enableBarcode,
      preferredAdapter: ticket.preferredAdapter ?? DEFAULT_PRINT_CONFIG.preferredAdapter,
      generateEntryTicket: ticket.generateEntryTicket ?? DEFAULT_PRINT_CONFIG.generateEntryTicket,
      generateExitTicket: ticket.generateExitTicket ?? DEFAULT_PRINT_CONFIG.generateExitTicket,
      customMessages: {
        entry: ticket.customMessages?.entry ?? '',
        exit: ticket.customMessages?.exit ?? '',
        receipt: ticket.customMessages?.receipt ?? '',
        cash: ticket.customMessages?.cash ?? '',
        membership: ticket.customMessages?.membership ?? '',
      },
    };
  }
}

export const printSettingsService = new PrintSettingsService();

/** @deprecated Alias compat */
export const printConfigService = printSettingsService;
