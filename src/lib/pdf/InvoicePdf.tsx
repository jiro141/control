import type { ReactElement } from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import {
  formatDate,
  formatInvoiceNumber,
  formatMoney,
  formatQuantity,
  sanitizeFileName,
} from '../format';
import { downloadBlob } from '../download';
import type { InvoiceBalance, InvoiceItem, Settings } from '../../types/database';

const NAVY = '#0A2A66';
const SKY = '#3FA9E0';
const BLUE = '#1E5AA8';
const SLATE = '#475569';

const FIRST_PAGE_ROWS = 14;
const NEXT_PAGE_ROWS = 24;

const styles = StyleSheet.create({
  page: {
    padding: 22,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: NAVY,
    backgroundColor: '#FFFFFF',
  },
  banner: {
    width: '100%',
    height: 158.5,
    marginBottom: 8,
  },
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fechaLabel: {
    backgroundColor: SKY,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    letterSpacing: 0.5,
  },
  fechaValue: {
    borderWidth: 0.8,
    borderColor: BLUE,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 8,
    marginLeft: 5,
  },
  number: {
    marginLeft: 'auto',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  titleRule: {
    width: 56,
    height: 1,
    backgroundColor: SKY,
    marginHorizontal: 10,
  },
  title: {
    fontFamily: 'Times-Bold',
    fontSize: 25,
    textAlign: 'center',
    lineHeight: 1.02,
  },
  clientBlock: {
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 5,
  },
  clientRowSplit: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  clientLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    width: 62,
    paddingBottom: 1,
  },
  clientValue: {
    flexGrow: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: BLUE,
    paddingBottom: 1,
    fontSize: 8,
  },
  clientAddress: {
    flexGrow: 1,
    marginRight: 12,
  },
  clientPhone: {
    width: 150,
  },
  table: {
    borderWidth: 0.8,
    borderColor: BLUE,
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: SKY,
  },
  th: {
    borderWidth: 0.5,
    borderColor: BLUE,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 4,
  },
  tr: {
    flexDirection: 'row',
    height: 21,
    overflow: 'hidden',
  },
  td: {
    borderWidth: 0.5,
    borderColor: BLUE,
    fontSize: 7.5,
    paddingVertical: 3,
    paddingHorizontal: 4,
    lineHeight: 1.15,
  },
  tdRight: {
    textAlign: 'right',
  },
  tdCenter: {
    textAlign: 'center',
  },
  colQty: { width: '15%' },
  colDesc: { width: '55%' },
  colUnit: { width: '15%' },
  colTotal: { width: '15%' },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  totalBox: {
    flexDirection: 'row',
    width: 210,
    borderWidth: 0.9,
    borderColor: BLUE,
  },
  totalLabel: {
    width: 100,
    backgroundColor: SKY,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textAlign: 'center',
    paddingVertical: 5,
  },
  totalValue: {
    width: 110,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    textAlign: 'right',
    paddingVertical: 5,
    paddingRight: 6,
  },
  notes: {
    marginTop: 5,
    fontSize: 7,
    color: SLATE,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },
  footerLeft: {
    maxWidth: 320,
  },
  footerLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2.5,
  },
  bullet: {
    width: 6,
    height: 6,
    backgroundColor: NAVY,
    marginRight: 4,
    marginTop: 1,
  },
  footerText: {
    fontSize: 7.5,
    color: NAVY,
  },
  signature: {
    width: 160,
    borderTopWidth: 0.8,
    borderTopColor: NAVY,
    paddingTop: 3,
    alignItems: 'center',
  },
  signatureText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.4,
  },
  continuation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.8,
    borderBottomColor: BLUE,
    paddingBottom: 5,
    marginBottom: 8,
  },
  continuationTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 14,
  },
  continuationSub: {
    fontSize: 7.5,
    color: SLATE,
    marginTop: 2,
  },
  continuationMeta: {
    fontSize: 8,
    textAlign: 'right',
  },
});

interface InvoicePdfProps {
  invoice: InvoiceBalance;
  items: InvoiceItem[];
  settings: Settings;
  bannerUrl: string;
}

function buildChunks(items: InvoiceItem[]): InvoiceItem[][] {
  if (items.length === 0) return [[]];
  const chunks: InvoiceItem[][] = [items.slice(0, FIRST_PAGE_ROWS)];
  for (let index = FIRST_PAGE_ROWS; index < items.length; index += NEXT_PAGE_ROWS) {
    chunks.push(items.slice(index, index + NEXT_PAGE_ROWS));
  }
  return chunks;
}

