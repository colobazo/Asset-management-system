const excel = require('exceljs');
const path = require('path');

async function createTemplate() {
  const workbook = new excel.Workbook();
  const worksheet = workbook.addWorksheet('Asset Template');

  // Define columns
  worksheet.columns = [
    { header: 'Serial Number', key: 'serialNumber', width: 15 },
    { header: 'Model Name', key: 'modelName', width: 20 },
    { header: 'Manufacturer', key: 'manufacturer', width: 15 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Email Address', key: 'emailAddress', width: 25 },
    { header: 'New Tag Number', key: 'newTagNumber', width: 15 },
    { header: 'Old Tag Number', key: 'oldTagNumber', width: 15 },
    { header: 'Username', key: 'username', width: 15 },
    { header: 'Supplier', key: 'supplier', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Invoice Number', key: 'invoiceNumber', width: 15 },
    { header: 'Former User', key: 'formerUser', width: 15 },
    { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Operational Status', key: 'operationalStatus', width: 15 },
    { header: 'Asset State', key: 'assetState', width: 15 }
  ];

  // Add sample row
  worksheet.addRow({
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
    purchaseDate: '2024-01-15',
    location: 'Nairobi Office',
    operationalStatus: 'Operational',
    assetState: 'Active'
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Save the template
  const templatePath = path.join(__dirname, 'public', 'templates', 'asset-template.xlsx');
  await workbook.xlsx.writeFile(templatePath);
  console.log('Template created successfully at:', templatePath);
}

createTemplate().catch(console.error); 