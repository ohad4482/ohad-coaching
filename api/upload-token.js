const { generateClientTokenFromReadWriteToken } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body = '';
  for await (const chunk of req) body += chunk;
  const { filename, contentType } = JSON.parse(body);

  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    pathname: filename,
    onUploadCompleted: { callbackUrl: null },
    allowedContentTypes: contentType ? [contentType] : undefined,
    maximumSizeInBytes: 220 * 1024 * 1024,
    addRandomSuffix: false,
    expiresIn: 3600,
  });

  return res.status(200).json({ clientToken: token });
};
