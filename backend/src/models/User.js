const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 100] },
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 100] },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  verificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  signatureData: {
    type: DataTypes.TEXT, // base64 stored signature
    allowNull: true,
  },
  initials: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  avatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  timezone: {
    type: DataTypes.STRING(100),
    defaultValue: 'UTC',
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  plan: {
    type: DataTypes.ENUM('free', 'professional', 'business', 'enterprise'),
    defaultValue: 'free',
  },
  documentsUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  documentsLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
}, {
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.verificationToken;
  delete values.resetPasswordToken;
  delete values.refreshToken;
  return values;
};

module.exports = User;