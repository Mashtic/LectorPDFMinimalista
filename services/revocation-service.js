const crypto = require("node:crypto");
const forge = require("node-forge");

const { asn1 } = forge;

/*
 * Collects the proof that the certificates behind a signature were not revoked
 * when it was made, so it can travel inside the document and the signature can
 * be trusted later without asking anyone.
 *
 * Each certificate says where its status is published:
 *   - an OCSP service, which answers for that one certificate (used for the
 *     signer, whose authority publishes a list far too large to embed);
 *   - a revocation list (CRL), which is how the national hierarchy publishes
 *     the status of its own authorities.
 * Nothing is hardcoded: both addresses are read from the certificate itself.
 */

const REQUEST_TIMEOUT_MS = 10000;
const MAX_OCSP_BYTES = 64 * 1024;
const MAX_CRL_BYTES = 512 * 1024;
const CRL_CACHE_MS = 60 * 60 * 1000;

const SHA1_OID = "1.3.14.3.2.26";
const CRL_DISTRIBUTION_POINTS_OID = "2.5.29.31";
const OCSP_ADDRESS_PATTERN = /^OCSP - URI:(https?:\/\/\S+)$/m;

const OCSP_SUCCESSFUL = 0;
const CERTIFICATE_STATUS = { GOOD: 0, REVOKED: 1 };

const crlCache = new Map();

function universal(type, constructed, value) {
  return asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
}

function isContext(node, tagNumber) {
  return (
    node.tagClass === asn1.Class.CONTEXT_SPECIFIC && node.type === tagNumber
  );
}

function toBuffer(bytes) {
  return Buffer.from(bytes, "binary");
}

function sha1(data) {
  return crypto.createHash("sha1").update(data).digest().toString("binary");
}

/*
 * Reads the few fields needed from a certificate. They are taken from the
 * original encoding, because OCSP identifies a certificate by the digest of
 * exact bytes of its issuer.
 */
function readCertificate(der) {
  const fields = asn1.fromDer(der.toString("binary")).value[0].value;
  const offset = isContext(fields[0], 0) ? 1 : 0;
  const extensions = fields.find((field) => isContext(field, 3));

  return {
    der,
    x509: new crypto.X509Certificate(der),
    serialNumber: fields[offset].value,
    issuerName: toBuffer(asn1.toDer(fields[offset + 2]).getBytes()),
    subjectName: toBuffer(asn1.toDer(fields[offset + 4]).getBytes()),
    // The key as it sits in the BIT STRING, without the unused-bits byte
    publicKeyBits: toBuffer(
      asn1.toDer(fields[offset + 5].value[1]).getBytes(),
    ).subarray(readHeaderLength(fields[offset + 5].value[1]) + 1),
    extensions: extensions ? extensions.value[0].value : [],
  };
}

function readHeaderLength(node) {
  const encoded = toBuffer(asn1.toDer(node).getBytes());
  return encoded[1] < 0x80 ? 2 : 2 + (encoded[1] & 0x7f);
}

function isSelfIssued(certificate) {
  return certificate.issuerName.equals(certificate.subjectName);
}

function collectAddresses(node, addresses) {
  // A uniformResourceIdentifier is the [6] choice of GeneralName
  if (isContext(node, 6) && !node.constructed) {
    if (/^https?:\/\//i.test(node.value)) {
      addresses.push(node.value);
    }
  } else if (Array.isArray(node.value)) {
    node.value.forEach((child) => collectAddresses(child, addresses));
  }

  return addresses;
}

function readCrlAddresses(certificate) {
  const extension = certificate.extensions.find(
    (candidate) =>
      asn1.derToOid(candidate.value[0].value) === CRL_DISTRIBUTION_POINTS_OID,
  );

  if (!extension) {
    return [];
  }

  const value = extension.value[extension.value.length - 1].value;
  return collectAddresses(asn1.fromDer(value), []);
}

async function fetchBytes(address, options, maxBytes) {
  const response = await fetch(address, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${address} answered ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > maxBytes) {
    throw new Error(`${address} returned too much data`);
  }

  return body;
}

function buildOcspRequest(certificate, issuer) {
  // OCSPRequest > TBSRequest > requestList > Request > CertID
  const request = universal(asn1.Type.SEQUENCE, true, [
    universal(asn1.Type.SEQUENCE, true, [
      universal(asn1.Type.SEQUENCE, true, [
        universal(asn1.Type.SEQUENCE, true, [
          universal(asn1.Type.SEQUENCE, true, [
            universal(asn1.Type.SEQUENCE, true, [
              universal(
                asn1.Type.OID,
                false,
                asn1.oidToDer(SHA1_OID).getBytes(),
              ),
              universal(asn1.Type.NULL, false, ""),
            ]),
            universal(asn1.Type.OCTETSTRING, false, sha1(issuer.subjectName)),
            universal(asn1.Type.OCTETSTRING, false, sha1(issuer.publicKeyBits)),
            universal(asn1.Type.INTEGER, false, certificate.serialNumber),
          ]),
        ]),
      ]),
    ]),
  ]);

  return toBuffer(asn1.toDer(request).getBytes());
}

