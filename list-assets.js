const mongoose = require('mongoose');
const Machine = require('./models/machine');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/assetManagement', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    try {
        const machines = await Machine.find({});
        console.log('\nAll Assets in Database:');
        console.log('=====================\n');
        
        machines.forEach((machine, index) => {
            console.log(`Asset ${index + 1}:`);
            console.log('-------------------');
            console.log(`Serial Number: ${machine.serialNumber}`);
            console.log(`Model Name: ${machine.modelName}`);
            console.log(`Manufacturer: ${machine.manufacturer}`);
            console.log(`Company: ${machine.company}`);
            console.log(`Location: ${machine.location}`);
            console.log(`Tag Number: ${machine.newTagNumber}`);
            console.log(`Username: ${machine.username}`);
            console.log(`Status: ${machine.operationalStatus}`);
            console.log('-------------------\n');
        });

        console.log(`Total Assets: ${machines.length}`);
        mongoose.connection.close();
    } catch (error) {
        console.error('Error fetching machines:', error);
        mongoose.connection.close();
    }
})
.catch(err => {
    console.error('MongoDB connection error:', err);
}); 