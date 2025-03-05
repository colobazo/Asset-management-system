// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const fs = require('fs');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const { authenticateToken, isAdmin, isLoggedIn } = require('./middleware/auth');
const User = require('./models/User');
const excel = require('exceljs');

const app = express();
const port = 3001;

// Retrieve MongoDB URI from environment variables or use a default for local development
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/assetManagement';

// Connect to MongoDB
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Import the Machine model
const Machine = require('./models/machine');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (file.fieldname === 'machineImage') {
      cb(null, 'public/uploads/');
    } else if (file.fieldname === 'excelFile') {
      cb(null, 'public/uploads/excel/');
    }
  },
  filename: function(req, file, cb) {
    if (file.fieldname === 'excelFile') {
      cb(null, 'import-' + Date.now() + path.extname(file.originalname));
    } else {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB max file size
  fileFilter: function(req, file, cb) {
    if (file.fieldname === 'machineImage') {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
      }
    } else if (file.fieldname === 'excelFile') {
      if (!file.originalname.match(/\.(xlsx|xls)$/)) {
        return cb(new Error('Only Excel files are allowed!'), false);
      }
    }
    cb(null, true);
  }
});

// Ensure uploads directories exist
if (!fs.existsSync('./public/uploads')) {
  fs.mkdirSync('./public/uploads', { recursive: true });
}
if (!fs.existsSync('./public/uploads/excel')) {
  fs.mkdirSync('./public/uploads/excel', { recursive: true });
}

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');

// Authentication middleware
app.use(async (req, res, next) => {
  if (req.cookies.token) {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      res.clearCookie('token');
    }
  }
  next();
});

// Add user data to all views
app.use((req, res, next) => {
  res.locals.user = req.user ? {
    username: req.user.username,
    fullName: req.user.fullName,
    role: req.user.role
  } : null;
  next();
});

