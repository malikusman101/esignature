const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { User, Document, Signer, SignatureField, AuditLog } = require('../models');
const { generateSignerToken } = require('../utils/jwt');
const { sendEmail } = require('../services/email');
const { embedSignedFields, generateAuditTrail } = require('../services/pdf');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const logAudit = (documentId, action, opts={}) => AuditLog.create({ documentId, action, ...opts });

exports.uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded.');
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
  await logAudit(document.id, 'document_created', { userId: req.user.id, description: `Uploaded "${document.title}"`, ipAddress: req.ip });
  res.status(201).json({ success: true, data: { document } });
});

exports.getDocuments = asyncHandler(async (req, res) => {
  const { status, search, page=1, limit=10, sortBy='createdAt', sortOrder='DESC' } = req.query;
  const where = { ownerId: req.user.id };
  if (status && status !== 'all') where.status = status;
  if (search) where.title = { [Op.iLike]: `%${search}%` };
  const { count, rows: documents } = await Document.findAndCountAll({
    where,
    include: [{ model: Signer, as: 'signers', attributes: ['id','name','email','status','signingOrder','color'] }],
    order: [[sortBy, sortOrder.toUpperCase()]],
    limit: parseInt(limit),
    offset: (parseInt(page)-1)*parseInt(limit),
  });
  res.json({ success: true, data: { documents, pagination: { total:count, page:parseInt(page), limit:parseInt(limit), pages:Math.ceil(count/parseInt(limit)) } } });
});

exports.getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
    include: [
      { model: Signer, as: 'signers', include: [{ model: SignatureField, as: 'fields' }] },
      { model: AuditLog, as: 'auditLogs', order: [['createdAt','ASC']], limit: 100 },
    ],
  });
  if (!document) throw new ApiError(404, 'Document not found.');
  res.json({ success: true, data: { document } });
});

exports.updateDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
  if (!document) throw new ApiError(404, 'Document not found.');
  if (document.status !== 'draft') throw new ApiError(400, 'Only draft documents can be edited.');
  const { title, description, message, expiresAt, signOrder } = req.body;
  await document.update({ title, description, message, expiresAt, signOrder });
  res.json({ success: true, data: { document } });
});

exports.sendDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
  if (!document) throw new ApiError(404, 'Document not found.');
  if (!req.body.signers?.length) throw new ApiError(400, 'At least one signer required.');
  const { signers: signerData, fields: fieldData, message } = req.body;
  await Signer.destroy({ where: { documentId: document.id } });
  const COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444'];
  const createdSigners = await Promise.all(signerData.map(async (s, idx) => {
    const signer = await Signer.create({
      documentId: document.id, name: s.name, email: s.email.toLowerCase(),
      role: s.role||'signer', signingOrder: s.signingOrder||idx+1,
      color: s.color||COLORS[idx%COLORS.length],
      accessToken: generateSignerToken(uuidv4(), document.id),
      tokenExpiresAt: new Date(Date.now()+30*24*3600*1000),
    });
    const existing = await User.findOne({ where: { email: signer.email } });
    if (existing) await signer.update({ userId: existing.id });
    return signer;
  }));
  if (fieldData?.length) {
    await SignatureField.bulkCreate(fieldData.map(f => ({
      documentId: document.id, signerId: createdSigners[f.signerIndex]?.id||createdSigners[0].id,
      type: f.type, page: f.page||1, x: f.x, y: f.y, width: f.width, height: f.height,
      required: f.required!==false, label: f.label, placeholder: f.placeholder, options: f.options||{},
    })));
  }
  await document.update({ status: 'pending', message: message||document.message });
  const senderName = `${req.user.firstName} ${req.user.lastName}`;
  const toEmail = document.signOrder ? createdSigners.filter(s=>s.signingOrder===1) : createdSigners.filter(s=>s.role!=='cc');
  await Promise.all(toEmail.map(signer => {
    const signUrl = `${process.env.FRONTEND_URL}/sign/${signer.accessToken}`;
    return sendEmail({ to: signer.email, template: 'signRequest', data: [signer.name, senderName, document.title, signUrl, message] });
  }));
  await logAudit(document.id, 'document_sent', { userId: req.user.id, description: `Sent to ${createdSigners.length} signer(s)`, ipAddress: req.ip });
  res.json({ success: true, message: `Document sent to ${toEmail.length} signer(s).`, data: { document, signers: createdSigners } });
});

exports.sendReminder = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ where: { id: req.params.id, ownerId: req.user.id }, include: [{ model: Signer, as: 'signers' }] });
  if (!document) throw new ApiError(404, 'Document not found.');
  const pending = document.signers.filter(s=>s.status==='pending');
  if (!pending.length) throw new ApiError(400, 'No pending signers.');
  const senderName = `${req.user.firstName} ${req.user.lastName}`;
  await Promise.all(pending.map(async signer => {
    const signUrl = `${process.env.FRONTEND_URL}/sign/${signer.accessToken}`;
    await sendEmail({ to: signer.email, template: 'reminder', data: [signer.name, senderName, document.title, signUrl] });
    await signer.update({ reminderCount: (signer.reminderCount||0)+1, lastReminderAt: new Date() });
  }));
  await logAudit(document.id, 'reminder_sent', { userId: req.user.id, description: `Reminder sent to ${pending.length} signer(s)` });
  res.json({ success: true, message: `Reminder sent to ${pending.length} signer(s).` });
});

exports.voidDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
  if (!document) throw new ApiError(404, 'Document not found.');
  if (['completed','voided','cancelled'].includes(document.status)) throw new ApiError(400, `Document is already ${document.status}.`);
  await document.update({ status: 'voided', voidedAt: new Date(), voidReason: req.body.reason||'Voided by owner' });
  await logAudit(document.id, 'document_voided', { userId: req.user.id, description: req.body.reason||'Voided by owner' });
  res.json({ success: true, message: 'Document voided.', data: { document } });
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
  if (!document) throw new ApiError(404, 'Document not found.');
  const filePath = document.signedFilePath || document.filePath;
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'File not found on server.');
  await logAudit(document.id, 'document_downloaded', { userId: req.user.id, ipAddress: req.ip });
  res.download(filePath, `${document.title}.pdf`);
});

exports.downloadAuditTrail = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    where: { id: req.params.id, ownerId: req.user.id },
    include: [{ model: Signer, as: 'signers' }, { model: AuditLog, as: 'auditLogs', order: [['createdAt','ASC']] }],
  });
  if (!document) throw new ApiError(404, 'Document not found.');
  const auditPath = await generateAuditTrail(document, document.signers, document.auditLogs);
  res.download(auditPath, `audit_${document.title}.pdf`);
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const uid = req.user.id;
  const [total, draft, pending, completed, declined] = await Promise.all([
    Document.count({ where: { ownerId: uid } }),
    Document.count({ where: { ownerId: uid, status: 'draft' } }),
    Document.count({ where: { ownerId: uid, status: ['pending','in_progress'] } }),
    Document.count({ where: { ownerId: uid, status: 'completed' } }),
    Document.count({ where: { ownerId: uid, status: 'declined' } }),
  ]);
  res.json({ success: true, data: { stats: { total, draft, pending, completed, declined } } });
});
