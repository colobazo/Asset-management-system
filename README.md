# Jubilee Asset Management System

A comprehensive web-based asset management system built with Node.js, Express, and MongoDB. This system allows organizations to track and manage their assets, including machines, equipment, and other resources across different companies.

## Features

- **Asset Management**
  - Add, edit, and delete assets
  - Track asset details including serial numbers, tag numbers, and operational status
  - Upload and store asset images
  - Categorize assets by type with dynamic attributes
  - Track asset location and assignment

- **Company Management**
  - Organize assets by company
  - View company-specific asset statistics
  - Filter and search assets within companies

- **Search Capabilities**
  - Global search across all assets
  - Search by serial number, tag number, or username
  - Real-time search results

- **User-Friendly Interface**
  - Responsive design
  - Intuitive navigation
  - Success and error notifications
  - Clean and organized forms

## Prerequisites

Before running this application, make sure you have the following installed:
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/colobazo/Asset-management-system.git
cd Asset-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=mongodb://localhost:27017/asset-management
PORT=3000
```

4. Create required directories:
```bash
mkdir -p public/uploads
```

## Running the Application

1. Start MongoDB service on your machine

2. Start the application:
```bash
npm start
```

3. Access the application in your browser:
```
http://localhost:3000
```

## Project Structure

```
asset-management-system/
├── models/              # Database models
├── public/             # Static files
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   └── uploads/       # Asset images
├── routes/            # Route handlers
├── views/             # EJS templates
│   └── partials/     # Reusable template parts
├── app.js            # Application entry point
├── package.json      # Project dependencies
└── .env              # Environment variables
```

## Usage

1. **Adding a New Asset**
   - Click "Add Asset" button
   - Fill in required fields (marked with *)
   - Optionally select an asset type for additional fields
   - Upload an asset image if needed
   - Submit the form

2. **Searching Assets**
   - Use the search box at the top of the dashboard
   - Enter serial number, tag number, or username
   - Results will update automatically

3. **Managing Companies**
   - View company-specific assets from the dashboard
   - Use company filters to narrow down asset lists
   - View company statistics and metrics

## Contributing

1. Fork the repository
2. Create a new branch for your feature
3. Commit your changes
4. Push to your branch
5. Create a Pull Request

## Troubleshooting

**MongoDB Connection Issues**
- Ensure MongoDB service is running
- Verify connection string in `.env` file
- Check MongoDB logs for errors

**Image Upload Issues**
- Verify `public/uploads` directory exists and has write permissions
- Check file size limits in your code
- Ensure proper file types are being uploaded

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
