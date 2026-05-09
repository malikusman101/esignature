const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(500), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  originalFilename: { type: DataTypes.STRING(500), allowNull: false },
  storedFilename: { type: DataTypes.STRING(500), allowNull: false },
  filePath: { type: DataTypes.STRING(1000), allowNull: false },
  fileSize: { type: DataTypes.BIGINT, allowNull: false },
  mimeType: { type: DataTypes.STRING(100), allowNull: false },
  pageCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  status: { type: DataTypes.STRING(30), defaultValue: 'draft' },
  ownerId: { type: DataTypes.UUID, allowNull: false },
  signedFilePath: { type: DataTypes.STRING(1000), allowNull: true },
  auditTrailPath: { type: DataTypes.STRING(1000), allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  voidedAt: { type: DataTypes.DATE, allowNull: true },
  voidReason: { type: DataTypes.TEXT, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: true },
  isTemplate: { type: DataTypes.BOOLEAN, defaultValue: false },
  signOrder: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'documents' });

module.exports = Document;
