import { Globe, MapPin, Phone } from 'lucide-react';
import {
  formatDate,
  formatInvoiceNumber,
  formatMoney,
  formatQuantity,
} from '../lib/format';
import type { InvoiceBalance, InvoiceItem, Settings } from '../types/database';

const MIN_ROWS = 14;

interface InvoiceSheetProps {
  invoice: InvoiceBalance;
  items: InvoiceItem[];
  settings: Settings | null;
}

export function InvoiceSheet({ invoice, items, settings }: InvoiceSheetProps) {
  const symbol = settings?.currency_symbol ?? '$';
  const emptyRows = Math.max(0, MIN_ROWS - items.length);
  const address = settings?.address ?? '';
  const website = settings?.website ?? '';

  return (
    <div
      id="invoice-sheet"
      className="mx-auto w-full max-w-[800px] overflow-hidden rounded-xl border border-line bg-white shadow-sheet print:max-w-none print:rounded-none print:border-0 print:shadow-none"
    >
      <img
        src="/assets/header-banner.png"
        alt="Venta de todo tipo de madera para minería"
        className="block w-full"
      />

      <div className="px-4 pb-6 pt-4 sm:px-8 sm:pb-8">
        <div className="flex items-center gap-2">
          <span className="bg-[#3FA9E0] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Fecha
          </span>
          <span className="border border-[#1E5AA8] px-3 py-1 text-[11px] font-semibold text-[#0A2A66] sm:text-xs">
            {formatDate(invoice.issue_date)}
          </span>
          <span className="ml-auto text-sm font-bold text-[#0A2A66] sm:text-base">
            N° {formatInvoiceNumber(invoice.number)}
          </span>
        </div>

        <div className="my-4 flex items-center justify-center gap-2 sm:my-5 sm:gap-5">
          <span className="h-px w-8 bg-[#3FA9E0] sm:w-20" />
          <h2 className="text-center font-serif text-2xl font-bold uppercase leading-[1.05] tracking-wide text-[#0A2A66] sm:text-4xl">
            Factura
            <br />
            Comercial
          </h2>
          <span className="h-px w-8 bg-[#3FA9E0] sm:w-20" />
        </div>

        <div className="space-y-2.5 text-[11px] text-[#0A2A66] sm:text-sm">
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 font-bold uppercase sm:w-28">Nombre:</span>
            <span className="min-w-0 flex-1 border-b border-[#1E5AA8] pb-0.5 break-words">
              {invoice.customer_name}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="w-20 shrink-0 font-bold uppercase sm:w-28">
                Dirección:
              </span>
              <span className="min-w-0 flex-1 border-b border-[#1E5AA8] pb-0.5 break-words">
                {invoice.customer_address ?? '\u00A0'}
              </span>
            </div>
            <div className="flex min-w-0 items-baseline gap-2 sm:w-[42%]">
              <span className="shrink-0 font-bold uppercase">Teléfono:</span>
              <span className="min-w-0 flex-1 truncate border-b border-[#1E5AA8] pb-0.5">
                {invoice.customer_phone ?? '\u00A0'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '55%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="bg-[#3FA9E0] text-white">
                <th className="border border-[#1E5AA8] px-1 py-1.5 text-center text-[9px] font-bold uppercase sm:px-2 sm:text-xs">
                  Cantidad
                </th>
                <th className="border border-[#1E5AA8] px-1 py-1.5 text-center text-[9px] font-bold uppercase sm:px-2 sm:text-xs">
                  Descripción
                </th>
                <th className="border border-[#1E5AA8] px-1 py-1.5 text-center text-[9px] font-bold uppercase sm:px-2 sm:text-xs">
                  Unidad
                </th>
                <th className="border border-[#1E5AA8] px-1 py-1.5 text-center text-[9px] font-bold uppercase sm:px-2 sm:text-xs">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="h-7 text-[9px] text-[#0A2A66] sm:h-8 sm:text-xs">
                  <td className="border border-[#1E5AA8] px-1 py-1 text-right tabular-nums sm:px-2">
                    {formatQuantity(item.quantity)}
                  </td>
                  <td className="break-words border border-[#1E5AA8] px-1 py-1 sm:px-2">
                    {item.description}
                  </td>
                  <td className="border border-[#1E5AA8] px-1 py-1 text-center sm:px-2">
                    {item.unit}
                  </td>
                  <td className="border border-[#1E5AA8] px-1 py-1 text-right tabular-nums sm:px-2">
                    {formatMoney(item.line_total, symbol)}
                  </td>
                </tr>
              ))}
              {Array.from({ length: emptyRows }).map((_, index) => (
                <tr key={`empty-${index}`} className="h-7 sm:h-8">
                  <td className="border border-[#1E5AA8]">&nbsp;</td>
                  <td className="border border-[#1E5AA8]">&nbsp;</td>
                  <td className="border border-[#1E5AA8]">&nbsp;</td>
                  <td className="border border-[#1E5AA8]">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="grid w-full max-w-[280px] grid-cols-2 border border-[#1E5AA8]">
            <div className="bg-[#3FA9E0] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
              Total
            </div>
            <div className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#0A2A66] sm:text-sm">
              {formatMoney(invoice.total, symbol)}
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500 sm:text-xs">
            <span className="font-semibold text-[#0A2A66]">Nota: </span>
            {invoice.notes}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-4 text-[#0A2A66]">
            <div className="flex flex-col gap-3 pt-1">
              {address ? <MapPin className="h-4 w-4" /> : null}
              <Phone className="h-4 w-4" />
              {website ? <Globe className="h-4 w-4" /> : null}
            </div>
            <div className="space-y-1 text-[10px] leading-relaxed text-[#0A2A66] sm:text-xs">
              {address ? <p className="max-w-[220px]">{address}</p> : null}
              <p>{settings?.phone_primary ?? ''}</p>
              <p>{settings?.phone_secondary ?? ''}</p>
              {website ? <p className="break-all">{website}</p> : null}
            </div>
          </div>

          <div className="w-full sm:w-56">
            <div className="mt-8 border-t border-[#0A2A66] pt-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#0A2A66] sm:text-xs">
              Firma cliente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
