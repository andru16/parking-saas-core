import Setting from '#modules/setting/setting.model.js';
import { SETTINGS_SECTIONS } from '../constants.js';
import { SettingsSection } from '../settingsSection.js';
import { DEFAULT_PRINT_CONFIG } from '#services/printing/constants.js';

/** Configuración del Motor de Impresión — persistida en Setting.ticket. */
export class PrintingSettingsSection extends SettingsSection {
  constructor() {
    super(SETTINGS_SECTIONS.PRINTING, {
      label: 'Impresión',
      description:
        'Formato de tickets, caja y membresías · 58mm / 80mm / A4 · vista previa.',
    });
  }

  async get(context) {
    const setting = await Setting.findOne({ organizationId: context.organizationId }).lean();
    const ticket = setting?.ticket ?? {};

    return {
      showLogo: ticket.showLogo ?? DEFAULT_PRINT_CONFIG.showLogo,
      showParkingName: ticket.showParkingName ?? DEFAULT_PRINT_CONFIG.showParkingName,
      showAddress: ticket.showAddress ?? DEFAULT_PRINT_CONFIG.showAddress,
      showPhone: ticket.showPhone ?? DEFAULT_PRINT_CONFIG.showPhone,
      showTaxId: ticket.showTaxId ?? DEFAULT_PRINT_CONFIG.showTaxId,
      logoUrl: ticket.logoUrl ?? null,
      businessName: ticket.businessName ?? '',
      businessTaxId: ticket.businessTaxId ?? '',
      businessAddress: ticket.businessAddress ?? '',
      businessCity: ticket.businessCity ?? '',
      businessPhone: ticket.businessPhone ?? '',
      header: ticket.header ?? '',
      footer: ticket.footer ?? '',
      welcomeMessage: ticket.welcomeMessage ?? DEFAULT_PRINT_CONFIG.welcomeMessage,
      farewellMessage: ticket.farewellMessage ?? DEFAULT_PRINT_CONFIG.farewellMessage,
      lostTicketPolicy: ticket.lostTicketPolicy ?? DEFAULT_PRINT_CONFIG.lostTicketPolicy,
      paperSize: ticket.paperSize ?? DEFAULT_PRINT_CONFIG.paperSize,
      copies: ticket.copies ?? DEFAULT_PRINT_CONFIG.copies,
      enableQr: ticket.enableQr ?? DEFAULT_PRINT_CONFIG.enableQr,
      enableBarcode: ticket.enableBarcode ?? DEFAULT_PRINT_CONFIG.enableBarcode,
      preferredAdapter: ticket.preferredAdapter ?? DEFAULT_PRINT_CONFIG.preferredAdapter,
      customMessages: {
        entry: ticket.customMessages?.entry ?? '',
        exit: ticket.customMessages?.exit ?? '',
        receipt: ticket.customMessages?.receipt ?? '',
        cash: ticket.customMessages?.cash ?? '',
        membership: ticket.customMessages?.membership ?? '',
      },
    };
  }

  async save(context, payload) {
    await Setting.findOneAndUpdate(
      { organizationId: context.organizationId },
      {
        $set: {
          ticket: {
            showLogo: payload.showLogo !== false,
            showParkingName: payload.showParkingName !== false,
            showAddress: payload.showAddress !== false,
            showPhone: payload.showPhone !== false,
            showTaxId: payload.showTaxId !== false,
            logoUrl: payload.logoUrl?.trim() || null,
            businessName: payload.businessName?.trim() ?? '',
            businessTaxId: payload.businessTaxId?.trim() ?? '',
            businessAddress: payload.businessAddress?.trim() ?? '',
            businessCity: payload.businessCity?.trim() ?? '',
            businessPhone: payload.businessPhone?.trim() ?? '',
            header: payload.header?.trim() ?? '',
            footer: payload.footer?.trim() ?? '',
            welcomeMessage: payload.welcomeMessage?.trim() ?? '',
            farewellMessage: payload.farewellMessage?.trim() ?? '',
            lostTicketPolicy: payload.lostTicketPolicy?.trim() ?? '',
            paperSize: payload.paperSize || '80mm',
            copies: Math.min(5, Math.max(1, Number(payload.copies) || 1)),
            enableQr: payload.enableQr !== false,
            enableBarcode: payload.enableBarcode !== false,
            preferredAdapter: payload.preferredAdapter || 'browser',
            customMessages: {
              entry: payload.customMessages?.entry?.trim() ?? '',
              exit: payload.customMessages?.exit?.trim() ?? '',
              receipt: payload.customMessages?.receipt?.trim() ?? '',
              cash: payload.customMessages?.cash?.trim() ?? '',
              membership: payload.customMessages?.membership?.trim() ?? '',
            },
          },
        },
        $setOnInsert: { organizationId: context.organizationId },
      },
      { upsert: true },
    );

    return this.get(context);
  }
}
