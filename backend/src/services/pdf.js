const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

// removed canvas dependency for better performance and fewer issues with headless environments

const hexToRgb = (hex) => {
    const clean = (hex || '#000000').replace('#', '');
    return rgb(
        parseInt(clean.slice(0, 2), 16) / 255,
        parseInt(clean.slice(2, 4), 16) / 255,
        parseInt(clean.slice(4, 6), 16) / 255
    );
};

const embedSignedFields = async (document, fields) => {
    const originalBytes = await fs.readFile(document.filePath);
    const pdfDoc = await PDFDocument.load(originalBytes);
    const pages = pdfDoc.getPages();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const field of fields) {
        if (!field.value && !field.signatureData) continue;
        const pageIndex = (field.page || 1) - 1;
        const page = pages[pageIndex];
        if (!page) continue;
        const { width: pw, height: ph } = page.getSize();
        const absX = (field.x / 100) * pw;
        const absH = (field.height / 100) * ph;
        const absW = (field.width / 100) * pw;
        const absY = ph - ((field.y / 100) * ph) - absH;
        const fieldColor = hexToRgb(field.color);

        if ((field.type === 'signature' || field.type === 'initials') && field.signatureData) {
            try {
                const b64 = field.signatureData.replace(/^data:image\/png;base64,/, '');
                const imgBytes = Buffer.from(b64, 'base64');
                const image = await pdfDoc.embedPng(imgBytes);
                page.drawImage(image, { x: absX, y: absY, width: absW, height: absH });
            } catch (e) { console.error('Sig embed error:', e.message); }
        } else if (field.type === 'checkbox') {
            const size = Math.min(absW, absH) - 4;
            page.drawRectangle({ x: absX + 2, y: absY + 2, width: size, height: size, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1.5 });
            if (field.value === 'true') {
                page.drawLine({ start: { x: absX + 2 + size * 0.15, y: absY + 2 + size * 0.5 }, end: { x: absX + 2 + size * 0.4, y: absY + 2 + size * 0.2 }, thickness: 2, color: rgb(0.06, 0.47, 0.14) });
                page.drawLine({ start: { x: absX + 2 + size * 0.4, y: absY + 2 + size * 0.2 }, end: { x: absX + 2 + size * 0.85, y: absY + 2 + size * 0.8 }, thickness: 2, color: rgb(0.06, 0.47, 0.14) });
            }
        } else if (field.value) {
            const fontSize = Math.min(field.fontSize || 12, absH * 0.75);
            page.drawText(String(field.value), { x: absX + 2, y: absY + (absH - fontSize) / 2, size: fontSize, font: helvetica, color: fieldColor, maxWidth: absW - 4 });
        }
    }

    for (const page of pages) {
        const { width } = page.getSize();
        page.drawText(`Signed via eSign · ${new Date().toISOString()} · ID: ${document.id}`, {
            x: 20, y: 8, size: 6, font: helvetica, color: rgb(0.6, 0.6, 0.6), maxWidth: width - 40,
        });
    }

    const signedBytes = await pdfDoc.save();
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const signedPath = path.join(uploadDir, 'signed', `signed_${document.id}_${Date.now()}.pdf`);
    await fs.mkdir(path.join(uploadDir, 'signed'), { recursive: true });
    await fs.writeFile(signedPath, signedBytes);
    return signedPath;
};

const generateAuditTrail = async (document, signers, auditLogs) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = height - 60;

    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.1, 0.1, 0.18) });
    page.drawText('eSign Certificate of Completion', { x: 40, y: height - 50, size: 16, font: bold, color: rgb(1, 1, 1) });

    y = height - 110;
    const write = (text, size = 10, font = regular) => {
        if (y < 60) return;
        page.drawText(String(text), { x: 40, y, size, font, color: rgb(0.15, 0.15, 0.15), maxWidth: width - 80 });
        y -= size + 8;
    };

    write(`Document: ${document.title}`, 12, bold);
    write(`ID: ${document.id}`, 9);
    write(`Status: ${document.status}`, 10);
    write(`Created: ${new Date(document.createdAt).toUTCString()}`, 10);
    y -= 8;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 12;

    write('SIGNERS', 9, bold);
    for (const s of signers) {
        write(`${s.name} <${s.email}> — ${s.status}`, 10);
        if (s.signedAt) write(`  Signed: ${new Date(s.signedAt).toUTCString()}`, 9);
        if (s.ipAddress) write(`  IP: ${s.ipAddress}`, 9);
    }
    y -= 8;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 12;

    write('AUDIT TRAIL', 9, bold);
    for (const log of auditLogs) {
        write(`• ${new Date(log.createdAt).toUTCString()} — ${log.action}`, 9);
        if (log.description) write(`  ${log.description}`, 8);
    }

    const auditBytes = await pdfDoc.save();
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const auditPath = path.join(uploadDir, 'audits', `audit_${document.id}_${Date.now()}.pdf`);
    await fs.mkdir(path.join(uploadDir, 'audits'), { recursive: true });
    await fs.writeFile(auditPath, auditBytes);
    return auditPath;
};

module.exports = { embedSignedFields, generateAuditTrail };