/**
 * SIGNING CONTROLLER  (public-facing – no auth required)
 *
 * GET  /api/sign/:token          – signer lands on this URL from their email.
 *                                  Returns document + their specific fields.
 * POST /api/sign/:token/submit   – signer submits their completed fields.
 * POST /api/sign/:token/decline  – signer declines to sign.
 *
 * The :token is the signed JWT stored in Signer.accessToken.
 * It embeds signerId + documentId and expires in 30 days.
 */

const { verifySignerToken } = require('../utils/jwt');
const { User, Document, Signer, SignatureField, AuditLog } = require('../models');
const { embedSignedFields, generateAuditTrail } = require('../services/pdf');
const { sendEmail } = require('../services/email');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

// Helper to log audit
const logAudit = (documentId, action, opts = {}) =>
  AuditLog.create({ documentId, action, ...opts });

// ── HELPER: checkDocumentCompletion ──────────────────────────────────────────
/**
 * After each signing, check if ALL required signers have signed.
 * If yes → generate the final signed PDF, update document status,
 * and email all parties the completed doc.
 */
const checkDocumentCompletion = async (document) => {
  const allSigners = await Signer.findAll({
    where: { documentId: document.id, role: ['signer', 'approver'] },
  });

  const allSigned = allSigners.every((s) => s.status === 'signed');
  if (!allSigned) {
    // If sign-order is enabled, email next signer in sequence
    if (document.signOrder) {
      const nextSigner = allSigners
        .filter((s) => s.status === 'pending')
        .sort((a, b) => a.signingOrder - b.signingOrder)[0];

      if (nextSigner) {
        const owner = await User.findByPk(document.ownerId);
        const senderName = `${owner.firstName} ${owner.lastName}`;
        const signUrl = `${process.env.FRONTEND_URL}/sign/${nextSigner.accessToken}`;
        await sendEmail({
          to: nextSigner.email,
          template: 'signRequest',
          data: [nextSigner.name, senderName, document.title, signUrl, document.message],
        }).catch(console.error);
      }
    }
    return false;
  }

  // ── ALL SIGNED → finalise ────────────────────────────────────────────────
  // 1. Get all filled fields
  const fields = await SignatureField.findAll({ where: { documentId: document.id } });

  // 2. Embed into PDF
  const signedPath = await embedSignedFields(document, fields);

  // 3. Generate audit trail
  const auditLogs = await AuditLog.findAll({
    where: { documentId: document.id },
    order: [['createdAt', 'ASC']],
  });
  const allSignersFull = await Signer.findAll({ where: { documentId: document.id } });
  const auditPath = await generateAuditTrail(document, allSignersFull, auditLogs);

  // 4. Mark document completed
  await document.update({
    status: 'completed',
    completedAt: new Date(),
    signedFilePath: signedPath,
    auditTrailPath: auditPath,
  });

  await logAudit(document.id, 'document_completed', {
    description: 'All parties have signed',
  });

  // 5. Email owner + all signers the completed notification
  const owner = await User.findByPk(document.ownerId);
  const downloadUrl = `${process.env.FRONTEND_URL}/documents/${document.id}`;

  await sendEmail({
    to: owner.email,
    template: 'documentCompleted',
    data: [owner.firstName, document.title, downloadUrl],
  }).catch(console.error);

  for (const signer of allSignersFull) {
    await sendEmail({
      to: signer.email,
      template: 'signedConfirmation',
      data: [signer.name, document.title],
    }).catch(console.error);
  }

  return true;
};