// Login routes (unprotected)
app.get('/login', isLoggedIn, (req, res) => {
  res.render('login', { error: null, layout: false });
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.render('login', { error: 'Invalid username or password', layout: false });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create JWT token with user role
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login', layout: false });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// Protect all routes after this middleware
app.use(authenticateToken);

// Home route - fetch and display all machines from MongoDB
app.get('/', async (req, res) => {
  try {
    const companies = ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services'];
    const companyStats = {};

    // Get company statistics
    for (const company of companies) {
      const companyMachines = await Machine.find({
        company: { 
          $regex: new RegExp('^' + company + '$', 'i')
        }
      });
      
      companyStats[company] = {
        totalAssets: companyMachines.length
      };
    }

    res.render('index', { 
      selectedCompany: null,
      companyStats,
      query: '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error("Error fetching machines:", err);
    res.status(500).send(err.message);
  }
});

// Search route using a single search box across multiple fields
app.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.redirect('/');
  }
  try {
    const regex = new RegExp(query, 'i');
    const filteredMachines = await Machine.find({
      $or: [
        { serialNumber: regex },
        { newTagNumber: regex },
        { oldTagNumber: regex },
        { username: regex }
      ]
    }).populate('assetType');

    // Get company statistics for the sidebar
    const companies = ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services'];
    const companyStats = {};

    for (const company of companies) {
      const companyMachines = await Machine.find({ 
        company: { $regex: new RegExp('^' + company + '$', 'i') }
      });
      
      companyStats[company] = {
        totalAssets: companyMachines.length
      };
    }

    // Get asset type statistics for search results
    const assetTypes = await AssetType.find().sort('name');
    const assetTypeStats = await Promise.all(assetTypes.map(async (type) => {
      const total = await Machine.countDocuments({ 
        assetType: type._id,
        $or: [
          { serialNumber: regex },
          { newTagNumber: regex },
          { oldTagNumber: regex },
          { username: regex }
        ]
      });
      const active = await Machine.countDocuments({ 
        assetType: type._id,
        operationalStatus: 'Operational',
        $or: [
          { serialNumber: regex },
          { newTagNumber: regex },
          { oldTagNumber: regex },
          { username: regex }
        ]
      });
      const maintenance = await Machine.countDocuments({
        assetType: type._id,
        operationalStatus: { $in: ['Under Maintenance', 'Repair Needed'] },
        $or: [
          { serialNumber: regex },
          { newTagNumber: regex },
          { oldTagNumber: regex },
          { username: regex }
        ]
      });

      return {
        id: type._id,
        name: type.name,
        total,
        active,
        maintenance
      };
    }));

    // Filter out asset types with no matching assets
    const activeAssetTypes = assetTypeStats.filter(stat => stat.total > 0);

    res.render('index', { 
      selectedCompany: `Search Results for "${query}"`,
      filteredMachines,
      assetTypeStats: activeAssetTypes,
      companyStats,
      query,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error("Error during search:", err);
    res.status(500).render('error', { error: 'An error occurred during search' });
  }
});

// Display add-machine form
app.get('/add', async (req, res) => {
  try {
    const assetTypes = await AssetType.find().sort('name');
    res.render('add-machine', { assetTypes, activeTab: 'add' });
  } catch (error) {
    console.error('Error fetching asset types:', error);
    res.status(500).render('error', { error: 'Failed to load add machine form' });
  }
});

// POST route to add a new machine using the Machine model
app.post('/add', isAdmin, upload.single('machineImage'), async (req, res) => {
  try {
    // Convert dynamicAttributes object to Map
    const dynamicAttributesMap = new Map();
    if (req.body.dynamicAttributes) {
      const attributes = typeof req.body.dynamicAttributes === 'string' 
        ? JSON.parse(req.body.dynamicAttributes) 
        : req.body.dynamicAttributes;
      
      Object.entries(attributes).forEach(([key, value]) => {
        dynamicAttributesMap.set(key, value);
      });
    }

    const newMachine = new Machine({
      assetType: req.body.assetType || null,
      serialNumber: req.body.serialNumber,
      modelName: req.body.modelName,
      manufacturer: req.body.manufacturer,
      company: req.body.company,
      emailAddress: req.body.emailAddress,
      newTagNumber: req.body.newTagNumber,
      oldTagNumber: req.body.oldTagNumber,
      username: req.body.username,
      supplier: req.body.supplier,
      amount: req.body.amount,
      invoiceNumber: req.body.invoiceNumber,
      formerUser: req.body.formerUser,
      purchaseDate: req.body.purchaseDate,
      location: req.body.location,
      operationalStatus: req.body.operationalStatus || 'Operational',
      assetState: req.body.assetState || 'Active',
      imagePath: req.file ? '/uploads/' + req.file.filename : null,
      dynamicAttributes: dynamicAttributesMap
    });

    await newMachine.save();
    
    // Set content type to JSON
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, message: 'Asset added successfully' });
  } catch (error) {
    console.error('Error saving machine:', error);
    
    // Set content type to JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const keyPattern = error.keyPattern;
      let errorMessage = '';
      
      if (keyPattern.serialNumber) {
        errorMessage = 'This Serial Number already exists in the system. Please use a different Serial Number.';
      } else if (keyPattern.newTagNumber) {
        errorMessage = 'This Tag Number already exists in the system. Please use a different Tag Number.';
      } else {
        errorMessage = 'A duplicate record was found. Please check your input and try again.';
      }
      
      return res.status(400).json({ error: errorMessage });
    }
    
    // Handle other errors
    res.status(500).json({ 
      error: 'An error occurred while saving the asset. Please try again.',
      details: error.message
    });
  }
});

// View a single machine (by MongoDB document ID)
app.get('/view/:id', async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).send('Machine not found');
    }
    res.render('view-machine', { machine });
  } catch (err) {
    console.error("Error retrieving machine:", err);
    res.status(500).send(err.message);
  }
});

// GET route to display edit form
app.get('/edit/:id', async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).send('Machine not found');
    }
    res.render('edit-machine', { machine });
  } catch (err) {
    console.error("Error retrieving machine for edit:", err);
    res.status(500).send(err.message);
  }
});

