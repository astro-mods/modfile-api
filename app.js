const express = require('express');
const cors = require('cors');
const uploadRouter = require('./upload');
const contentRouter = require('./content');



const app = express();

// Enable CORS
app.use(cors());

// Mount the file upload router
app.use('/upload', uploadRouter);
app.use ('/content', contentRouter);

app.get('/healthz', (req, res) => {
  res.send('OK');
});


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