/*
 * Returns the status the service reports for the certificate that was asked
 * about. An answer about any other certificate is discarded.
 */
function readOcspStatus(response, certificate) {
  const fields = asn1.fromDer(response.toString("binary")).value;
  if (fields[0].value.charCodeAt(0) !== OCSP_SUCCESSFUL || !fields[1]) {
    throw new Error("The OCSP service could not answer");
  }

  // responseBytes > BasicOCSPResponse > tbsResponseData > responses
  const basicResponse = asn1.fromDer(fields[1].value[0].value[1].value);
  const responses = basicResponse.value[0].value.find(
    (field) =>
      field.tagClass === asn1.Class.UNIVERSAL &&
      field.type === asn1.Type.SEQUENCE,
  );

  const answer = responses.value.find(
    (single) => single.value[0].value[3].value === certificate.serialNumber,
  );

  if (!answer) {
    throw new Error("The OCSP answer is about another certificate");
  }

  return answer.value[1].type;
}

async function fetchOcsp(certificate, issuer) {
  const address = OCSP_ADDRESS_PATTERN.exec(certificate.x509.infoAccess || "");
  if (!address) {
    return null;
  }

  const response = await fetchBytes(
    address[1],
    {
      method: "POST",
      headers: { "Content-Type": "application/ocsp-request" },
      body: buildOcspRequest(certificate, issuer),
    },
    MAX_OCSP_BYTES,
  );

  return { response, status: readOcspStatus(response, certificate) };
}

function toDer(data) {
  const text = data.toString("latin1");
  if (!text.includes("-----BEGIN")) {
    return data;
  }

  return Buffer.from(text.replace(/-----[^-]+-----|\s/g, ""), "base64");
}

// A list is only kept when it was issued by the authority it should come from
function isIssuedBy(crl, issuer) {
  const fields = asn1.fromDer(crl.toString("binary")).value[0].value;
  const offset =
    fields[0].tagClass === asn1.Class.UNIVERSAL &&
    fields[0].type === asn1.Type.INTEGER
      ? 1
      : 0;

  return toBuffer(asn1.toDer(fields[offset + 1]).getBytes()).equals(
    issuer.subjectName,
  );
}

async function fetchCrl(certificate, issuer) {
  for (const address of readCrlAddresses(certificate)) {
    const cached = crlCache.get(address);
    if (cached && Date.now() - cached.fetchedAt < CRL_CACHE_MS) {
      return cached.crl;
    }

    try {
      const crl = toDer(await fetchBytes(address, {}, MAX_CRL_BYTES));

      if (isIssuedBy(crl, issuer)) {
        crlCache.set(address, { crl, fetchedAt: Date.now() });
        return crl;
      }
    } catch (error) {
      // Authorities publish their list in more than one place
      console.error("Could not download a revocation list:", error.message);
    }
  }

  return null;
}

/*
 * Gathers the revocation proof for the signer and for every authority above
 * it. isComplete tells whether each of them got one; isRevoked tells that the
 * signer's own certificate has been revoked.
 */
async function collectRevocationInfo(signerDer, chainDer) {
  const certificates = [signerDer, ...chainDer].map(readCertificate);
  const result = { ocsps: [], crls: [], isComplete: true, isRevoked: false };

  await Promise.all(
    certificates.map(async (certificate, index) => {
      // A root vouches for itself: there is nobody above to revoke it
      const issuer = certificates[index + 1];
      if (isSelfIssued(certificate)) {
        return;
      }

      if (!issuer) {
        result.isComplete = false;
        return;
      }

      try {
        const ocsp = await fetchOcsp(certificate, issuer);

        if (ocsp) {
          if (ocsp.status === CERTIFICATE_STATUS.REVOKED && index === 0) {
            result.isRevoked = true;
          }

          if (ocsp.status === CERTIFICATE_STATUS.GOOD) {
            result.ocsps.push(ocsp.response);
            return;
          }
        }
      } catch (error) {
        console.error("Could not check a certificate status:", error.message);
      }

      const crl = await fetchCrl(certificate, issuer);
      if (crl) {
        result.crls.push(crl);
      } else {
        result.isComplete = false;
      }
    }),
  );

  return result;
}

module.exports = { collectRevocationInfo };
