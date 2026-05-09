const User = require('./User');
const Document = require('./Document');
const { Signer, SignatureField, AuditLog } = require('./Signer');

// User ↔ Document
User.hasMany(Document, { foreignKey: 'ownerId', as: 'documents' });
Document.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Document ↔ Signer
Document.hasMany(Signer, { foreignKey: 'documentId', as: 'signers', onDelete: 'CASCADE' });
Signer.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

// User ↔ Signer
User.hasMany(Signer, { foreignKey: 'userId', as: 'signerRoles' });
Signer.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Document ↔ SignatureField
Document.hasMany(SignatureField, { foreignKey: 'documentId', as: 'fields', onDelete: 'CASCADE' });
SignatureField.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

// Signer ↔ SignatureField
Signer.hasMany(SignatureField, { foreignKey: 'signerId', as: 'fields', onDelete: 'CASCADE' });
SignatureField.belongsTo(Signer, { foreignKey: 'signerId', as: 'signer' });

// Document ↔ AuditLog
Document.hasMany(AuditLog, { foreignKey: 'documentId', as: 'auditLogs', onDelete: 'CASCADE' });
AuditLog.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

module.exports = { User, Document, Signer, SignatureField, AuditLog };