// ── GET SIGNING PAGE DATA ─────────────────────────────────────────────────────
exports.getSigningData = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // 1. Find signer by access token
  const signer = await Signer.findOne({ where: { accessToken: token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link. Please contact the document sender.');

  // 2. Check token hasn't expired
  if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
    throw new ApiError(410, 'This signing link has expired. Please contact the document sender.');
  }

  // 3. Check document state
  const document = await Document.findByPk(signer.documentId, {
    include: [{ model: Signer, as: 'signers', attributes: ['id', 'name', 'email', 'status', 'color', 'signingOrder'] }],
  });

  if (!document) throw new ApiError(404, 'Document not found.');
  if (document.status === 'voided') throw new ApiError(410, 'This document has been voided by the sender.');
  if (document.status === 'completed') {
    return res.json({ success: true, data: { document, signer, status: 'completed', fields: [] } });
  }

  // 4. If sign-order: check it's this signer's turn
  if (document.signOrder) {
    const minPendingOrder = Math.min(
      ...document.signers.filter((s) => s.status === 'pending').map((s) => s.signingOrder)
    );
    if (signer.signingOrder > minPendingOrder) {
      return res.json({
        success: true,
        data: { document, signer, status: 'waiting_turn', fields: [] },
      });
    }
  }

  // 5. Get this signer's fields
  const fields = await SignatureField.findAll({
    where: { documentId: document.id, signerId: signer.id },
    order: [['page', 'ASC'], ['y', 'ASC']],
  });

  // 6. Mark as viewed if first visit
  if (signer.status === 'pending') {
    await signer.update({ status: 'viewed', viewedAt: new Date(), ipAddress: req.ip, userAgent: req.get('User-Agent') });
    await logAudit(document.id, 'document_viewed', {
      signerId: signer.id,
      description: `${signer.name} viewed the document`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // 7. Return document file URL for PDF rendering
  const documentUrl = `${process.env.APP_URL}/api/sign/${token}/file`;

  res.json({
    success: true,
    data: {
      document: {
        id: document.id,
        title: document.title,
        message: document.message,
        status: document.status,
        signers: document.signers,
        pageCount: document.pageCount,
      },
      signer,
      fields,
      documentUrl,
      status: 'ready',
    },
  });
});

// ── SERVE PDF FILE ────────────────────────────────────────────────────────────
exports.getDocumentFile = asyncHandler(async (req, res) => {
  const signer = await Signer.findOne({ where: { accessToken: req.params.token } });
  if (!signer) throw new ApiError(403, 'Unauthorized.');

  const document = await Document.findByPk(signer.documentId);
  if (!document) throw new ApiError(404, 'File not found.');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(require('path').resolve(document.filePath));
});

// ── SUBMIT SIGNATURES ─────────────────────────────────────────────────────────
exports.submitSignatures = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { fields: submittedFields } = req.body;

  if (!submittedFields || submittedFields.length === 0) {
    throw new ApiError(400, 'No field data submitted.');
  }

  // 1. Validate token + signer
  const signer = await Signer.findOne({ where: { accessToken: token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link.');
  if (signer.status === 'signed') throw new ApiError(400, 'You have already signed this document.');
  if (signer.status === 'declined') throw new ApiError(400, 'You have declined this document.');

  const document = await Document.findByPk(signer.documentId);
  if (!document) throw new ApiError(404, 'Document not found.');
  if (['completed', 'voided', 'cancelled'].includes(document.status)) {
    throw new ApiError(400, `Document is ${document.status} and cannot be signed.`);
  }

  // 2. Validate all required fields are filled
  const dbFields = await SignatureField.findAll({ where: { documentId: document.id, signerId: signer.id } });
  const requiredFields = dbFields.filter((f) => f.required);
  const submittedMap = new Map(submittedFields.map((f) => [f.id, f]));

  const missingRequired = requiredFields.filter((f) => {
    const submitted = submittedMap.get(f.id);
    return !submitted || (!submitted.value && !submitted.signatureData);
  });

  if (missingRequired.length > 0) {
    throw new ApiError(422, `${missingRequired.length} required field(s) are incomplete.`, 
      missingRequired.map(f => ({ fieldId: f.id, type: f.type, page: f.page }))
    );
  }

  // 3. Save each field's value
  await Promise.all(
    submittedFields.map(async (submittedField) => {
      const dbField = dbFields.find((f) => f.id === submittedField.id);
      if (!dbField) return;

      await dbField.update({
        value: submittedField.value || null,
        signatureData: submittedField.signatureData || null,
        filledAt: new Date(),
      });

      await logAudit(document.id, 'field_filled', {
        signerId: signer.id,
        description: `${signer.name} filled ${dbField.type} field`,
        metadata: { fieldId: dbField.id, page: dbField.page },
      });
    })
  );

  // 4. Mark signer as signed
  await signer.update({
    status: 'signed',
    signedAt: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // 5. Update document to in_progress if needed
  if (document.status === 'pending') {
    await document.update({ status: 'in_progress' });
  }

  await logAudit(document.id, 'document_signed', {
    signerId: signer.id,
    description: `${signer.name} <${signer.email}> signed the document`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // 6. Check if all done
  const isComplete = await checkDocumentCompletion(document);

  res.json({
    success: true,
    message: isComplete
      ? 'Document fully signed! All parties have been notified.'
      : 'Your signature has been recorded. Thank you!',
    data: { isComplete },
  });
});

// ── DECLINE TO SIGN ───────────────────────────────────────────────────────────
exports.declineSignature = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { reason } = req.body;

  const signer = await Signer.findOne({ where: { accessToken: token } });
  if (!signer) throw new ApiError(404, 'Invalid signing link.');
  if (signer.status === 'signed') throw new ApiError(400, 'You have already signed this document.');

  await signer.update({
    status: 'declined',
    declinedAt: new Date(),
    declineReason: reason || 'No reason provided',
  });

  const document = await Document.findByPk(signer.documentId);
  await document.update({ status: 'declined' });

  await logAudit(document.id, 'document_declined', {
    signerId: signer.id,
    description: `${signer.name} declined: ${reason || 'No reason given'}`,
    ipAddress: req.ip,
  });

  // Notify owner
  const owner = await User.findByPk(document.ownerId);
  // (simplified – in production send a "declined" email template)
  console.log(`Owner ${owner.email} should be notified that ${signer.name} declined.`);

  res.json({ success: true, message: 'Document declined.' });
});