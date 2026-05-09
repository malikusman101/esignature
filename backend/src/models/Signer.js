const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ─── Signer ──────────────────────────────────────────────────────────────────
const Signer = sequelize.define('Signer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'documents', key: 'id' },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: { isEmail: true },
  },
  role: {
    type: DataTypes.ENUM('signer', 'viewer', 'approver', 'cc'),
    defaultValue: 'signer',
  },
  status: {
    type: DataTypes.ENUM('pending', 'viewed', 'signed', 'declined', 'bounced'),
    defaultValue: 'pending',
  },
  signingOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  accessToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
    unique: true,
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  viewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  declinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  declineReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reminderCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastReminderAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  color: {
    type: DataTypes.STRING(20),
    defaultValue: '#3B82F6',
  },
}, { tableName: 'signers' });

// ─── SignatureField ───────────────────────────────────────────────────────────
const SignatureField = sequelize.define('SignatureField', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'documents', key: 'id' },
  },
  signerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'signers', key: 'id' },
  },
  type: {
    type: DataTypes.ENUM(
      'signature',
      'initials',
      'text',
      'date',
      'checkbox',
      'dropdown',
      'name',
      'email',
      'title',
      'company'
    ),
    allowNull: false,
  },
  page: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  x: { type: DataTypes.FLOAT, allowNull: false },
  y: { type: DataTypes.FLOAT, allowNull: false },
  width: { type: DataTypes.FLOAT, allowNull: false },
  height: { type: DataTypes.FLOAT, allowNull: false },
  required: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  label: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  placeholder: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  signatureData: {
    type: DataTypes.TEXT, // base64 image
    allowNull: true,
  },
  filledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  options: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  fontSize: {
    type: DataTypes.INTEGER,
    defaultValue: 14,
  },
  fontFamily: {
    type: DataTypes.STRING(100),
    defaultValue: 'Dancing Script',
  },
  color: {
    type: DataTypes.STRING(20),
    defaultValue: '#000000',
  },
}, { tableName: 'signature_fields' });

// ─── AuditLog ────────────────────────────────────────────────────────────────
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'documents', key: 'id' },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  signerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  action: {
    type: DataTypes.ENUM(
      'document_created',
      'document_sent',
      'document_viewed',
      'document_signed',
      'document_declined',
      'document_completed',
      'document_voided',
      'document_downloaded',
      'field_filled',
      'reminder_sent',
      'email_sent',
      'email_bounced',
      'access_granted',
      'access_revoked'
    ),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
});

module.exports = { Signer, SignatureField, AuditLog };