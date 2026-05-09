/**
 * DOCUMENT CONTROLLER
 *
 * POST   /api/documents              – upload a new document
 * GET    /api/documents              – list user's documents (paginated + filtered)
 * GET    /api/documents/:id          – get single document with signers & fields
 * PUT    /api/documents/:id          – update title/description/message
 * DELETE /api/documents/:id          – soft-delete (void) document
 * POST   /api/documents/:id/send     – add signers + fields → email everyone
 * POST   /api/documents/:id/remind   – send reminder to pending signers
 * POST   /api/documents/:id/void     – void the document
 * GET    /api/documents/:id/download – download signed PDF
 * GET    /api/documents/:id/audit    – download audit trail PDF
 */

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { User, Document, Signer, SignatureField, AuditLog } = require('../models');
const { generateSignerToken } = require('../utils/jwt');
const { sendEmail } = require('../services/emailService');
const { embedSignedFields, generateAuditTrail } = require('../services/pdfService');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

// Helper: log an audit event
const logAudit = (documentId, action, opts = {}) =>
  AuditLog.create({ documentId, action, ...opts });

// ── UPLOAD DOCUMENT ───────────────────────────────────────────────────────────
exports.uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded. Please attach a PDF.');

  const { title, description } = req.body;

  const document = await Document.create({
    title: title || req.file.originalname,
    description,
    originalFilename: req.file.originalname,
    storedFilename: req.file.filename,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    ownerId: req.user.id,
    status: 'draft',
  });

  await logAudit(document.id, 'document_created', {
    userId: req.user.id,
    description: `Document "${document.title}" uploaded`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully.',
    data: { document },
  });
});

// ── LIST DOCUMENTS ────────────────────────────────────────────────────────────
exports.getDocuments = asyncHandler(async (req, res) => {
  const {
    status,
    search,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  } = req.query;

  const where = { ownerId: req.user.id };

  if (status && status !== 'all') where.status = status;

  if (search) {
    where.title = { [Op.iLike]: `%${search}%` };
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: documents } = await Document.findAndCountAll({
    where,
    include: [
      {
        model: Signer,
        as: 'signers',
        attributes: ['id', 'name', 'email', 'status', 'signingOrder', 'color'],
      },
    ],
    order: [[sortBy, sortOrder.toUpperCase()]],
    limit: parseInt(limit),
    offset,
  });

  res.json({
    success: true,
    data: {
      documents,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

// ── GET SINGLE DOCUMENT ───────────────────────────────────────────────────────
exports.getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
    include: [
      {
        model: Signer,
        as: 'signers',
        include: [{ model: SignatureField, as: 'fields' }],
      },
      {
        model: AuditLog,
        as: 'auditLogs',
        order: [['createdAt', 'ASC']],
        limit: 100,
      },
    ],
  });

  if (!document) throw new ApiError(404, 'Document not found.');

  res.json({ success: true, data: { document } });
});

// ── UPDATE DOCUMENT ───────────────────────────────────────────────────────────
exports.updateDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) throw new ApiError(404, 'Document not found.');
  if (document.status !== 'draft') {
    throw new ApiError(400, 'Only draft documents can be edited.');
  }

  const { title, description, message, expiresAt, signOrder } = req.body;
  await document.update({ title, description, message, expiresAt, signOrder });

  res.json({ success: true, message: 'Document updated.', data: { document } });
});

// ── SEND DOCUMENT ─────────────────────────────────────────────────────────────
/**
 * Body shape:
 * {
 *   signers: [
 *     { name, email, role, signingOrder, color }
 *   ],
 *   fields: [
 *     { signerIndex, type, page, x, y, width, height, required, label }
 *   ],
 *   message: "Please review and sign..."
 * }
 */
exports.sendDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) throw new ApiError(404, 'Document not found.');
  if (!['draft', 'pending'].includes(document.status)) {
    throw new ApiError(400, 'Document has already been sent and cannot be resent in this state.');
  }
  if (!req.body.signers || req.body.signers.length === 0) {
    throw new ApiError(400, 'At least one signer is required.');
  }

  const { signers: signerData, fields: fieldData, message } = req.body;

  // 1. Remove existing signers/fields if resending
  await Signer.destroy({ where: { documentId: document.id } });

  // 2. Create signers with unique access tokens
  const SIGNER_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
  const createdSigners = await Promise.all(
    signerData.map(async (s, idx) => {
      const signer = await Signer.create({
        documentId: document.id,
        name: s.name,
        email: s.email.toLowerCase(),
        role: s.role || 'signer',
        signingOrder: s.signingOrder || idx + 1,
        color: s.color || SIGNER_COLORS[idx % SIGNER_COLORS.length],
        accessToken: generateSignerToken(uuidv4(), document.id),
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days
      });

      // Link to existing user account if they have one
      const existingUser = await User.findOne({ where: { email: signer.email } });
      if (existingUser) await signer.update({ userId: existingUser.id });

      return signer;
    })
  );

  // 3. Create signature fields, mapping signerIndex → actual signer ID
  if (fieldData && fieldData.length > 0) {
    await SignatureField.bulkCreate(
      fieldData.map((f) => ({
        documentId: document.id,
        signerId: createdSigners[f.signerIndex]?.id || createdSigners[0].id,
        type: f.type,
        page: f.page || 1,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required !== false,
        label: f.label,
        placeholder: f.placeholder,
        options: f.options || {},
      }))
    );
  }

  // 4. Update document status and message
  await document.update({ status: 'pending', message: message || document.message });

  // 5. Decide who gets emailed now (respects signOrder)
  const toEmail = document.signOrder
    ? createdSigners.filter((s) => s.signingOrder === 1)
    : createdSigners.filter((s) => s.role !== 'cc'); // everyone except CC

  // CC signers always get a notification
  const ccSigners = createdSigners.filter((s) => s.role === 'cc');

  const senderName = `${req.user.firstName} ${req.user.lastName}`;

  // 6. Send emails
  await Promise.all([
    ...toEmail.map((signer) => {
      const signUrl = `${process.env.FRONTEND_URL}/sign/${signer.accessToken}`;
      return sendEmail({
        to: signer.email,
        template: 'signRequest',
        data: [signer.name, senderName, document.title, signUrl, message],
      }).catch((e) => console.error(`Email to ${signer.email} failed:`, e.message));
    }),
    ...ccSigners.map((signer) => {
      const viewUrl = `${process.env.FRONTEND_URL}/sign/${signer.accessToken}`;
      return sendEmail({
        to: signer.email,
        template: 'signRequest',
        data: [signer.name, senderName, document.title, viewUrl, message],
      }).catch((e) => console.error(`CC email to ${signer.email} failed:`, e.message));
    }),
  ]);

  await logAudit(document.id, 'document_sent', {
    userId: req.user.id,
    description: `Sent to ${createdSigners.length} signer(s)`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: `Document sent to ${toEmail.length} signer(s).`,
    data: { document, signers: createdSigners },
  });
});

