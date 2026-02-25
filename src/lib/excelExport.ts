import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Purchase, AnnualSummaryByAccount, AnnualSummaryByVendor, AnnualSummaryByRequisition, AnnualSummaryByPurchaseType } from '../types';



export const exporttoExcel = async (
    year: number,
    purchases: Purchase[],
    byAccount: AnnualSummaryByAccount[],
    byVendor: AnnualSummaryByVendor[],
    byRequisition: AnnualSummaryByRequisition[],
    byPurchaseType: AnnualSummaryByPurchaseType[],
) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PurchaseGo';
    wb.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        },
    };

    const addHeaderRow = (ws: ExcelJS.Worksheet, cols: string[]) => {
        const row = ws.addRow(cols);
        row.eachCell((cell) => {
            cell.style = headerStyle;
        });
        row.height = 24;
    };

    // ── Sheet 1: 依總帳科目彙總 ──────────────────────────────────────────────
    const ws1 = wb.addWorksheet(`${year}年-依科目彙總`);
    ws1.columns = [
        { header: '', key: 'code', width: 14 },
        { header: '', key: 'name', width: 24 },
        { header: '', key: 'count', width: 10 },
        { header: '', key: 'total', width: 18 },
    ];
    addHeaderRow(ws1, ['科目代碼', '科目名稱', '採購筆數', '合計金額']);
    byAccount.forEach((a) => {
        ws1.addRow([a.ledgerAccountCode, a.ledgerAccountName, a.count, a.total]);
    });
    // Total row
    const total1 = byAccount.reduce((s, a) => s + a.total, 0);
    const totalCount1 = byAccount.reduce((s, a) => s + a.count, 0);
    const tr1 = ws1.addRow(['', '合計', totalCount1, total1]);
    tr1.font = { bold: true };

    // ── Sheet 2: 依廠商彙總 ─────────────────────────────────────────────────
    const ws2 = wb.addWorksheet(`${year}年-依廠商彙總`);
    ws2.columns = [
        { header: '', key: 'vendor', width: 28 },
        { header: '', key: 'count', width: 10 },
        { header: '', key: 'total', width: 18 },
    ];
    addHeaderRow(ws2, ['廠商名稱', '採購筆數', '合計金額']);
    byVendor.forEach((v) => {
        ws2.addRow([v.vendor, v.count, v.total]);
    });
    const total2 = byVendor.reduce((s, v) => s + v.total, 0);
    const totalCount2 = byVendor.reduce((s, v) => s + v.count, 0);
    const tr2 = ws2.addRow(['合計', totalCount2, total2]);
    tr2.font = { bold: true };

    // ── Sheet 3: 依請購類型彙總 ──────────────────────────────────────────────
    const wsReq = wb.addWorksheet(`${year}年-依請購類型彙總`);
    wsReq.columns = [
        { header: '', key: 'type', width: 28 },
        { header: '', key: 'count', width: 10 },
        { header: '', key: 'total', width: 18 },
    ];
    addHeaderRow(wsReq, ['請購類型', '採購筆數', '合計金額']);
    byRequisition.forEach((r) => {
        wsReq.addRow([r.type, r.count, r.total]);
    });
    const totalReq = byRequisition.reduce((s, r) => s + r.total, 0);
    const totalCountReq = byRequisition.reduce((s, r) => s + r.count, 0);
    const trReq = wsReq.addRow(['合計', totalCountReq, totalReq]);
    trReq.font = { bold: true };

    // ── Sheet 4: 依採購類型彙總 ──────────────────────────────────────────────
    const wsPur = wb.addWorksheet(`${year}年-依採購類型彙總`);
    wsPur.columns = [
        { header: '', key: 'type', width: 28 },
        { header: '', key: 'count', width: 10 },
        { header: '', key: 'total', width: 18 },
    ];
    addHeaderRow(wsPur, ['採購類型', '採購筆數', '合計金額']);
    byPurchaseType.forEach((p) => {
        wsPur.addRow([p.type, p.count, p.total]);
    });
    const totalPur = byPurchaseType.reduce((s, p) => s + p.total, 0);
    const totalCountPur = byPurchaseType.reduce((s, p) => s + p.count, 0);
    const trPur = wsPur.addRow(['合計', totalCountPur, totalPur]);
    trPur.font = { bold: true };

    // ── Sheet 5: 採購明細 ────────────────────────────────────────────────────
    const ws3 = wb.addWorksheet(`${year}年-採購明細`);
    ws3.columns = [
        { header: '', key: 'date', width: 14 },
        { header: '', key: 'itemNo', width: 8 },
        { header: '', key: 'title', width: 24 },
        { header: '', key: 'vendor', width: 20 },
        { header: '', key: 'account', width: 20 },
        { header: '', key: 'amount', width: 14 },
        { header: '', key: 'amountIncl', width: 14 },
        { header: '', key: 'reqType', width: 14 },
        { header: '', key: 'type', width: 14 },
        { header: '', key: 'note', width: 30 },
    ];
    addHeaderRow(ws3, ['採購日期', '項次', '品名', '廠商', '總帳科目', '金額 (未稅)', '金額 (含稅)', '發票', '文件號碼', '請購類型', '採購類型', '備註']);
    purchases.forEach((p) => {
        const d = p.purchaseDate.toDate();
        ws3.addRow([
            `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`,
            p.itemNo,
            p.title,
            p.vendor,
            p.ledgerAccountName,
            p.amount,
            Math.round(p.amount * 1.05),
            p.invoice,
            p.docNumber,
            p.requisitionType,
            p.purchaseType,
            p.note,
        ]);
    });
    const total3 = purchases.reduce((s, p) => s + p.amount, 0);
    const totalIncl3 = purchases.reduce((s, p) => s + Math.round(p.amount * 1.05), 0);
    const tr3 = ws3.addRow(['', '', '', '', '合計', total3, totalIncl3, '', '', '', '', '']);
    tr3.font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `PurchaseGo_${year}年報表.xlsx`);
};
