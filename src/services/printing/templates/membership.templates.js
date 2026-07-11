import {
  PRINT_DOCUMENT_TYPES,
  PRINT_RESOURCE_TYPES,
} from '../constants.js';
import {
  buildCodes,
  buildHeader,
  buildMeta,
  createPrintDocument,
  formatDate,
  formatMoney,
  userName,
} from './documentHelpers.js';

function membershipNumber(id) {
  return `MEM-${String(id ?? '').slice(-8).toUpperCase()}`;
}

function baseMembershipLines(membership, locale) {
  const plate = membership.vehicleId?.plate ?? '—';
  const memberName = membership.memberId?.name ?? '—';

  return [
    { label: 'Comprobante', value: membershipNumber(membership._id), emphasis: true },
    { label: 'Plan', value: membership.name || 'Membresía' },
    { label: 'Miembro', value: memberName },
    { label: 'Placa', value: plate, emphasis: true },
    { label: 'Inicio', value: formatDate(membership.startDate, locale) },
    { label: 'Vence', value: formatDate(membership.endDate, locale) },
    {
      label: 'Valor',
      value: formatMoney(membership.amount, locale.currency),
      emphasis: true,
    },
  ];
}

function buildMembershipDocument({
  type,
  titleMessage,
  membership,
  configBundle,
  operator = null,
  isPreview = false,
}) {
  const { print, locale } = configBundle;
  const number = membershipNumber(membership._id);
  const lines = [
    ...baseMembershipLines(membership, locale),
    ...(operator ? [{ label: 'Atendió', value: userName(operator) }] : []),
  ];

  if (membership.notes) {
    lines.push({ label: 'Observaciones', value: membership.notes });
  }

  return createPrintDocument({
    meta: buildMeta({
      type,
      resourceType: PRINT_RESOURCE_TYPES.MEMBERSHIP,
      resourceId: membership._id,
      documentNumber: number,
      print,
      locale,
      isPreview,
    }),
    header: buildHeader(configBundle),
    lines,
    codes: buildCodes(print, membership._id, number),
    messages: {
      primary: print.customMessages.membership || titleMessage,
    },
    footer: { text: print.footer },
  });
}

export function buildMembershipPaymentDocument(ctx) {
  return buildMembershipDocument({
    ...ctx,
    type: PRINT_DOCUMENT_TYPES.MEMBERSHIP_PAYMENT,
    titleMessage: 'Comprobante de pago de membresía',
  });
}

export function buildMembershipRenewalDocument(ctx) {
  return buildMembershipDocument({
    ...ctx,
    type: PRINT_DOCUMENT_TYPES.MEMBERSHIP_RENEWAL,
    titleMessage: 'Renovación de membresía',
  });
}

export function buildMembershipNewDocument(ctx) {
  return buildMembershipDocument({
    ...ctx,
    type: PRINT_DOCUMENT_TYPES.MEMBERSHIP_NEW,
    titleMessage: 'Nueva membresía',
  });
}
