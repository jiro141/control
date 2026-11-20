import ExcelJS from 'exceljs';
import type { Borders, Fill } from 'exceljs';
import { downloadBlob } from '../download';
import { capitalize, formatDate, todayISO } from '../format';
import type { InvoiceBalance, Settings } from '../../types/database';

const NAVY = 'FF0B2340';
const WHITE = 'FFFFFFFF';
const BLUE = 'FF1E5AA8';
const SKY_LIGHT = 'FFE4F3FB';

function thinBlue(): Partial<Borders> {
  const side = { style: 'thin' as const, color: { argb: BLUE } };
  return { top: side, left: side, bottom: side, right: side };
}

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function moneyFormat(symbol: string): string {
  const safe = (symbol || '$').replace(/"/g, '').trim() || '$';
  return `"${safe}"#,##0.00`;
}

export async function downloadInvoicesExcel(
  invoices: InvoiceBalance[],
  settings: Settings,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Control de Ventas';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Facturas', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet.columns = [
    { width: 12 },
    { width: 14 },
    { width: 36 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
  ];

  const header = sheet.getRow(1);
  const labels = ['N°', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado'];
  labels.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.fill = solidFill(NAVY);
    cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBlue();
  });
  header.height = 24;

  const currency = moneyFormat(settings.currency_symbol);

  let rowIndex = 2;
  let totalBilled = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  for (const invoice of invoices) {
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = Number(invoice.number);
    row.getCell(1).numFmt = '0000';
    row.getCell(2).value = formatDate(invoice.issue_date);
    row.getCell(3).value = invoice.customer_name;
    row.getCell(4).value = Number(invoice.total);
    row.getCell(5).value = Number(invoice.paid_amount);
    row.getCell(6).value = Number(invoice.balance);
    row.getCell(7).value = capitalize(invoice.status);

    row.getCell(4).numFmt = currency;
    row.getCell(5).numFmt = currency;
    row.getCell(6).numFmt = currency;

    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'left' };
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).alignment = { horizontal: 'center' };

    for (let column = 1; column <= 7; column += 1) {
      row.getCell(column).border = thinBlue();
      row.getCell(column).font = { color: { argb: NAVY } };
    }

    row.height = 20;
    totalBilled += Number(invoice.total) || 0;
    totalPaid += Number(invoice.paid_amount) || 0;
    totalBalance += Number(invoice.balance) || 0;
    rowIndex += 1;
  }

  const totalsRow = sheet.getRow(rowIndex);
  sheet.mergeCells(rowIndex, 1, rowIndex, 3);
  totalsRow.getCell(1).value = 'TOTALES';
  totalsRow.getCell(1).font = { bold: true, color: { argb: NAVY }, size: 11 };
  totalsRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

  totalsRow.getCell(4).value = Math.round(totalBilled * 100) / 100;
  totalsRow.getCell(5).value = Math.round(totalPaid * 100) / 100;
  totalsRow.getCell(6).value = Math.round(totalBalance * 100) / 100;
  totalsRow.getCell(4).numFmt = currency;
  totalsRow.getCell(5).numFmt = currency;
  totalsRow.getCell(6).numFmt = currency;
  totalsRow.getCell(4).alignment = { horizontal: 'right' };
  totalsRow.getCell(5).alignment = { horizontal: 'right' };
  totalsRow.getCell(6).alignment = { horizontal: 'right' };

  for (let column = 1; column <= 7; column += 1) {
    totalsRow.getCell(column).border = thinBlue();
    totalsRow.getCell(column).fill = solidFill(SKY_LIGHT);
    totalsRow.getCell(column).font = { bold: true, color: { argb: NAVY } };
  }
  totalsRow.height = 24;

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 7 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `facturas_${todayISO()}.xlsx`);
}
