// models/Machine.js
const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  assetType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssetType',
    required: true
  },
  serialNumber: {
    type: String,
    required: true,
    unique: true
  },
  modelName: {
    type: String,
    required: true
  },
  manufacturer: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true,
    enum: ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services']
  },
  emailAddress: String,
  newTagNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  oldTagNumber: String,
  username: String,
  supplier: String,
  amount: Number,
  invoiceNumber: String,
  formerUser: String,
  purchaseDate: Date,
  location: {
    type: String,
    required: true
  },
  operationalStatus: {
    type: String,
    enum: ['Operational', 'Under Maintenance', 'Repair Needed', 'Retired'],
    default: 'Operational'
  },
  assetState: {
    type: String,
    enum: ['Active', 'Inactive', 'Disposed'],
    default: 'Active'
  },
  imagePath: String,
  dynamicAttributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
machineSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Machine', machineSchema);