// ── SEND REMINDER ─────────────────────────────────────────────────────────────
exports.sendReminder = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
    include: [{ model: Signer, as: 'signers' }],
  });

  if (!document) throw new ApiError(404, 'Document not found.');
  if (document.status !== 'pending' && document.status !== 'in_progress') {
    throw new ApiError(400, 'Reminders can only be sent for pending or in-progress documents.');
  }

  const pendingSigners = document.signers.filter((s) => s.status === 'pending');
  if (pendingSigners.length === 0) throw new ApiError(400, 'No pending signers to remind.');

  const senderName = `${req.user.firstName} ${req.user.lastName}`;

  await Promise.all(
    pendingSigners.map(async (signer) => {
      const signUrl = `${process.env.FRONTEND_URL}/sign/${signer.accessToken}`;
      await sendEmail({
        to: signer.email,
        template: 'reminder',
        data: [signer.name, senderName, document.title, signUrl],
      }).catch((e) => console.error(`Reminder to ${signer.email} failed:`, e.message));

      await signer.update({
        reminderCount: (signer.reminderCount || 0) + 1,
        lastReminderAt: new Date(),
      });
    })
  );

  await logAudit(document.id, 'reminder_sent', {
    userId: req.user.id,
    description: `Reminder sent to ${pendingSigners.length} signer(s)`,
  });

  res.json({ success: true, message: `Reminder sent to ${pendingSigners.length} signer(s).` });
});

// ── VOID DOCUMENT ─────────────────────────────────────────────────────────────
exports.voidDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) throw new ApiError(404, 'Document not found.');
  if (['completed', 'voided', 'cancelled'].includes(document.status)) {
    throw new ApiError(400, `Document is already ${document.status}.`);
  }

  await document.update({
    status: 'voided',
    voidedAt: new Date(),
    voidReason: req.body.reason || 'Voided by owner',
  });

  await logAudit(document.id, 'document_voided', {
    userId: req.user.id,
    description: req.body.reason || 'Voided by owner',
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Document voided.', data: { document } });
});

// ── DOWNLOAD SIGNED PDF ───────────────────────────────────────────────────────
exports.downloadDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) throw new ApiError(404, 'Document not found.');

  const filePath = document.signedFilePath || document.filePath;
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found on server.');

  await logAudit(document.id, 'document_downloaded', { userId: req.user.id, ipAddress: req.ip });

  res.download(filePath, `${document.title}.pdf`);
});

// ── DOWNLOAD AUDIT TRAIL ──────────────────────────────────────────────────────
exports.downloadAuditTrail = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
    include: [
      { model: Signer, as: 'signers' },
      { model: AuditLog, as: 'auditLogs', order: [['createdAt', 'ASC']] },
    ],
  });

  if (!document) throw new ApiError(404, 'Document not found.');

  // Generate fresh audit trail PDF
  const auditPath = await generateAuditTrail(document, document.signers, document.auditLogs);

  res.download(auditPath, `audit_trail_${document.title}.pdf`);
});

// ── GET DASHBOARD STATS ───────────────────────────────────────────────────────
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [total, draft, pending, completed, declined] = await Promise.all([
    Document.count({ where: { ownerId: userId } }),
    Document.count({ where: { ownerId: userId, status: 'draft' } }),
    Document.count({ where: { ownerId: userId, status: ['pending', 'in_progress'] } }),
    Document.count({ where: { ownerId: userId, status: 'completed' } }),
    Document.count({ where: { ownerId: userId, status: 'declined' } }),
  ]);

  // Documents completed in last 30 days
  const recentCompleted = await Document.count({
    where: {
      ownerId: userId,
      status: 'completed',
      completedAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    },
  });

  res.json({
    success: true,
    data: { stats: { total, draft, pending, completed, declined, recentCompleted } },
  });
});