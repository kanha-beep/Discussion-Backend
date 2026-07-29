import crypto from "crypto";

const DANGEROUS_SIGNATURES = [
  Buffer.from("4d5a", "hex"),
  Buffer.from("3c736372697074", "hex"),
];

export const getBufferSha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

export const validateBinaryUpload = ({
  buffer,
  maxBytes = 10 * 1024 * 1024,
  allowedMimeTypes = [],
  mimeType = "application/octet-stream",
  fileName = "upload.bin",
}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, reason: "Upload payload is empty." };
  }

  if (buffer.length > maxBytes) {
    return { ok: false, reason: `Upload exceeds ${maxBytes} bytes.` };
  }

  if (allowedMimeTypes.length && !allowedMimeTypes.includes(mimeType)) {
    return { ok: false, reason: `Unsupported file type for ${fileName}.` };
  }

  const hasDangerousSignature = DANGEROUS_SIGNATURES.some((signature) =>
    buffer.subarray(0, signature.length).equals(signature),
  );

  if (hasDangerousSignature) {
    return { ok: false, reason: `${fileName} failed content scanning.` };
  }

  return {
    ok: true,
    sha256: getBufferSha256(buffer),
    size: buffer.length,
  };
};

export const verifyWebhookSignature = ({ rawBody, providedSignature, secret }) => {
  if (!secret || !providedSignature || !rawBody) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(String(providedSignature).trim(), "hex");

  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};
