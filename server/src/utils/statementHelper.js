const PDFDocument = require('pdfkit');
const LedgerEntry = require('../models/LedgerEntry');
const { calculateAccountAgeing } = require('./ageingHelper');

/**
 * Format paise into Indian Rupee currency format (e.g. ₹1,250.00)
 */
const formatCurrency = (paise) => {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Format a Date object to DD/MM/YYYY
 */
const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Generate a statement PDF stream for an account and billing month
 * @param {Object} account - Populated account document (with shop & customer)
 * @param {string} monthStr - 'YYYY-MM'
 * @param {stream.Writable} res - HTTP response or writable stream
 */
const generateStatementPDF = async (account, monthStr, res) => {
  // 1. Parse Billing Month
  let year, monthIndex;
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [y, m] = monthStr.split('-').map(Number);
    year = y;
    monthIndex = m - 1; // 0-based
  } else {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
    monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }

  const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  // 2. Fetch all entries for this account
  const allEntries = await LedgerEntry.find({ account: account._id })
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  // Find reversed pairs
  const reversedEntryIds = new Set();
  for (const entry of allEntries) {
    if (entry.reversalOf) {
      reversedEntryIds.add(entry._id.toString());
      reversedEntryIds.add(entry.reversalOf.toString());
    }
  }

  // Calculate opening balance before startOfMonth
  let openingBalancePaise = 0;
  for (const entry of allEntries) {
    const isReversedPair = reversedEntryIds.has(entry._id.toString());
    if (new Date(entry.entryDate) < startOfMonth) {
      if (!isReversedPair) {
        if (entry.type === 'credit') {
          openingBalancePaise += entry.amountPaise;
        } else if (entry.type === 'payment') {
          openingBalancePaise -= entry.amountPaise;
        }
      }
    }
  }

  // Filter entries within this month
  const monthEntries = [];
  let periodCreditsPaise = 0;
  let periodPaymentsPaise = 0;
  let runningBalance = openingBalancePaise;

  for (const entry of allEntries) {
    const entryDate = new Date(entry.entryDate);
    if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
      const isReversedPair = reversedEntryIds.has(entry._id.toString());
      if (!isReversedPair) {
        if (entry.type === 'credit') {
          periodCreditsPaise += entry.amountPaise;
          runningBalance += entry.amountPaise;
        } else if (entry.type === 'payment') {
          periodPaymentsPaise += entry.amountPaise;
          runningBalance -= entry.amountPaise;
        }
      }

      monthEntries.push({
        ...entry,
        isReversedPair,
        computedRunningBalance: runningBalance
      });
    }
  }

  const closingBalancePaise = openingBalancePaise + periodCreditsPaise - periodPaymentsPaise;

  // 3. Calculate FIFO Ageing Summary
  const ageingData = await calculateAccountAgeing(account._id);

  // 4. Initialize PDFKit Document
  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    bufferPages: true
  });

  doc.pipe(res);

  // Month Name representation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const periodLabel = `${monthNames[monthIndex]} ${year}`;

  // Helper drawing functions
  const drawDivider = (y) => {
    doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(36, y).lineTo(559, y).stroke();
  };

  // --- HEADER SECTION ---
  doc.rect(36, 36, 523, 70).fill('#0f172a');

  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
    .text(account.shop?.name || 'UdhaarBook Store', 50, 48);

  doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
    .text(
      `Phone: ${account.shop?.phone || 'N/A'} | ${account.shop?.address || 'Neighbourhood Store'}`,
      50,
      70
    )
    .text('UdhaarBook Verified Credit Ledger', 50, 84);

  doc.fillColor('#38bdf8').fontSize(14).font('Helvetica-Bold')
    .text('ACCOUNT STATEMENT', 360, 48, { align: 'right', width: 185 });

  doc.fillColor('#e2e8f0').fontSize(9).font('Helvetica')
    .text(`Billing Period: ${periodLabel}`, 360, 70, { align: 'right', width: 185 })
    .text(`Statement Date: ${formatDate(new Date())}`, 360, 84, { align: 'right', width: 185 });

  doc.y = 118;

  // --- CUSTOMER & SUMMARY CARDS ---
  const cardY = 118;
  const colWidth = 255;

  // Customer Card
  doc.rect(36, cardY, colWidth, 90).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
    .text('CUSTOMER DETAILS', 46, cardY + 10);

  doc.fillColor('#334155').fontSize(9).font('Helvetica')
    .text(`Name: ${account.customer?.name || 'Customer'}`, 46, cardY + 28)
    .text(`Phone: ${account.customer?.phone || 'N/A'}`, 46, cardY + 42)
    .text(`Email: ${account.customer?.email || 'N/A'}`, 46, cardY + 56)
    .text(`Approved Credit Limit: ${formatCurrency(account.creditLimit)}`, 46, cardY + 70);

  // Statement Summary Card
  const sumX = 304;
  doc.rect(sumX, cardY, colWidth, 90).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
    .text('MONTHLY FINANCIAL SUMMARY', sumX + 10, cardY + 10);

  doc.fillColor('#334155').fontSize(9).font('Helvetica')
    .text('Opening Balance:', sumX + 10, cardY + 28)
    .text(formatCurrency(openingBalancePaise), sumX + 140, cardY + 28, { align: 'right', width: 95 })
    .text('Total Credits (Purchases):', sumX + 10, cardY + 42)
    .text(formatCurrency(periodCreditsPaise), sumX + 140, cardY + 42, { align: 'right', width: 95 })
    .text('Total Payments Made:', sumX + 10, cardY + 56)
    .text(formatCurrency(periodPaymentsPaise), sumX + 140, cardY + 56, { align: 'right', width: 95 });

  doc.font('Helvetica-Bold')
    .text('Net Closing Balance:', sumX + 10, cardY + 72)
    .fillColor(closingBalancePaise > 0 ? '#b91c1c' : '#15803d')
    .text(formatCurrency(closingBalancePaise), sumX + 140, cardY + 72, { align: 'right', width: 95 });

  // --- AGEING BUCKETS STRIP ---
  const ageingY = cardY + 100;
  doc.rect(36, ageingY, 523, 34).fillAndStroke('#f1f5f9', '#cbd5e1');

  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
    .text('FIFO Due Ageing Summary:', 46, ageingY + 12);

  doc.fillColor('#15803d').font('Helvetica')
    .text(`0–7 Days: ${formatCurrency(ageingData.ageing['0-7'])}`, 185, ageingY + 12);

  doc.fillColor('#d97706')
    .text(`8–30 Days: ${formatCurrency(ageingData.ageing['8-30'])}`, 305, ageingY + 12);

  doc.fillColor('#dc2626')
    .text(`30+ Days: ${formatCurrency(ageingData.ageing['30+'])}`, 435, ageingY + 12);

  // --- LEDGER TRANSACTIONS TABLE ---
  let tableY = ageingY + 48;
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
    .text(`Transactions Recorded in ${periodLabel}`, 36, tableY);

  tableY += 18;

  // Table Header
  doc.rect(36, tableY, 523, 22).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('Date', 44, tableY + 6);
  doc.text('Type', 105, tableY + 6);
  doc.text('Description / Note', 165, tableY + 6);
  doc.text('Status', 335, tableY + 6);
  doc.text('Amount', 390, tableY + 6, { align: 'right', width: 75 });
  doc.text('Running Bal', 475, tableY + 6, { align: 'right', width: 75 });

  tableY += 22;

  if (monthEntries.length === 0) {
    doc.rect(36, tableY, 523, 32).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
      .text('No ledger transactions recorded in this billing period.', 44, tableY + 10, {
        align: 'center',
        width: 507
      });
    tableY += 32;
  } else {
    monthEntries.forEach((entry, index) => {
      // Check for page overflow
      if (tableY > doc.page.height - 70) {
        doc.addPage();
        tableY = 36;

        // Re-print Table Header on new page
        doc.rect(36, tableY, 523, 22).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
        doc.text('Date', 44, tableY + 6);
        doc.text('Type', 105, tableY + 6);
        doc.text('Description / Note', 165, tableY + 6);
        doc.text('Status', 335, tableY + 6);
        doc.text('Amount', 390, tableY + 6, { align: 'right', width: 75 });
        doc.text('Running Bal', 475, tableY + 6, { align: 'right', width: 75 });
        tableY += 22;
      }

      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(36, tableY, 523, 20).fillAndStroke(rowBg, '#f1f5f9');

      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(formatDate(entry.entryDate), 44, tableY + 5);

      // Type
      if (entry.type === 'credit') {
        doc.fillColor('#b91c1c').font('Helvetica-Bold').text('CREDIT', 105, tableY + 5);
      } else {
        doc.fillColor('#15803d').font('Helvetica-Bold').text('PAYMENT', 105, tableY + 5);
      }

      // Note (truncate if long)
      doc.fillColor('#334155').font('Helvetica');
      const noteText = entry.isReversedPair
        ? `[REVERSED] ${entry.note || 'No note'}`
        : entry.note || '-';
      doc.text(noteText.slice(0, 32), 165, tableY + 5);

      // Status
      doc.fillColor('#64748b').text(entry.status || 'pending', 335, tableY + 5);

      // Amount
      const amtSign = entry.type === 'credit' ? '+' : '-';
      doc.fillColor(entry.type === 'credit' ? '#b91c1c' : '#15803d').font('Helvetica-Bold');
      doc.text(`${amtSign}${formatCurrency(entry.amountPaise)}`, 390, tableY + 5, {
        align: 'right',
        width: 75
      });

      // Running Balance
      doc.fillColor('#0f172a').font('Helvetica');
      doc.text(formatCurrency(entry.computedRunningBalance), 475, tableY + 5, {
        align: 'right',
        width: 75
      });

      tableY += 20;
    });
  }

  // --- FOOTER & PAGE NUMBERING ---
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    drawDivider(doc.page.height - 40);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
      .text(
        'UdhaarBook • Append-Only Digital Credit Ledger • Generated for audit and record purposes.',
        36,
        doc.page.height - 32
      )
      .text(`Page ${i + 1} of ${totalPages}`, 36, doc.page.height - 32, {
        align: 'right',
        width: 523
      });
  }

  doc.end();
};

module.exports = {
  generateStatementPDF
};

