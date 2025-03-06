const mongoose = require('mongoose');
const Machine = require('./models/machine');
const AssetType = require('./models/assetType');

async function createSampleAssets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/assetManagement');
    console.log('Connected to MongoDB');

    // Get asset types
    const assetTypes = await AssetType.find();
    if (assetTypes.length === 0) {
      console.log('No asset types found. Please run the application first to create initial asset types.');
      process.exit(1);
    }

    // Sample assets data
    const sampleAssets = [
      {
        assetType: assetTypes[0]._id, // Laptop
        serialNumber: 'LAP-001',
        modelName: 'ThinkPad X1 Carbon',
        manufacturer: 'Lenovo',
        company: 'Jubilee Health',
        emailAddress: 'john.doe@jubilee.com',
        newTagNumber: 'NT-001',
        oldTagNumber: 'OT-001',
        username: 'john.doe',
        supplier: 'Lenovo Kenya',
        amount: 150000,
        invoiceNumber: 'INV-001',
        formerUser: 'None',
        purchaseDate: new Date('2024-01-15'),
        location: 'Nairobi Office',
        operationalStatus: 'Operational',
        assetState: 'Active',
        dynamicAttributes: {
          'Processor': 'Intel i7 12th Gen',
          'RAM': '16GB',
          'Storage': '512GB SSD',
          'Operating System': 'Windows 11',
          'Warranty Expiry': new Date('2027-01-15')
        }
      },
      {
        assetType: assetTypes[1]._id, // Printer
        serialNumber: 'PRT-001',
        modelName: 'HP LaserJet Pro',
        manufacturer: 'HP',
        company: 'Jubilee Life',
        emailAddress: 'jane.smith@jubilee.com',
        newTagNumber: 'NT-002',
        oldTagNumber: 'OT-002',
        username: 'jane.smith',
        supplier: 'HP Kenya',
        amount: 80000,
        invoiceNumber: 'INV-002',
        formerUser: 'None',
        purchaseDate: new Date('2024-02-01'),
        location: 'Mombasa Office',
        operationalStatus: 'Operational',
        assetState: 'Active',
        dynamicAttributes: {
          'Type': 'Laser',
          'Network Capable': 'Yes',
          'Max Paper Size': 'A4',
          'Color Support': 'Monochrome'
        }
      },
      {
        assetType: assetTypes[2]._id, // Software License
        serialNumber: 'SW-001',
        modelName: 'Microsoft Office 365',
        manufacturer: 'Microsoft',
        company: 'Jubilee Holdings',
        emailAddress: 'admin@jubilee.com',
        newTagNumber: 'NT-003',
        oldTagNumber: 'OT-003',
        username: 'admin',
        supplier: 'Microsoft Kenya',
        amount: 500000,
        invoiceNumber: 'INV-003',
        formerUser: 'None',
        purchaseDate: new Date('2024-01-01'),
        location: 'All Offices',
        operationalStatus: 'Operational',
        assetState: 'Active',
        dynamicAttributes: {
          'License Type': 'Subscription',
          'Expiry Date': new Date('2025-01-01'),
          'Number of Users': 100,
          'Version': 'Office 365'
        }
      }
    ];

    // Insert sample assets
    await Machine.insertMany(sampleAssets);
    console.log('Sample assets created successfully');
    console.log('Created 3 sample assets across different companies');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createSampleAssets(); 