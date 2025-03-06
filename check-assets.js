const mongoose = require('mongoose');
const Machine = require('./models/machine');
const AssetType = require('./models/assetType');

async function checkAssets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/assetManagement');
    console.log('Connected to MongoDB');

    // Check asset types
    const assetTypes = await AssetType.find();
    console.log('\nAsset Types:', assetTypes.length);
    console.log('Asset Types List:', assetTypes.map(type => type.name));

    // Check machines/assets
    const machines = await Machine.find();
    console.log('\nTotal Assets:', machines.length);
    
    if (machines.length > 0) {
      console.log('\nSample Asset:');
      console.log(JSON.stringify(machines[0], null, 2));
    }

    // Check assets by company
    const companies = ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services'];
    console.log('\nAssets by Company:');
    for (const company of companies) {
      const count = await Machine.countDocuments({ company });
      console.log(`${company}: ${count} assets`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAssets(); 