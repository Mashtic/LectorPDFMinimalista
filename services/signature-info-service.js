const crypto = require("node:crypto");
const forge = require("node-forge");

const { asn1 } = forge;

/*
 * Reads the digital signatures already present in a PDF. A signature is stored
 * as a CMS container inside /Contents, and /ByteRange says which parts of the
 * file it covers: everything except the container itself.
 *
 * The container is walked as plain ASN.1 instead of going through a PKCS#7
 * helper, because real documents carry things those helpers reject: document
 * timestamps, several certificates in any order, RSA-PSS or ECDSA keys and
 * digests other than SHA-256.
 */

const BYTE_RANGE_PATTERN =
  /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
const SIGNING_DATE_PATTERN =
  /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?([+\-Z])?(\d{2})?'?(\d{2})?/;
const SUB_FILTER_PATTERN = /\/SubFilter\s*\/([A-Za-z0-9.]+)/;

const OID = {
  signedData: "1.2.840.113549.1.7.2",
  timestampInfo: "1.2.840.113549.1.9.16.1.4",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  signatureTimestamp: "1.2.840.113549.1.9.16.2.14",
  rsaPss: "1.2.840.113549.1.1.10",
};

const DIGEST_NAMES = {
  "1.3.14.3.2.26": "sha1",
  "2.16.840.1.101.3.4.2.4": "sha224",
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
};

const TIMESTAMP_SUB_FILTER = "ETSI.RFC3161";
const SIGNER_NAME_SUFFIX = /\s*\(FIRMA\)\s*$/i;

function toBuffer(bytes) {
  return Buffer.from(bytes, "binary");
}

function isContext(node, tagNumber) {
  return (
    node.tagClass === asn1.Class.CONTEXT_SPECIFIC && node.type === tagNumber
  );
}

function readOid(node) {
  return asn1.derToOid(node.value);
}

// An OCTET STRING may come split in pieces when the encoder streamed it
function readOctets(node) {
  if (!node.constructed) {
    return toBuffer(node.value);
  }

  return Buffer.concat(node.value.map(readOctets));
}

function readTime(node) {
  return node.type === asn1.Type.UTCTIME
    ? asn1.utcTimeToDate(node.value)
    : asn1.generalizedTimeToDate(node.value);
}

function findSignatures(pdfBuffer) {
  const pdfText = pdfBuffer.toString("latin1");
  const signatures = [];

  for (const match of pdfText.matchAll(BYTE_RANGE_PATTERN)) {
    const byteRange = match.slice(1, 5).map(Number);
    const [start, firstLength, secondStart, secondLength] = byteRange;
    const gapStart = start + firstLength;
    const signedEnd = secondStart + secondLength;

    /*
     * A range that does not describe "the file minus one gap", or whose gap
     * does not hold a container, belongs to a signature that was damaged, for
     * example by rewriting the file. It is reported as not valid instead of
     * being left out, so a broken signature never goes unnoticed.
     */
    if (start !== 0 || secondStart <= gapStart || signedEnd > pdfBuffer.length) {
      signatures.push({ byteRange, signedEnd: 0, isDamaged: true });
      continue;
    }

    // The gap left by the ByteRange holds the container as <hex...>
    const gap = pdfText.slice(gapStart, secondStart).replace(/\s/g, "");
    const contents = /^<([0-9A-Fa-f]*)>$/.exec(gap);

    if (!contents) {
      signatures.push({ byteRange, signedEnd: 0, isDamaged: true });
      continue;
    }

    // The rest of the signature dictionary sits around the gap
    const dictionaryStart = pdfText.lastIndexOf(" obj", match.index);
    const dictionaryEnd = pdfText.indexOf("endobj", secondStart);
    const dictionary =
      pdfText.slice(Math.max(dictionaryStart, 0), gapStart) +
      pdfText.slice(secondStart, dictionaryEnd < 0 ? secondStart : dictionaryEnd);

    signatures.push({
      byteRange,
      signedEnd,
      hexContainer: contents[1],
      subFilter: SUB_FILTER_PATTERN.exec(dictionary)?.[1] || null,
      dictionaryDate: readDictionaryDate(dictionary),
    });
  }

  return signatures.sort((first, second) => first.signedEnd - second.signedEnd);
}