// POST route to update machine
app.post('/edit/:id', isAdmin, upload.single('machineImage'), async (req, res) => {
  try {
    const updateData = {
      serialNumber: req.body.serialNumber,
      modelName: req.body.modelName,
      manufacturer: req.body.manufacturer,
      company: req.body.company,
      emailAddress: req.body.emailAddress,
      newTagNumber: req.body.newTagNumber,
      oldTagNumber: req.body.oldTagNumber,
      username: req.body.username,
      supplier: req.body.supplier,
      amount: req.body.amount,
      invoiceNumber: req.body.invoiceNumber,
      formerUser: req.body.formerUser,
      purchaseDate: req.body.purchaseDate,
      location: req.body.location,
      operationalStatus: req.body.operationalStatus,
      assetState: req.body.assetState
    };

    // Only update image if a new one is uploaded
    if (req.file) {
      updateData.imagePath = '/uploads/' + req.file.filename;
      
      // Delete old image if it exists
      const oldMachine = await Machine.findById(req.params.id);
      if (oldMachine.imagePath) {
        const oldImagePath = path.join(__dirname, 'public', oldMachine.imagePath);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    const machine = await Machine.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!machine) {
      return res.status(404).send('Machine not found');
    }

    res.redirect(`/view/${machine._id}`);
  } catch (err) {
    console.error("Error updating machine:", err);
    res.status(500).send(err.message);
  }
});

// Test route to verify MongoDB connection using the Machine model
app.get('/testMachine', async (req, res) => {
  try {
    // Create a new machine with unique serial number
    const testMachine = new Machine({
      serialNumber: 'SN-' + Date.now(),
      modelName: 'Test Model',
      manufacturer: 'Test Manufacturer',
      purchaseDate: new Date(),
      location: 'Test Location',
      status: 'Active',
      imagePath: '/uploads/test.jpg',
      company: 'Other',
      emailAddress: 'test@example.com',
      newTagNumber: 'NT' + Date.now(),
      oldTagNumber: 'OT' + Date.now(),
      username: 'testuser',
      supplier: 'Test Supplier',
      amount: 100,
      invoiceNumber: 'INV-' + Date.now(),
      formerUser: 'TestFormerUser'
    });
    await testMachine.save();
    // Fetch all machines from the database
    const machines = await Machine.find({});
    res.json(machines);
  } catch (error) {
    console.error("Error in /testMachine:", error);
    res.status(500).json({ error: error.message });
  }
});

// Company-specific routes
app.get('/all-machines', async (req, res) => {
  try {
    const machines = await Machine.find({});
    const companies = ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services'];
    const companyStats = {};

    for (const company of companies) {
      const companyMachines = await Machine.find({ company });
      companyStats[company] = {
        totalAssets: companyMachines.length,
        percentageChange: {
          'Jubilee Health': 12,
          'Jubilee Life': 8,
          'JAML': -5,
          'Jubilee Holdings': 15,
          'Jubilee Shared Services': -3
        }[company]
      };
    }

    res.render('index', { 
      machines,
      filteredMachines: machines,
      query: '',
      selectedCompany: 'All Machines',
      companyStats
    });
  } catch (err) {
    console.error("Error fetching all machines:", err);
    res.status(500).send(err.message);
  }
});

app.get('/company/:companySlug', async (req, res) => {
  try {
    const companyMap = {
      'jubilee-health': 'Jubilee Health',
      'jubilee-life': 'Jubilee Life',
      'jaml': 'JAML',
      'jubilee-holdings': 'Jubilee Holdings',
      'jubilee-shared-services': 'Jubilee Shared Services'
    };

    const companyName = companyMap[req.params.companySlug];
    if (!companyName) {
      return res.status(404).send('Company not found');
    }

    // Get all machines for this company
    const filteredMachines = await Machine.find({
      company: { 
        $regex: new RegExp('^' + companyName + '$', 'i')
      }
    }).populate('assetType');

    // Get asset type statistics for this company
    const assetTypes = await AssetType.find().sort('name');
    const assetTypeStats = await Promise.all(assetTypes.map(async (type) => {
      const total = await Machine.countDocuments({ 
        assetType: type._id,
        company: { $regex: new RegExp('^' + companyName + '$', 'i') }
      });
      const active = await Machine.countDocuments({ 
        assetType: type._id,
        company: { $regex: new RegExp('^' + companyName + '$', 'i') },
        operationalStatus: 'Operational'
      });
      const maintenance = await Machine.countDocuments({
        assetType: type._id,
        company: { $regex: new RegExp('^' + companyName + '$', 'i') },
        operationalStatus: { $in: ['Under Maintenance', 'Repair Needed'] }
      });

      return {
        id: type._id,
        name: type.name,
        total,
        active,
        maintenance
      };
    }));

    // Filter out asset types with no assets
    const activeAssetTypes = assetTypeStats.filter(stat => stat.total > 0);

    // Get company statistics for the sidebar
    const companies = ['Jubilee Health', 'Jubilee Life', 'JAML', 'Jubilee Holdings', 'Jubilee Shared Services'];
    const companyStats = {};

    for (const company of companies) {
      const companyMachines = await Machine.find({
        company: { 
          $regex: new RegExp('^' + company + '$', 'i')
        }
      });
      
      companyStats[company] = {
        totalAssets: companyMachines.length
      };
    }

    res.render('index', { 
      selectedCompany: companyName,
      filteredMachines,
      assetTypeStats: activeAssetTypes,
      companyStats,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error("Error fetching company machines:", err);
    res.status(500).send(err.message);
  }
});

// Excel upload routes
app.get('/upload-excel', (req, res) => {
  res.render('upload-excel');
});

app.post('/preview-excel', upload.single('excelFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Remove the uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Extract headers and data
    const headers = data[0];
    const rows = data.slice(1);

    res.json({
      headers,
      rows,
      totalRows: rows.length
    });
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).json({ error: 'Error processing Excel file' });
  }
});

app.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Process each row and create machine records
    const results = {
      success: 0,
      errors: []
    };

    for (const row of data) {
      try {
        const machineData = {
          serialNumber: row['Serial Number'],
          modelName: row['Model Name'],
          manufacturer: row['Manufacturer'],
          company: row['Company'],
          emailAddress: row['Email Address'],
          newTagNumber: row['New Tag Number'],
          oldTagNumber: row['Old Tag Number'],
          username: row['Username'],
          supplier: row['Supplier'],
          amount: row['Amount'],
          invoiceNumber: row['Invoice Number'],
          formerUser: row['Former User'],
          purchaseDate: row['Purchase Date'],
          location: row['Location'],
          operationalStatus: row['Operational Status'] || 'Operational',
          assetState: row['Asset State'] || 'Active'
        };

        // Validate required fields
        if (!machineData.serialNumber || !machineData.modelName || 
            !machineData.manufacturer || !machineData.company || 
            !machineData.location) {
          throw new Error('Missing required fields');
        }

        await Machine.create(machineData);
        results.success++;
      } catch (error) {
        results.errors.push({
          row: row['Serial Number'] || 'Unknown',
          error: error.message
        });
      }
    }

    // Remove the uploaded file after processing
    fs.unlinkSync(req.file.path);

    // Redirect with status message
    const message = `Successfully imported ${results.success} machines. ` +
                   `${results.errors.length} errors occurred.`;
    res.redirect(`/?message=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Error processing Excel file:', error);
    res.status(500).send('Error processing Excel file');
  }
});

app.get('/check-serial/:serialNumber', async (req, res) => {
  try {
    const serialNumber = req.params.serialNumber;
    const machine = await Machine.findOne({ 
      $or: [
        { serialNumber: { $regex: new RegExp('^' + serialNumber + '$', 'i') } },
        { newTagNumber: { $regex: new RegExp('^' + serialNumber + '$', 'i') } }
      ]
    });
    res.json({ exists: !!machine });
  } catch (err) {
    console.error("Error checking serial number:", err);
    res.status(500).json({ error: err.message });
  }
});

// User management routes
app.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort('username');
    res.render('users', { users, activeTab: 'users' });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('error', { error: 'Error fetching users' });
  }
});

app.get('/users/add', authenticateToken, isAdmin, (req, res) => {
  res.render('add-user', { error: null, activeTab: 'users' });
});

app.post('/users/add', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { username, password, fullName, email, company, role } = req.body;

    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.render('add-user', { 
        error: 'Username or email already exists',
        activeTab: 'users'
      });
    }

    // Create new user
    const user = new User({
      username,
      password, // Will be hashed by the pre-save middleware
      fullName,
      email,
      company,
      role
    });

    await user.save();
    res.redirect('/users');
  } catch (error) {
    console.error('Error creating user:', error);
    res.render('add-user', { 
      error: 'Error creating user',
      activeTab: 'users'
    });
  }
});

app.get('/users/edit/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }
    res.render('edit-user', { user, error: null, activeTab: 'users' });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).render('error', { error: 'Error fetching user' });
  }
});

app.post('/users/edit/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { username, fullName, email, company, role } = req.body;
    const userId = req.params.id;

    // Check if username or email already exists for other users
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: userId } },
        { $or: [{ username }, { email }] }
      ]
    });

    if (existingUser) {
      const user = await User.findById(userId);
      return res.render('edit-user', {
        user,
        error: 'Username or email already exists',
        activeTab: 'users'
      });
    }

    const updateData = {
      username,
      fullName,
      email,
      company,
      role
    };

    // Only update password if provided
    if (req.body.password) {
      updateData.password = req.body.password;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }

    res.redirect('/users');
  } catch (error) {
    console.error('Error updating user:', error);
    const user = await User.findById(req.params.id);
    res.render('edit-user', {
      user,
      error: 'Error updating user',
      activeTab: 'users'
    });
  }
});

app.get('/users/delete/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).render('error', { error: 'User not found' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).render('error', { 
          error: 'Cannot delete the last admin user'
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.redirect('/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).render('error', { error: 'Error deleting user' });
  }
});

// Create initial admin user if none exists
async function createInitialAdmin() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        email: 'admin@jubilee.com',
        fullName: 'System Administrator',
        company: 'Jubilee Holdings'
      });
      console.log('Initial admin user created');
    }
  } catch (error) {
    console.error('Error creating initial admin:', error);
  }
}

// Create initial asset types if none exist
async function createInitialAssetTypes() {
  try {
    const assetTypesCount = await AssetType.countDocuments();
    if (assetTypesCount === 0) {
      const initialTypes = [
        {
          name: 'Laptop',
          description: 'Portable computers including notebooks and ultrabooks',
          attributes: [
            {
              name: 'Processor',
              type: 'text',
              required: true
            },
            {
              name: 'RAM',
              type: 'text',
              required: true
            },
            {
              name: 'Storage',
              type: 'text',
              required: true
            },
            {
              name: 'Operating System',
              type: 'select',
              required: true,
              options: ['Windows 10', 'Windows 11', 'macOS', 'Linux']
            },
            {
              name: 'Warranty Expiry',
              type: 'date',
              required: true
            }
          ]
        },
        {
          name: 'Printer',
          description: 'Network and local printers',
          attributes: [
            {
              name: 'Type',
              type: 'select',
              required: true,
              options: ['Laser', 'Inkjet', 'Multifunction']
            },
            {
              name: 'Network Capable',
              type: 'select',
              required: true,
              options: ['Yes', 'No']
            },
            {
              name: 'Max Paper Size',
              type: 'select',
              required: true,
              options: ['A4', 'A3', 'Legal']
            },
            {
              name: 'Color Support',
              type: 'select',
              required: true,
              options: ['Color', 'Monochrome']
            }
          ]
        },
        {
          name: 'Software License',
          description: 'Software applications and licenses',
          attributes: [
            {
              name: 'License Type',
              type: 'select',
              required: true,
              options: ['Perpetual', 'Subscription', 'Volume']
            },
            {
              name: 'Expiry Date',
              type: 'date',
              required: true
            },
            {
              name: 'Number of Users',
              type: 'number',
              required: true
            },
            {
              name: 'Version',
              type: 'text',
              required: true
            }
          ]
        },
        {
          name: 'Monitor',
          description: 'Display screens and monitors',
          attributes: [
            {
              name: 'Screen Size',
              type: 'text',
              required: true
            },
            {
              name: 'Resolution',
              type: 'text',
              required: true
            },
            {
              name: 'Panel Type',
              type: 'select',
              required: true,
              options: ['IPS', 'TN', 'VA', 'OLED']
            },
            {
              name: 'Ports',
              type: 'text',
              required: true
            }
          ]
        },
        {
          name: 'Tablet',
          description: 'Tablet devices including iPads and Android tablets',
          attributes: [
            {
              name: 'Operating System',
              type: 'select',
              required: true,
              options: ['iOS', 'Android', 'Windows']
            },
            {
              name: 'Storage Capacity',
              type: 'text',
              required: true
            },
            {
              name: 'Screen Size',
              type: 'text',
              required: true
            },
            {
              name: 'Cellular Support',
              type: 'select',
              required: true,
              options: ['Yes', 'No']
            },
            {
              name: 'Warranty Expiry',
              type: 'date',
              required: true
            }
          ]
        }
      ];

      for (const type of initialTypes) {
        await AssetType.create(type);
      }
      console.log('Initial asset types created');
    }
  } catch (error) {
    console.error('Error creating initial asset types:', error);
  }
}

// Call after database connection is established
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  createInitialAdmin();
  createInitialAssetTypes();
});

// Reports Routes
app.get('/reports', isAdmin, async (req, res) => {
  try {
    const totalMachines = await Machine.countDocuments();
    const activeMachines = await Machine.countDocuments({ operationalStatus: 'Operational' });
    const maintenanceMachines = await Machine.countDocuments({ operationalStatus: 'Under Maintenance' });
    const totalUsers = await User.countDocuments();

    res.render('reports', {
      activeTab: 'reports',
      totalMachines,
      activeMachines,
      maintenanceMachines,
      totalUsers
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).render('error', { error: 'Failed to load reports dashboard' });
  }
});

// Export all assets
app.get('/reports/export/assets', isAdmin, async (req, res) => {
  try {
    const machines = await Machine.find().sort({ company: 1, modelName: 1 });
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('All Assets');
    
    worksheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 15 },
      { header: 'Model Name', key: 'modelName', width: 20 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Tag Number', key: 'newTagNumber', width: 15 },
      { header: 'Status', key: 'operationalStatus', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 }
    ];

    machines.forEach(machine => {
      worksheet.addRow({
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        company: machine.company,
        username: machine.username,
        newTagNumber: machine.newTagNumber,
        operationalStatus: machine.operationalStatus,
        location: machine.location,
        purchaseDate: machine.purchaseDate ? new Date(machine.purchaseDate).toLocaleDateString() : ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=all-assets.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating assets report:', error);
    res.status(500).render('error', { error: 'Failed to generate assets report' });
  }
});

// Export assets by company
app.get('/reports/export/assets-by-company', isAdmin, async (req, res) => {
  try {
    const machines = await Machine.find().sort({ company: 1, modelName: 1 });
    
    const workbook = new excel.Workbook();
    
    // Group machines by company
    const companiesMap = machines.reduce((acc, machine) => {
      if (!acc[machine.company]) {
        acc[machine.company] = [];
      }
      acc[machine.company].push(machine);
      return acc;
    }, {});

    // Create worksheet for each company
    Object.entries(companiesMap).forEach(([company, companyMachines]) => {
      const worksheet = workbook.addWorksheet(company);
      
      worksheet.columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 15 },
        { header: 'Model Name', key: 'modelName', width: 20 },
        { header: 'Username', key: 'username', width: 15 },
        { header: 'Tag Number', key: 'newTagNumber', width: 15 },
        { header: 'Status', key: 'operationalStatus', width: 15 },
        { header: 'Location', key: 'location', width: 20 }
      ];

      companyMachines.forEach(machine => {
        worksheet.addRow({
          serialNumber: machine.serialNumber,
          modelName: machine.modelName,
          username: machine.username,
          newTagNumber: machine.newTagNumber,
          operationalStatus: machine.operationalStatus,
          location: machine.location
        });
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=assets-by-company.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating company assets report:', error);
    res.status(500).render('error', { error: 'Failed to generate company assets report' });
  }
});

// Export maintenance report
app.get('/reports/export/maintenance', isAdmin, async (req, res) => {
  try {
    const machines = await Machine.find({
      operationalStatus: { $in: ['Under Maintenance', 'Repair Needed'] }
    }).sort({ company: 1, operationalStatus: 1 });
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Maintenance Report');
    
    worksheet.columns = [
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Serial Number', key: 'serialNumber', width: 15 },
      { header: 'Model Name', key: 'modelName', width: 20 },
      { header: 'Status', key: 'operationalStatus', width: 15 },
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Location', key: 'location', width: 20 }
    ];

    machines.forEach(machine => {
      worksheet.addRow({
        company: machine.company,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        operationalStatus: machine.operationalStatus,
        username: machine.username,
        location: machine.location
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=maintenance-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating maintenance report:', error);
    res.status(500).render('error', { error: 'Failed to generate maintenance report' });
  }
});

// Export user list
app.get('/reports/export/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ company: 1, username: 1 });
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Users');
    
    worksheet.columns = [
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Full Name', key: 'fullName', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Role', key: 'role', width: 10 },
      { header: 'Last Login', key: 'lastLogin', width: 20 }
    ];

    users.forEach(user => {
      worksheet.addRow({
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        company: user.company,
        role: user.role,
        lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating users report:', error);
    res.status(500).render('error', { error: 'Failed to generate users report' });
  }
});

// Export user asset allocation
app.get('/reports/export/user-assets', isAdmin, async (req, res) => {
  try {
    const machines = await Machine.find({ username: { $exists: true, $ne: '' } })
      .sort({ company: 1, username: 1 });
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('User Assets');
    
    worksheet.columns = [
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Serial Number', key: 'serialNumber', width: 15 },
      { header: 'Model Name', key: 'modelName', width: 20 },
      { header: 'Tag Number', key: 'newTagNumber', width: 15 },
      { header: 'Status', key: 'operationalStatus', width: 15 }
    ];

    machines.forEach(machine => {
      worksheet.addRow({
        username: machine.username,
        company: machine.company,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        newTagNumber: machine.newTagNumber,
        operationalStatus: machine.operationalStatus
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=user-assets.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating user assets report:', error);
    res.status(500).render('error', { error: 'Failed to generate user assets report' });
  }
});

// Custom report
app.get('/reports/custom', isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const machines = await Machine.find({
      purchaseDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ purchaseDate: 1 });
    
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Custom Report');
    
    worksheet.columns = [
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Serial Number', key: 'serialNumber', width: 15 },
      { header: 'Model Name', key: 'modelName', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Username', key: 'username', width: 15 }
    ];

    machines.forEach(machine => {
      worksheet.addRow({
        purchaseDate: machine.purchaseDate ? new Date(machine.purchaseDate).toLocaleDateString() : '',
        company: machine.company,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        amount: machine.amount,
        username: machine.username
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=custom-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).render('error', { error: 'Failed to generate custom report' });
  }
});

// Asset Type Routes
const AssetType = require('./models/assetType');

app.get('/asset-types', isAdmin, async (req, res) => {
  try {
    const assetTypes = await AssetType.find().sort('name');
    res.render('asset-types', { assetTypes, activeTab: 'asset-types' });
  } catch (error) {
    console.error('Error fetching asset types:', error);
    res.status(500).render('error', { error: 'Failed to load asset types' });
  }
});

app.get('/asset-types/:id', isAdmin, async (req, res) => {
  try {
    const assetType = await AssetType.findById(req.params.id);
    if (!assetType) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    res.json(assetType);
  } catch (error) {
    console.error('Error fetching asset type:', error);
    res.status(500).json({ error: 'Failed to fetch asset type' });
  }
});

app.post('/asset-types', isAdmin, async (req, res) => {
  try {
    const { name, description, attributes } = req.body;
    const assetType = new AssetType({
      name,
      description,
      attributes
    });
    await assetType.save();
    res.json(assetType);
  } catch (error) {
    console.error('Error creating asset type:', error);
    res.status(500).json({ error: 'Failed to create asset type' });
  }
});

app.put('/asset-types/:id', isAdmin, async (req, res) => {
  try {
    const { name, description, attributes } = req.body;
    const assetType = await AssetType.findByIdAndUpdate(
      req.params.id,
      { name, description, attributes },
      { new: true, runValidators: true }
    );
    if (!assetType) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    res.json(assetType);
  } catch (error) {
    console.error('Error updating asset type:', error);
    res.status(500).json({ error: 'Failed to update asset type' });
  }
});

app.delete('/asset-types/:id', isAdmin, async (req, res) => {
  try {
    // Check if any assets are using this type
    const assetsCount = await Machine.countDocuments({ assetType: req.params.id });
    if (assetsCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete asset type while assets are using it' 
      });
    }

    const assetType = await AssetType.findByIdAndDelete(req.params.id);
    if (!assetType) {
      return res.status(404).json({ error: 'Asset type not found' });
    }
    res.json({ message: 'Asset type deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset type:', error);
    res.status(500).json({ error: 'Failed to delete asset type' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Asset Management System running at http://localhost:${port}`);
});
