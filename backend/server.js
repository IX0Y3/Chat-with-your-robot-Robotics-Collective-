const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Statische Dateien aus dem public-Ordner serven
app.use(express.static(path.join(__dirname, 'public')));

// roslib aus node_modules serven
app.use('/roslib', express.static(path.join(__dirname, 'node_modules/roslib'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
