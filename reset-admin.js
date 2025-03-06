const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function resetAdminPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/assetManagement');
    console.log('Connected to MongoDB');

    // Reset admin password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.findOneAndUpdate(
      { username: 'admin' },
      { password: hashedPassword }
    );

    console.log('Admin password reset successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAdminPassword(); 