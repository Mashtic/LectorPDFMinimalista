const fs = require("fs/promises");

async function readPdfFile(filePath) {
  const content = await fs.readFile(filePath);

  return {
    path: filePath,
    content,
  };
}

module.exports = {
  readPdfFile,
};
