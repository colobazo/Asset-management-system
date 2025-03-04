const mongoose = require('mongoose');

const assetTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  attributes: [{
    name: String,
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select'],
      default: 'text'
    },
    required: Boolean,
    options: [String], // For select type fields
    defaultValue: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
assetTypeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('AssetType', assetTypeSchema); 