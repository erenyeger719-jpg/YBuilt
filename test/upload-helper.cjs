const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function uploadFile(url, filepath, fieldName = 'file') {
  const form = new FormData();
  form.append(fieldName, fs.createReadStream(filepath));
  const headers = form.getHeaders();
  const resp = await axios.post(url, form, { headers, maxBodyLength: Infinity });
  return resp.data;
}

module.exports = { uploadFile };
