const crypto = require("node:crypto");
const forge = require("node-forge");

/*
 * Reads the digital signatures already present in a PDF. A signature is stored
 * as a PKCS#7 container inside /Contents, and /ByteRange says which parts of
 * the file it covers: everything except the container itself.
 */

const BYTE_RANGE_PATTERN =
  /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
const HEX_CONTAINER_PATTERN = /[0-9A-Fa-f]+/;

function findSignatures(pdfBuffer) {
  const pdfText = pdfBuffer.toString("latin1");
  const signatures = [];
  let match = BYTE_RANGE_PATTERN.exec(pdfText);

  while (match) {
    const byteRange = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
    ];

    // The gap left by the ByteRange holds the container as <hex...>
    const gap = pdfText.slice(byteRange[0] + byteRange[1], byteRange[2]);
    const contents = HEX_CONTAINER_PATTERN.exec(gap);

    if (contents) {
      signatures.push({ byteRange, hexContainer: contents[0] });
    }

    match = BYTE_RANGE_PATTERN.exec(pdfText);
  }

  BYTE_RANGE_PATTERN.lastIndex = 0;
  return signatures;
}

function getSignedBytes(pdfBuffer, byteRange) {
  return Buffer.concat([
    pdfBuffer.subarray(byteRange[0], byteRange[0] + byteRange[1]),
    pdfBuffer.subarray(byteRange[2], byteRange[2] + byteRange[3]),
  ]);
}

function getAttributeValue(attributes, type) {
  return attributes.find((attribute) => attribute.type === type);
}

/*
 * node-forge parses PKCS#7 but does not verify signed data, so the two checks
 * are done here: the digest of the document must match the one inside the
 * signature, and the signature over the signed attributes must be valid.
 */
function verifySignature(container, signedBytes) {
  const signer = container.rawCapture?.signerInfos?.[0];
  if (!signer) {
    return false;
  }

  const attributes = container.rawCapture.authenticatedAttributes;
  const signatureValue = container.rawCapture.signature;
  const certificate = container.certificates?.[0];

  if (!attributes || !signatureValue || !certificate) {
    return false;
  }

  const parsedAttributes = forge.asn1
    .fromDer(
      forge.asn1.toDer(
        forge.asn1.create(
          forge.asn1.Class.UNIVERSAL,
          forge.asn1.Type.SET,
          true,
          attributes,
        ),
      ),
    )
    .value.map((attribute) => ({
      type: forge.asn1.derToOid(attribute.value[0].value),
      value: attribute.value[1].value[0],
    }));

  const messageDigest = getAttributeValue(
    parsedAttributes,
    forge.pki.oids.messageDigest,
  );

  if (!messageDigest) {
    return false;
  }

  const documentDigest = crypto
    .createHash("sha256")
    .update(signedBytes)
    .digest();

  const storedDigest = Buffer.from(messageDigest.value.value, "binary");

  if (!documentDigest.equals(storedDigest)) {
    return false;
  }

  // The RSA signature covers the signed attributes, encoded as a SET
  const signedAttributesDer = forge.asn1.toDer(
    forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      attributes,
    ),
  );

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(Buffer.from(signedAttributesDer.getBytes(), "binary"));

  return verifier.verify(
    forge.pki.publicKeyToPem(certificate.publicKey),
    Buffer.from(signatureValue, "binary"),
  );
}

function readSignerDetails(container) {
  const certificate = container.certificates?.[0];
  const signerName = certificate?.subject.getField("CN")?.value || null;

  const attributes = container.rawCapture?.authenticatedAttributes || [];
  let signedAt = null;

  for (const attribute of attributes) {
    try {
      const type = forge.asn1.derToOid(attribute.value[0].value);
      if (type === forge.pki.oids.signingTime) {
        signedAt = forge.asn1
          .utcTimeToDate(attribute.value[1].value[0].value)
          .toISOString();
      }
    } catch {
      // An attribute that cannot be read is skipped
    }
  }

  return { signerName, signedAt };
}

function readSignatureInfo(pdfBuffer) {
  const buffer = Buffer.from(pdfBuffer);
  const signatures = findSignatures(buffer);

  return signatures.map((signature) => {
    const signedBytes = getSignedBytes(buffer, signature.byteRange);

    // Content added after the signed range means the file changed afterwards
    const signedEnd = signature.byteRange[2] + signature.byteRange[3];
    const coversWholeDocument = buffer.length - signedEnd <= 2;

    let isValid = false;
    let details = { signerName: null, signedAt: null };

    try {
      const container = forge.pkcs7.messageFromAsn1(
        forge.asn1.fromDer(
          forge.util.hexToBytes(signature.hexContainer.replace(/0+$/, "")),
        ),
      );

      details = readSignerDetails(container);
      isValid = verifySignature(container, signedBytes);
    } catch (error) {
      console.error("Could not read a signature:", error.message);
    }

    return {
      ...details,
      isValid,
      coversWholeDocument,
    };
  });
}

module.exports = { readSignatureInfo };
