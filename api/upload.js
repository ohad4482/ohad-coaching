const { createMultipartUpload, uploadPart, completeMultipartUpload, put } = require('@vercel/blob');

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const action = req.headers['x-upload-action'];
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    // Small files: single PUT
    if (action === 'put') {
      const filename = req.headers['x-filename'] || 'file';
      const contentType = req.headers['x-content-type'] || 'application/octet-stream';
      const body = await readBody(req);
      const blob = await put(filename, body, { access: 'public', contentType, token, addRandomSuffix: true });
      return res.status(200).json({ url: blob.url });
    }

    // Start multipart upload
    if (action === 'start') {
      const body = JSON.parse(await readBody(req));
      const mp = await createMultipartUpload(body.filename, {
        access: 'public',
        contentType: body.contentType || 'application/octet-stream',
        token,
        addRandomSuffix: true,
      });
      return res.status(200).json({ uploadId: mp.uploadId, key: mp.key, pathname: mp.pathname, url: mp.url });
    }

    // Upload one part
    if (action === 'part') {
      const pathname = req.headers['x-pathname'];
      const uploadId = req.headers['x-upload-id'];
      const key = req.headers['x-upload-key'];
      const partNumber = parseInt(req.headers['x-part-number'] || '1');
      const body = await readBody(req);
      const part = await uploadPart(pathname, body, {
        token,
        uploadId,
        key,
        partNumber,
        access: 'public',
      });
      return res.status(200).json({ etag: part.etag, partNumber: part.partNumber });
    }

    // Complete multipart upload
    if (action === 'complete') {
      const body = JSON.parse(await readBody(req));
      const blob = await completeMultipartUpload(body.pathname, body.parts, {
        token,
        uploadId: body.uploadId,
        key: body.key,
        access: 'public',
      });
      return res.status(200).json({ url: blob.url });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
};
