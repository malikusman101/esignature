const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: { notEmpty: true },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  originalFilename: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  storedFilename: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING(1000),
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  pageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  status: {
    type: DataTypes.ENUM(
      'draft',
      'pending',
      'in_progress',
      'completed',
      'declined',
      'expired',
      'cancelled',
      'voided'
    ),
    defaultValue: 'draft',
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  signedFilePath: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  auditTrailPath: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reminderSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  voidedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  voidReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isTemplate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  signOrder: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'If true, signers must sign in order',
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'documents',
  indexes: [
    { fields: ['owner_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
});

module.exports = Document;