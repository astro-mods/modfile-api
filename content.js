const express = require('express');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION, // Replace with your AWS region
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID, // Replace with your AWS access key ID
    secretAccessKey: process.env.ACCESS_KEY_SECRET // Replace with your AWS secret access key
  }
});

const bucketName = process.env.BUCKET_NAME;

const router = express.Router();

// Rate limiting configuration
const headLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 HEAD requests per minute
});

const downloadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 GET requests per minute
});

// HEAD route for retrieving file headers and metadata
router.head('/:uniqueId/:filename', headLimiter, (req, res) => {
  const { uniqueId, filename } = req.params;

  // Construct the S3 object key using the unique ID and filename
  const s3Key = `${uniqueId}/${filename}`;

  const headParams = {
    Bucket: bucketName,
    Key: s3Key  
  };

  s3.headObject(headParams, (err, data) => {
    if (err) {
      console.error('Error retrieving headers:', err);

      if (err.code === 'NoSuchKey') {
        return res.status(404).json({ error: 'File not found' });
      }

      return res.status(500).json({ error: 'Failed to retrieve headers', details: err.message });
    }

    console.log('Headers retrieved successfully!');
    res.setHeader('Content-Type', data.ContentType);
    res.setHeader('Content-Length', data.ContentLength);

    // Send the headers in the response
    return res.end();
  });
});


// GET route for downloading the file
router.get('/:uniqueId/:filename', downloadLimiter, (req, res) => {
  const { uniqueId, filename } = req.params;

  // Construct the S3 object key using the unique ID and filename
  const s3Key = `${uniqueId}/${filename}`;

  const downloadParams = {
    Bucket: bucketName,
    Key: s3Key
  };

  s3.getObject(downloadParams, (err, data) => {
    if (err) {
      console.error('Error downloading file:', err);

      if (err.code === 'NoSuchKey') {
        return res.status(404).json({ error: 'File not found' });
      }

      return res.status(500).json({ error: 'Failed to download file', details: err.message });
    }

    console.log('File downloaded successfully!');
    res.setHeader('Content-Type', data.ContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Calculate the MD5 hash of the file
    const md5Hash = crypto.createHash('md5').update(data.Body).digest('base64');
    res.setHeader('Content-MD5', md5Hash);

    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache the file for 1 hour (adjust the value as needed)
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()); // Expires header for 1 hour in the future

    // Send the file data in the response
    return res.send(data.Body);
  });
});


module.exports = router;