function readDictionaryDate(dictionary) {
  const match = SIGNING_DATE_PATTERN.exec(dictionary);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] =
    match;
  const offset =
    sign && sign !== "Z"
      ? `${sign}${offsetHour || "00"}:${offsetMinute || "00"}`
      : "Z";
  const date = new Date(
    `${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}${offset}`,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getSignedBytes(pdfBuffer, byteRange) {
  return Buffer.concat([
    pdfBuffer.subarray(byteRange[0], byteRange[0] + byteRange[1]),
    pdfBuffer.subarray(byteRange[2], byteRange[2] + byteRange[3]),
  ]);
}

/*
 * /Contents is padded with zeros up to the reserved size. The container says
 * its own length, so the padding is ignored instead of guessed: stripping
 * trailing zeros by hand corrupts containers that really end in a zero byte.
 */
function parseContainer(hexContainer) {
  const root = asn1.fromDer(forge.util.hexToBytes(hexContainer), {
    parseAllBytes: false,
  });

  if (readOid(root.value[0]) !== OID.signedData) {
    throw new Error("Not a signed data container");
  }

  return parseSignedData(root.value[1].value[0]);
}

function parseSignedData(signedData) {
  const fields = signedData.value;
  const contentInfo = fields[2];
  const certificatesNode = fields.find((field) => isContext(field, 0));
  const signerInfosNode = fields[fields.length - 1];

  const certificates = [];
  for (const node of certificatesNode?.value || []) {
    try {
      certificates.push(
        new crypto.X509Certificate(toBuffer(asn1.toDer(node).getBytes())),
      );
    } catch {
      // Attribute certificates and unreadable entries are not needed
    }
  }

  return {
    contentType: readOid(contentInfo.value[0]),
    content: contentInfo.value[1]
      ? readOctets(contentInfo.value[1].value[0])
      : null,
    certificates,
    signers: signerInfosNode.value.map(parseSignerInfo),
  };
}

function parseSignerInfo(signerInfo) {
  const fields = [...signerInfo.value];
  fields.shift(); // version

  const signerId = fields.shift();
  const digestAlgorithm = fields.shift();
  const signedAttributes = isContext(fields[0], 0) ? fields.shift() : null;
  const signatureAlgorithm = fields.shift();
  const signature = fields.shift();
  const unsignedAttributes = fields[0] && isContext(fields[0], 1) ? fields[0] : null;

  // issuerAndSerialNumber is a SEQUENCE; the other form is a key identifier
  const serialNumber =
    signerId.tagClass === asn1.Class.UNIVERSAL
      ? normalizeSerial(forge.util.bytesToHex(signerId.value[1].value))
      : null;

  return {
    serialNumber,
    digestName: DIGEST_NAMES[readOid(digestAlgorithm.value[0])] || null,
    signedAttributes,
    signatureAlgorithm,
    signature: readOctets(signature),
    unsignedAttributes,
  };
}

function normalizeSerial(hex) {
  return hex.replace(/^0+/, "").toUpperCase();
}

function findAttribute(attributesNode, oid) {
  const attribute = attributesNode?.value.find(
    (candidate) => readOid(candidate.value[0]) === oid,
  );

  return attribute ? attribute.value[1].value[0] : null;
}

function hash(digestName, data) {
  return crypto.createHash(digestName).update(data).digest();
}

/*
 * RSA-PSS states its hash and salt length as parameters; when they are left
 * out the defaults of the standard apply (SHA-1 and 20 bytes).
 */
function readPssOptions(signatureAlgorithm) {
  const options = { digestName: "sha1", saltLength: 20 };
  const parameters = signatureAlgorithm.value[1];

  for (const parameter of parameters?.value || []) {
    if (isContext(parameter, 0)) {
      options.digestName =
        DIGEST_NAMES[readOid(parameter.value[0].value[0])] || options.digestName;
    } else if (isContext(parameter, 2)) {
      options.saltLength = Number.parseInt(
        forge.util.bytesToHex(parameter.value[0].value),
        16,
      );
    }
  }

  return options;
}

function verifyWithCertificate(signer, certificate, signedData) {
  const key = certificate.publicKey;
  const algorithm = readOid(signer.signatureAlgorithm.value[0]);

  if (algorithm === OID.rsaPss || key.asymmetricKeyType === "rsa-pss") {
    const { digestName, saltLength } = readPssOptions(signer.signatureAlgorithm);

    return crypto.verify(
      digestName,
      signedData,
      { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength },
      signer.signature,
    );
  }

  // RSA with the classic padding and ECDSA only need the digest name
  return crypto.verify(signer.digestName, signedData, key, signer.signature);
}

/*
 * Two checks make a signature valid: the digest of the content must match the
 * one stored in the signed attributes, and the signature over those attributes
 * must verify with the public key of the signer's certificate.
 */
function verifySigner(signer, certificates, content) {
  if (!signer.digestName) {
    return null;
  }

  let signedData = content;

  if (signer.signedAttributes) {
    const storedDigest = findAttribute(
      signer.signedAttributes,
      OID.messageDigest,
    );

    if (
      !storedDigest ||
      !hash(signer.digestName, content).equals(readOctets(storedDigest))
    ) {
      return null;
    }

    // The attributes are signed encoded as a SET, not with their [0] tag
    signedData = toBuffer(
      asn1
        .toDer(
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.SET,
            true,
            signer.signedAttributes.value,
          ),
        )
        .getBytes(),
    );
  }

  // The container may carry the whole chain, so the signer's certificate is
  // looked up by serial number instead of assuming it comes first
  const named = certificates.filter(
    (certificate) =>
      normalizeSerial(certificate.serialNumber) === signer.serialNumber,
  );
  const candidates = named.length ? named : certificates;

  return (
    candidates.find((certificate) => {
      try {
        return verifyWithCertificate(signer, certificate, signedData);
      } catch {
        return false;
      }
    }) || null
  );
}

