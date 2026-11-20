import ExcelJS from 'exceljs';
import type { Borders, Fill, Worksheet } from 'exceljs';
import { downloadBlob, fetchAsDataUrl } from '../download';
import {
  capitalize,
  formatDate,
  formatInvoiceNumber,
  invoiceCurrency,
  sanitizeFileName,
} from '../format';
import { excelCurrencyFormat } from './currencyFormat';
import type { InvoiceBalance, InvoiceItem, Payment, Settings } from '../../types/database';

const NAVY = 'FF0B2340';
const SKY = 'FF3FA9E0';
const BLUE = 'FF1E5AA8';
const WHITE = 'FFFFFFFF';
const SKY_LIGHT = 'FFE4F3FB';
const SLATE = 'FF475569';

function thinBlue(): Partial<Borders> {
  const side = { style: 'thin' as const, color: { argb: BLUE } };
  return { top: side, left: side, bottom: side, right: side };
}

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function borderRow(sheet: Worksheet, row: number, from: number, to: number) {
  const border = thinBlue();
  for (let column = from; column <= to; column += 1) {
    sheet.getCell(row, column).border = border;
  }
}

export async function downloadInvoiceExcel(
  invoice: InvoiceBalance,
  items: InvoiceItem[],
  payments: Payment[],
  settings: Settings,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Control de Ventas';
  workbook.created = new Date();

  const number = formatInvoiceNumber(invoice.number);
  const currency = excelCurrencyFormat(invoiceCurrency(invoice));

  const sheet = workbook.addWorksheet(`Factura ${number}`, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
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
    { width: 10 },
    { width: 24 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];

  for (let row = 1; row <= 9; row += 1) {
    sheet.getRow(row).height = 17;
  }

  try {
    const base64 = await fetchAsDataUrl('/assets/header-banner.png');
    const imageId = workbook.addImage({ base64, extension: 'png' });
    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 660, height: 190 },
    });
  } catch {}

  sheet.mergeCells('A10:G10');
  const businessName = sheet.getCell('A10');
  businessName.value = settings.business_name;
  businessName.font = { bold: true, size: 16, color: { argb: NAVY } };
  businessName.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(10).height = 24;

  sheet.mergeCells('A11:G11');
  const contact = sheet.getCell('A11');
  const contactParts = [
    settings.phone_primary,
    settings.phone_secondary,
    settings.website,
  ].filter((value): value is string => Boolean(value && value.trim()));
  if (settings.tax_id && settings.tax_id.trim()) {
    contactParts.push(`RIF: ${settings.tax_id.trim()}`);
  }
  contact.value = contactParts.join('  ·  ');
  contact.font = { size: 10, color: { argb: SLATE } };
  sheet.getRow(11).height = 16;

  sheet.getRow(12).height = 6;

  sheet.mergeCells('A13:G13');
  const documentTitle = sheet.getCell('A13');
  documentTitle.value = invoice.status === 'anulada' ? 'FACTURA COMERCIAL ANULADA' : 'FACTURA COMERCIAL';
  documentTitle.font = { bold: true, size: 15, color: { argb: NAVY } };
  documentTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  documentTitle.fill = solidFill(SKY_LIGHT);
  sheet.getRow(13).height = 28;

  sheet.getCell('A14').value = 'N°';
  sheet.getCell('A14').font = { bold: true, color: { argb: NAVY } };
  sheet.getCell('B14').value = number;
  sheet.getCell('B14').font = { bold: true, color: { argb: NAVY } };
  sheet.getCell('D14').value = 'Fecha';
  sheet.getCell('D14').font = { bold: true, color: { argb: NAVY } };
  sheet.mergeCells('E14:G14');
  sheet.getCell('E14').value = formatDate(invoice.issue_date);
  sheet.getCell('E14').alignment = { horizontal: 'left' };
  sheet.getRow(14).height = 18;

  sheet.getRow(15).height = 6;

  const clientRows: [string, string][] = [
    ['Cliente', invoice.customer_name],
    ['Dirección', invoice.customer_address ?? ''],
    ['Teléfono', invoice.customer_phone ?? ''],
  ];

  let clientRow = 16;
  for (const [label, value] of clientRows) {
    sheet.getCell(clientRow, 1).value = label;
    sheet.getCell(clientRow, 1).font = { bold: true, color: { argb: NAVY } };
    sheet.mergeCells(clientRow, 2, clientRow, 7);
    const valueCell = sheet.getCell(clientRow, 2);
    valueCell.value = value;
    valueCell.font = { color: { argb: NAVY } };
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(clientRow).height = 18;
    clientRow += 1;
  }

  sheet.getRow(19).height = 8;

  const headerRowIndex = 20;
  const headers = ['Cantidad', 'Descripción', 'Unidad', 'Precio unitario', ''];
  headers.forEach((header, index) => {
    if (!header) return;
    sheet.getCell(headerRowIndex, index + 1).value = header;
  });
  sheet.mergeCells(headerRowIndex, 5, headerRowIndex, 7);
  sheet.getCell(headerRowIndex, 5).value = 'Total';

  for (let column = 1; column <= 7; column += 1) {
    const cell = sheet.getCell(headerRowIndex, column);
    cell.fill = solidFill(NAVY);
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  borderRow(sheet, headerRowIndex, 1, 7);
  sheet.getRow(headerRowIndex).height = 22;

  let rowIndex = headerRowIndex + 1;
  for (const item of items) {
    sheet.getCell(rowIndex, 1).value = Number(item.quantity);
    sheet.getCell(rowIndex, 1).numFmt = '#,##0.###';
    sheet.getCell(rowIndex, 2).value = item.description;
    sheet.getCell(rowIndex, 3).value = item.unit;
    sheet.getCell(rowIndex, 4).value = Number(item.unit_price);
    sheet.getCell(rowIndex, 4).numFmt = currency;
    sheet.mergeCells(rowIndex, 5, rowIndex, 7);
    sheet.getCell(rowIndex, 5).value = Number(item.line_total);
    sheet.getCell(rowIndex, 5).numFmt = currency;

    sheet.getCell(rowIndex, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(rowIndex, 2).alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getCell(rowIndex, 3).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(rowIndex, 4).alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getCell(rowIndex, 5).alignment = { horizontal: 'right', vertical: 'middle' };

    for (let column = 1; column <= 7; column += 1) {
      sheet.getCell(rowIndex, column).font = { color: { argb: NAVY } };
    }

    borderRow(sheet, rowIndex, 1, 7);
    sheet.getRow(rowIndex).height = 20;
    rowIndex += 1;
  }

  if (items.length === 0) {
    sheet.mergeCells(rowIndex, 1, rowIndex, 7);
    sheet.getCell(rowIndex, 1).value = 'Sin artículos registrados';
    sheet.getCell(rowIndex, 1).alignment = { horizontal: 'center' };
    borderRow(sheet, rowIndex, 1, 7);
    rowIndex += 1;
  }

  sheet.mergeCells(rowIndex, 1, rowIndex, 4);
  const totalLabel = sheet.getCell(rowIndex, 1);
  totalLabel.value = 'TOTAL';
  totalLabel.font = { bold: true, size: 12, color: { argb: WHITE } };
  totalLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let column = 1; column <= 4; column += 1) {
    sheet.getCell(rowIndex, column).fill = solidFill(SKY);
  }

  sheet.mergeCells(rowIndex, 5, rowIndex, 7);
  const totalValue = sheet.getCell(rowIndex, 5);
  totalValue.value = Number(invoice.total);
  totalValue.numFmt = currency;
  totalValue.font = { bold: true, size: 12, color: { argb: NAVY } };
  totalValue.alignment = { horizontal: 'right', vertical: 'middle' };
  borderRow(sheet, rowIndex, 1, 7);
  sheet.getRow(rowIndex).height = 26;
  rowIndex += 2;

  const noteText = invoice.notes?.trim();
  if (noteText) {
    sheet.mergeCells(rowIndex, 1, rowIndex, 7);
    const noteCell = sheet.getCell(rowIndex, 1);
    noteCell.value = `Nota: ${noteText}`;
    noteCell.font = { italic: true, color: { argb: SLATE } };
    noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    sheet.getRow(rowIndex).height = Math.max(
      18,
      Math.ceil(noteText.length / 95) * 15,
    );
    rowIndex += 2;
  }

  sheet.mergeCells(rowIndex, 1, rowIndex, 4);
  const signature = sheet.getCell(rowIndex, 1);
  signature.value = 'FIRMA CLIENTE';
  signature.font = { bold: true, size: 10, color: { argb: NAVY } };
  signature.alignment = { horizontal: 'center', vertical: 'bottom' };
  for (let column = 1; column <= 4; column += 1) {
    sheet.getCell(rowIndex, column).border = {
      top: { style: 'thin', color: { argb: NAVY } },
    };
  }
  sheet.getRow(rowIndex).height = 40;

  const paymentsSheet = workbook.addWorksheet('Pagos', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
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

  paymentsSheet.columns = [{ width: 14 }, { width: 16 }, { width: 20 }, { width: 42 }];

  const summary: [string, number][] = [
    ['Total factura', Number(invoice.total)],
    ['Pagado', Number(invoice.paid_amount)],
    ['Saldo', Number(invoice.balance)],
  ];
  summary.forEach(([label, value], index) => {
    const row = index + 1;
    paymentsSheet.getCell(row, 1).value = label;
    paymentsSheet.getCell(row, 1).font = { bold: true, color: { argb: NAVY } };
    paymentsSheet.getCell(row, 2).value = value;
    paymentsSheet.getCell(row, 2).numFmt = currency;
    paymentsSheet.getCell(row, 2).alignment = { horizontal: 'right' };
    paymentsSheet.getRow(row).height = 18;
  });
  paymentsSheet.getRow(4).height = 8;

  const paymentHeaderRow = 5;
  ['Fecha', 'Monto', 'Método', 'Nota'].forEach((header, index) => {
    const cell = paymentsSheet.getCell(paymentHeaderRow, index + 1);
    cell.value = header;
    cell.fill = solidFill(NAVY);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  borderRow(paymentsSheet, paymentHeaderRow, 1, 4);
  paymentsSheet.getRow(paymentHeaderRow).height = 22;

  let paymentRow = paymentHeaderRow + 1;
  if (payments.length === 0) {
    paymentsSheet.mergeCells(paymentRow, 1, paymentRow, 4);
    paymentsSheet.getCell(paymentRow, 1).value = 'Sin pagos registrados';
    paymentsSheet.getCell(paymentRow, 1).font = {
      italic: true,
      color: { argb: SLATE },
    };
    paymentsSheet.getCell(paymentRow, 1).alignment = { horizontal: 'center' };
    borderRow(paymentsSheet, paymentRow, 1, 4);
    paymentRow += 1;
  }

  for (const payment of payments) {
    paymentsSheet.getCell(paymentRow, 1).value = formatDate(payment.paid_at);
    paymentsSheet.getCell(paymentRow, 2).value = Number(payment.amount);
    paymentsSheet.getCell(paymentRow, 2).numFmt = currency;
    paymentsSheet.getCell(paymentRow, 3).value = `${capitalize(payment.method)}${payment.voided_at ? ' · Anulado' : ''}`;
    paymentsSheet.getCell(paymentRow, 4).value = payment.note ?? '';
    paymentsSheet.getCell(paymentRow, 2).alignment = { horizontal: 'right' };
    for (let column = 1; column <= 4; column += 1) {
      paymentsSheet.getCell(paymentRow, column).font = { color: { argb: NAVY } };
    }
    borderRow(paymentsSheet, paymentRow, 1, 4);
    paymentsSheet.getRow(paymentRow).height = 20;
    paymentRow += 1;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(
    blob,
    `Factura-${number}-${sanitizeFileName(invoice.customer_name)}.xlsx`,
  );
}
