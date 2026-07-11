import { settingsService } from '#modules/systemSettings/settings.service.js';

/**
 * Utilidades de rango de fechas con zona horaria de la organización.
 * Zona horaria vía SettingsService (cache), no lectura directa a MongoDB.
 */
export class ReportDateRangeService {
  async getTimezone(organizationId) {
    if (!organizationId) {
      const platform = await settingsService.getPlatform();
      return platform.defaults.timezone;
    }
    return settingsService.getOrgTimezone(organizationId);
  }

  getTodayString(timezone, date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  }

  getMonthString(timezone, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    return `${year}-${month}`;
  }

  parseUtcBounds(from, to) {
    if (!from && !to) return null;
    const bounds = {};
    if (from) bounds.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) bounds.$lte = new Date(`${to}T23:59:59.999Z`);
    return bounds;
  }

  buildDateFieldExpr(fieldPath, timezone, { from, to, day, month } = {}) {
    const parts = [];
    if (day) {
      parts.push({
        $eq: [
          { $dateToString: { format: '%Y-%m-%d', date: fieldPath, timezone } },
          day,
        ],
      });
    }
    if (month) {
      parts.push({
        $eq: [
          { $dateToString: { format: '%Y-%m', date: fieldPath, timezone } },
          month,
        ],
      });
    }
    if (from) {
      parts.push({
        $gte: [
          { $dateToString: { format: '%Y-%m-%d', date: fieldPath, timezone } },
          from,
        ],
      });
    }
    if (to) {
      parts.push({
        $lte: [
          { $dateToString: { format: '%Y-%m-%d', date: fieldPath, timezone } },
          to,
        ],
      });
    }
    if (!parts.length) return null;
    if (parts.length === 1) return parts[0];
    return { $and: parts };
  }
}

export const reportDateRangeService = new ReportDateRangeService();
