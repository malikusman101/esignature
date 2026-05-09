const { User, Document, Signer, SignatureField, AuditLog } = require('../models');
const { embedSignedFields, generateAuditTrail } = require('../services/pdf');
const { sendEmail } = require('../services/email');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const logAudit = (documentId, action, opts={}) => AuditLog.create({ documentId, action, ...opts });

const checkDocumentCompletion = async (document) => {
  const allSigners = await Signer.findAll({ where: { documentId: document.id, role: ['signer','approver'] } });
  const allSigned = allSigners.every(s => s.status === 'signed');
  if (!allSigned) {
    if (document.signOrder) {
      const next = allSigners.filter(s=>s.status==='pending').sort((a,b)=>a.signingOrder-b.signingOrder)[0];
      if (next) {
        const owner = await User.findByPk(document.ownerId);
        const signUrl = `${process.env.FRONTEND_URL}/sign/${next.accessToken}`;
        sendEmail({ to: next.email, template: 'signRequest', data: [next.name, `${owner.firstName} ${owner.lastName}`, document.title, signUrl, document.message] });
      }
    }
    return false;
  }
  const fields = await SignatureField.findAll({ where: { documentId: document.id } });
  const signedPath = await embedSignedFields(document, fields);
  const auditLogs = await AuditLog.findAll({ where: { documentId: document.id }, order: [['createdAt','ASC']] });
  const allSignersFull = await Signer.findAll({ where: { documentId: document.id } });
  const auditPath = await generateAuditTrail(document, allSignersFull, auditLogs);
  await document.update({ status: 'completed', completedAt: new Date(), signedFilePath: signedPath, auditTrailPath: auditPath });
  await logAudit(document.id, 'document_completed', { description: 'All parties signed' });
  const owner = await User.findByPk(document.ownerId);
  const downloadUrl = `${process.env.FRONTEND_URL}/documents/${document.id}`;
  sendEmail({ to: owner.email, template: 'documentCompleted', data: [owner.firstName, document.title, downloadUrl] });
  for (const s of allSignersFull) sendEmail({ to: s.email, template: 'signedConfirmation', data: [s.name, document.title] });
  return true;
};

exports.getSigningData = asyncHandler(async (req, res) => {
  const signer = await Signer.findOne({ where: { accessToken: req.params.token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link.');
  if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) throw new ApiError(410, 'Signing link expired.');
  const document = await Document.findByPk(signer.documentId, {
    include: [{ model: Signer, as: 'signers', attributes: ['id','name','email','status','color','signingOrder'] }],
  });
  if (!document) throw new ApiError(404, 'Document not found.');
  if (document.status === 'voided') throw new ApiError(410, 'Document has been voided.');
  if (document.status === 'completed') return res.json({ success: true, data: { document, signer, status: 'completed', fields: [] } });
  if (document.signOrder) {
    const minOrder = Math.min(...document.signers.filter(s=>s.status==='pending').map(s=>s.signingOrder));
    if (signer.signingOrder > minOrder) return res.json({ success: true, data: { document, signer, status: 'waiting_turn', fields: [] } });
  }
  const fields = await SignatureField.findAll({ where: { documentId: document.id, signerId: signer.id }, order: [['page','ASC'],['y','ASC']] });
  if (signer.status === 'pending') {
    await signer.update({ status: 'viewed', viewedAt: new Date(), ipAddress: req.ip, userAgent: req.get('User-Agent') });
    await logAudit(document.id, 'document_viewed', { signerId: signer.id, description: `${signer.name} viewed the document`, ipAddress: req.ip });
  }
  const documentUrl = `${process.env.APP_URL}/api/sign/${req.params.token}/file`;
  res.json({ success: true, data: { document: { id:document.id, title:document.title, message:document.message, status:document.status, signers:document.signers, pageCount:document.pageCount }, signer, fields, documentUrl, status: 'ready' } });
});

exports.getDocumentFile = asyncHandler(async (req, res) => {
  const signer = await Signer.findOne({ where: { accessToken: req.params.token } });
  if (!signer) throw new ApiError(403, 'Unauthorized.');
  const document = await Document.findByPk(signer.documentId);
  if (!document) throw new ApiError(404, 'File not found.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(require('path').resolve(document.filePath));
});

exports.submitSignatures = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { fields: submittedFields } = req.body;
  if (!submittedFields?.length) throw new ApiError(400, 'No fields submitted.');
  const signer = await Signer.findOne({ where: { accessToken: token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link.');
  if (signer.status === 'signed') throw new ApiError(400, 'Already signed.');
  if (signer.status === 'declined') throw new ApiError(400, 'You declined this document.');
  const document = await Document.findByPk(signer.documentId);
  if (!document) throw new ApiError(404, 'Document not found.');
  if (['completed','voided','cancelled'].includes(document.status)) throw new ApiError(400, `Document is ${document.status}.`);
  const dbFields = await SignatureField.findAll({ where: { documentId: document.id, signerId: signer.id } });
  const submittedMap = new Map(submittedFields.map(f=>[f.id, f]));
  const missing = dbFields.filter(f => f.required && (() => { const s = submittedMap.get(f.id); return !s || (!s.value && !s.signatureData); })());
  if (missing.length) throw new ApiError(422, `${missing.length} required field(s) incomplete.`);
  await Promise.all(submittedFields.map(async sf => {
    const dbField = dbFields.find(f=>f.id===sf.id);
    if (!dbField) return;
    await dbField.update({ value: sf.value||null, signatureData: sf.signatureData||null, filledAt: new Date() });
    await logAudit(document.id, 'field_filled', { signerId: signer.id, description: `${signer.name} filled ${dbField.type}` });
  }));
  await signer.update({ status: 'signed', signedAt: new Date(), ipAddress: req.ip, userAgent: req.get('User-Agent') });
  if (document.status === 'pending') await document.update({ status: 'in_progress' });
  await logAudit(document.id, 'document_signed', { signerId: signer.id, description: `${signer.name} <${signer.email}> signed`, ipAddress: req.ip });
  const isComplete = await checkDocumentCompletion(document);
  res.json({ success: true, message: isComplete ? 'All parties signed!' : 'Signature recorded. Thank you!', data: { isComplete } });
});

exports.declineSignature = asyncHandler(async (req, res) => {
  const signer = await Signer.findOne({ where: { accessToken: req.params.token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link.');
  if (signer.status === 'signed') throw new ApiError(400, 'Already signed.');
  await signer.update({ status: 'declined', declinedAt: new Date(), declineReason: req.body.reason||'No reason' });
  const document = await Document.findByPk(signer.documentId);
  await document.update({ status: 'declined' });
  await logAudit(document.id, 'document_declined', { signerId: signer.id, description: `${signer.name} declined`, ipAddress: req.ip });
  res.json({ success: true, message: 'Document declined.' });
});
