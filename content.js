const express = require('express');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
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
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Construct the key for the MD5 file
    const md5Key = `${uniqueId}/${filename}.md5`;

    // Check if MD5 file exists on S3
    s3.headObject({ Bucket: bucketName, Key: md5Key }, (md5HeadErr) => {
      if (!md5HeadErr) {
        // MD5 file exists, retrieve the content and set it in the response headers
        s3.getObject({ Bucket: bucketName, Key: md5Key }, (md5GetObjectErr, md5GetObjectData) => {
          if (md5GetObjectErr) {
            console.error('Error retrieving MD5 file:', md5GetObjectErr);
            return res.status(500).json({ error: 'Failed to retrieve MD5 file', details: md5GetObjectErr.message });
          }

          const md5Hash = md5GetObjectData.Body.toString('utf8').trim();
          res.setHeader('Content-MD5', md5Hash);

          // Send the headers in the response
          return res.end();
        });
      } else {
        console.log('MD5 file does not exist, calculating MD5 hash...');
        // MD5 file does not exist, calculate the MD5 hash and store it on S3
        s3.getObject({ Bucket: bucketName, Key: s3Key }, (getObjectErr, getObjectData) => {
          if (getObjectErr) {
            console.error('Error retrieving file content:', getObjectErr);
            return res.status(500).json({ error: 'Failed to retrieve file content', details: getObjectErr.message });
          }

          // Calculate the MD5 hash of the file content
          const md5Hash = crypto.createHash('md5').update(getObjectData.Body).digest('base64');
          res.setHeader('Content-MD5', md5Hash);

          // Store the MD5 hash as a file on S3
          s3.putObject({ Bucket: bucketName, Key: md5Key, Body: md5Hash }, (putObjectErr) => {
            if (putObjectErr) {
              console.error('Error storing MD5 file:', putObjectErr);
            }
          });

          // Send the headers in the response
          return res.end();
        });
      }
    });
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
