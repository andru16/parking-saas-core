/**
 * Exportador CSV — sin dependencias externas.
 */
export const csvExporter = {
  contentType: 'text/csv; charset=utf-8',
  extension: 'csv',

  async export({ title, columnHeaders, rows }) {
    const escape = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [
      `# ${title}`,
      columnHeaders.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    const bom = '\uFEFF';
    return Buffer.from(bom + lines.join('\n'), 'utf-8');
  },
};
