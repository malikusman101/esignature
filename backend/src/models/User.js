const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  firstName: { type: DataTypes.STRING(100), allowNull: false },
  lastName: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.STRING(20), defaultValue: 'user' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  verificationToken: { type: DataTypes.STRING(255), allowNull: true },
  resetPasswordToken: { type: DataTypes.STRING(255), allowNull: true },
  resetPasswordExpires: { type: DataTypes.DATE, allowNull: true },
  refreshToken: { type: DataTypes.TEXT, allowNull: true },
  signatureData: { type: DataTypes.TEXT, allowNull: true },
  initials: { type: DataTypes.TEXT, allowNull: true },
  avatarUrl: { type: DataTypes.STRING(500), allowNull: true },
  timezone: { type: DataTypes.STRING(100), defaultValue: 'UTC' },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  plan: { type: DataTypes.STRING(30), defaultValue: 'free' },
  documentsUsed: { type: DataTypes.INTEGER, defaultValue: 0 },
  documentsLimit: { type: DataTypes.INTEGER, defaultValue: 5 },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => { if (user.password) user.password = await bcrypt.hash(user.password, 12); },
    beforeUpdate: async (user) => { if (user.changed('password')) user.password = await bcrypt.hash(user.password, 12); },
  },
});

User.prototype.comparePassword = async function(p) { return bcrypt.compare(p, this.password); };
User.prototype.toJSON = function() {
  const v = { ...this.get() };
  delete v.password; delete v.verificationToken;
  delete v.resetPasswordToken; delete v.refreshToken;
  return v;
};

module.exports = User;