function readCommonName(certificate) {
  const line = certificate.subject
    .split("\n")
    .find((entry) => entry.startsWith("CN="));

  return line ? line.slice(3).replace(SIGNER_NAME_SUFFIX, "") : null;
}

function readTimestampInfo(content) {
  // TSTInfo: version, policy, messageImprint, serialNumber, genTime, ...
  const fields = asn1.fromDer(content.toString("binary")).value;
  const messageImprint = fields[2];

  return {
    digestName: DIGEST_NAMES[readOid(messageImprint.value[0].value[0])] || null,
    digest: readOctets(messageImprint.value[1]),
    generatedAt: readTime(fields[4]),
  };
}

/*
 * The date certified by a timestamp authority is preferred, because the other
 * two come from the clock of whoever signed. The token only counts when it
 * was issued for this very signature and its own signature verifies.
 */
function readCertifiedDate(signer) {
  const token = findAttribute(signer.unsignedAttributes, OID.signatureTimestamp);
  if (!token) {
    return null;
  }

  const tokenData = parseSignedData(token.value[1].value[0]);
  const info = readTimestampInfo(tokenData.content);

  const belongsToSignature =
    info.digestName &&
    hash(info.digestName, signer.signature).equals(info.digest);
  const isAuthentic = verifySigner(
    tokenData.signers[0],
    tokenData.certificates,
    tokenData.content,
  );

  return belongsToSignature && isAuthentic ? info.generatedAt : null;
}

function readSigningDate(signer, dictionaryDate) {
  try {
    const certifiedDate = readCertifiedDate(signer);
    if (certifiedDate) {
      return { date: certifiedDate, isCertified: true };
    }
  } catch {
    // A token that cannot be read is treated as no token at all
  }

  try {
    const signingTime = findAttribute(signer.signedAttributes, OID.signingTime);
    if (signingTime) {
      return { date: readTime(signingTime), isCertified: false };
    }
  } catch {
    // A date that cannot be read falls back to the one in the dictionary
  }

  return { date: dictionaryDate, isCertified: false };
}

function inspectSignature(signature, signedBytes) {
  const container = parseContainer(signature.hexContainer);
  const signer = container.signers[0];
  const isTimestamp =
    signature.subFilter === TIMESTAMP_SUB_FILTER ||
    container.contentType === OID.timestampInfo;

  let content = signedBytes;
  let signedAt;
  let hasCertifiedDate = isTimestamp;

  if (isTimestamp) {
    // A document timestamp signs a token that holds the digest of the file
    const info = readTimestampInfo(container.content);
    content = container.content;
    signedAt = info.generatedAt;

    if (
      !info.digestName ||
      !hash(info.digestName, signedBytes).equals(info.digest)
    ) {
      return { kind: "timestamp", signedAt, certificate: null };
    }
  } else {
    const signing = readSigningDate(signer, signature.dictionaryDate);
    signedAt = signing.date;
    hasCertifiedDate = signing.isCertified;
  }

  const certificate = verifySigner(signer, container.certificates, content);
  const shown =
    certificate ||
    container.certificates.find(
      (candidate) =>
        normalizeSerial(candidate.serialNumber) === signer.serialNumber,
    );

  return {
    kind: isTimestamp ? "timestamp" : "signature",
    signedAt,
    hasCertifiedDate,
    certificate,
    signerName: shown ? readCommonName(shown) : null,
    signerId: shown ? shown.fingerprint256 : null,
  };
}

function readSignatureInfo(pdfBuffer) {
  const buffer = Buffer.from(pdfBuffer);
  const signatures = findSignatures(buffer);

  /*
   * Every signature is appended as a new revision, so only the last one
   * reaches the end of the file; the earlier ones are covered by the ones
   * that came after. Anything left after the last signature is a change
   * nobody signed.
   */
  const lastSignedEnd = signatures.length
    ? signatures[signatures.length - 1].signedEnd
    : 0;
  const coversWholeDocument =
    buffer.subarray(lastSignedEnd).toString("latin1").trim() === "";

  return signatures.map((signature) => {
    const result = {
      kind: "signature",
      signerName: null,
      signerId: null,
      signedAt: null,
      // True when the date comes from a timestamp authority, not from the
      // clock of whoever signed
      hasCertifiedDate: false,
      isValid: false,
      coversWholeDocument,
    };

    if (signature.isDamaged) {
      return result;
    }

    try {
      const details = inspectSignature(
        signature,
        getSignedBytes(buffer, signature.byteRange),
      );

      result.kind = details.kind;
      result.signerName = details.signerName || null;
      result.signerId = details.signerId || null;
      result.signedAt = details.signedAt
        ? details.signedAt.toISOString()
        : null;
      result.hasCertifiedDate = Boolean(details.hasCertifiedDate);
      result.isValid = Boolean(details.certificate);
    } catch (error) {
      console.error("Could not read a signature:", error.message);
    }

    return result;
  });
}

module.exports = { readSignatureInfo };