function InvoicePdf({ invoice, items, settings, bannerUrl }: InvoicePdfProps) {
  const chunks = buildChunks(items);
  const number = formatInvoiceNumber(invoice.number);
  const symbol = settings.currency_symbol || '$';

  return (
    <Document
      title={`Factura ${number} - ${invoice.customer_name}`}
      author={settings.business_name}
      creator="Control de Ventas"
      language="es"
    >
      {chunks.map((chunk, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === chunks.length - 1;
        const capacity = isFirst ? FIRST_PAGE_ROWS : NEXT_PAGE_ROWS;
        const rows: (InvoiceItem | null)[] = [...chunk];
        while (rows.length < capacity) rows.push(null);

        return (
          <Page key={`page-${pageIndex}`} size="A4" style={styles.page}>
            {isFirst ? (
              <>
                <Image src={bannerUrl} style={styles.banner} />
                <View style={styles.fechaRow}>
                  <Text style={styles.fechaLabel}>FECHA</Text>
                  <Text style={styles.fechaValue}>{formatDate(invoice.issue_date)}</Text>
                  <Text style={styles.number}>N° {number}</Text>
                </View>
                <View style={styles.titleRow}>
                  <View style={styles.titleRule} />
                  <Text style={styles.title}>FACTURA{'\n'}COMERCIAL</Text>
                  <View style={styles.titleRule} />
                </View>
                <View style={styles.clientBlock}>
                  <View style={styles.clientRow}>
                    <Text style={styles.clientLabel}>NOMBRE:</Text>
                    <Text style={styles.clientValue}>{invoice.customer_name}</Text>
                  </View>
                  <View style={styles.clientRowSplit}>
                    <View style={{ flexDirection: 'row', flexGrow: 1, marginRight: 12 }}>
                      <Text style={styles.clientLabel}>DIRECCIÓN:</Text>
                      <Text style={styles.clientValue} wrap={false}>
                        {invoice.customer_address || ' '}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', width: 165 }}>
                      <Text style={styles.clientLabel}>TELÉFONO:</Text>
                      <Text style={styles.clientValue}>{invoice.customer_phone || ' '}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.continuation}>
                <View>
                  <Text style={styles.continuationTitle}>FACTURA COMERCIAL</Text>
                  <Text style={styles.continuationSub}>{settings.business_name}</Text>
                </View>
                <View>
                  <Text style={styles.continuationMeta}>N° {number}</Text>
                  <Text style={styles.continuationMeta}>
                    Página {pageIndex + 1} de {chunks.length}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.colQty]}>Cantidad</Text>
                <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
                <Text style={[styles.th, styles.colUnit]}>Unidad</Text>
                <Text style={[styles.th, styles.colTotal]}>Total</Text>
              </View>

              {rows.map((item, rowIndex) =>
                item ? (
                  <View key={`row-${item.id}`} style={styles.tr}>
                    <Text style={[styles.td, styles.colQty, styles.tdRight]}>
                      {formatQuantity(item.quantity)}
                    </Text>
                    <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
                    <Text style={[styles.td, styles.colUnit, styles.tdCenter]}>
                      {item.unit}
                    </Text>
                    <Text style={[styles.td, styles.colTotal, styles.tdRight]}>
                      {formatMoney(item.line_total, symbol)}
                    </Text>
                  </View>
                ) : (
                  <View key={`empty-${pageIndex}-${rowIndex}`} style={styles.tr}>
                    <Text style={[styles.td, styles.colQty]}>{' '}</Text>
                    <Text style={[styles.td, styles.colDesc]}>{' '}</Text>
                    <Text style={[styles.td, styles.colUnit]}>{' '}</Text>
                    <Text style={[styles.td, styles.colTotal]}>{' '}</Text>
                  </View>
                ),
              )}
            </View>

            {isLast ? (
              <>
                <View style={styles.totalSection}>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text style={styles.totalValue}>
                      {formatMoney(invoice.total, symbol)}
                    </Text>
                  </View>
                </View>

                {invoice.notes ? (
                  <Text style={styles.notes}>Nota: {invoice.notes}</Text>
                ) : null}

                <View style={styles.footer}>
                  <View style={styles.footerLeft}>
                    {settings.address ? (
                      <View style={styles.footerLine}>
                        <View style={styles.bullet} />
                        <Text style={styles.footerText}>{settings.address}</Text>
                      </View>
                    ) : null}
                    <View style={styles.footerLine}>
                      <View style={styles.bullet} />
                      <Text style={styles.footerText}>{settings.phone_primary}</Text>
                    </View>
                    <View style={styles.footerLine}>
                      <View style={styles.bullet} />
                      <Text style={styles.footerText}>{settings.phone_secondary}</Text>
                    </View>
                    {settings.website ? (
                      <View style={styles.footerLine}>
                        <View style={styles.bullet} />
                        <Text style={styles.footerText}>{settings.website}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.signature}>
                    <Text style={styles.signatureText}>FIRMA CLIENTE</Text>
                  </View>
                </View>
              </>
            ) : null}
          </Page>
        );
      })}
    </Document>
  );
}

export function resolveBannerUrl(): string {
  if (typeof window === 'undefined') return '/assets/header-banner.png';
  return new URL('/assets/header-banner.png', window.location.origin).href;
}

export async function buildInvoicePdfBlob(
  invoice: InvoiceBalance,
  items: InvoiceItem[],
  settings: Settings,
): Promise<Blob> {
  const element = (
    <InvoicePdf
      invoice={invoice}
      items={items}
      settings={settings}
      bannerUrl={resolveBannerUrl()}
    />
  ) as unknown as ReactElement;
  return pdf(element).toBlob();
}

export async function downloadInvoicePdf(
  invoice: InvoiceBalance,
  items: InvoiceItem[],
  settings: Settings,
): Promise<void> {
  const blob = await buildInvoicePdfBlob(invoice, items, settings);
  const filename = `Factura-${formatInvoiceNumber(invoice.number)}-${sanitizeFileName(
    invoice.customer_name,
  )}.pdf`;
  downloadBlob(blob, filename);
}
