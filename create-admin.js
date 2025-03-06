const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createAdminUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/assetManagement');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (adminExists) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      email: 'admin@jubilee.com',
      fullName: 'System Administrator',
      company: 'Jubilee Holdings'
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdminUser(); 