const crypto = require("node:crypto");
const forge = require("node-forge");

const { asn1 } = forge;

/*
 * Asks the national timestamping authority to certify when a signature was
 * made (RFC 3161). The authority never sees the document: it receives the
 * digest of the signature value and returns a token, signed by it, that binds
 * that digest to its own clock. The token proves the signature existed at that
 * moment even after the signer's certificate expires.
 */

const TIMESTAMP_AUTHORITY_URL = "http://tsa.sinpe.fi.cr/tsaHttp/";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const SHA256_OID = "2.16.840.1.101.3.4.2.1";

// PKIStatus: 0 is granted and 1 is granted with modifications
const GRANTED_STATUSES = [0, 1];

function universal(type, constructed, value) {
  return asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
}

function buildRequest(digest, nonce) {
  // TimeStampReq: version, messageImprint, nonce, certReq
  const request = universal(asn1.Type.SEQUENCE, true, [
    universal(asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    universal(asn1.Type.SEQUENCE, true, [
      universal(asn1.Type.SEQUENCE, true, [
        universal(asn1.Type.OID, false, asn1.oidToDer(SHA256_OID).getBytes()),
        universal(asn1.Type.NULL, false, ""),
      ]),
      universal(asn1.Type.OCTETSTRING, false, digest.toString("binary")),
    ]),
    universal(asn1.Type.INTEGER, false, nonce.toString("binary")),
    // Asks for the authority's certificate inside the token, so the token
    // can be checked without looking anything up
    universal(asn1.Type.BOOLEAN, false, String.fromCharCode(0xff)),
  ]);

  return Buffer.from(asn1.toDer(request).getBytes(), "binary");
}

function readOctets(node) {
  return node.constructed
    ? Buffer.concat(node.value.map(readOctets))
    : Buffer.from(node.value, "binary");
}

/*
 * The token is only accepted when it answers this very request: it must carry
 * the digest that was sent and repeat the random nonce. That rules out a stale
 * or swapped reply.
 */
function readToken(response, digest, nonce) {
  const [statusInfo, token] = asn1.fromDer(response.toString("binary")).value;
  const status = statusInfo.value[0].value.charCodeAt(0);

  if (!GRANTED_STATUSES.includes(status) || !token) {
    throw new Error(`The timestamp authority refused the request (${status})`);
  }

  // ContentInfo > SignedData > encapContentInfo > eContent (TSTInfo)
  const signedData = token.value[1].value[0];
  const info = asn1.fromDer(
    readOctets(signedData.value[2].value[1].value[0]).toString("binary"),
  ).value;

  const stampedDigest = readOctets(info[2].value[1]);
  const stampedNonce = info.find(
    (field, index) =>
      index > 4 &&
      field.tagClass === asn1.Class.UNIVERSAL &&
      field.type === asn1.Type.INTEGER,
  );

  if (!stampedDigest.equals(digest)) {
    throw new Error("The timestamp does not belong to this signature");
  }

  if (!stampedNonce || !Buffer.from(stampedNonce.value, "binary").equals(nonce)) {
    throw new Error("The timestamp does not answer this request");
  }

  return Buffer.from(asn1.toDer(token).getBytes(), "binary");
}

/*
 * Returns the timestamp token (a DER ContentInfo) for the given bytes, which
 * for a signature timestamp are the signature value itself.
 */
async function requestTimestamp(data) {
  const digest = crypto.createHash("sha256").update(data).digest();

  // A positive random number: the first bit is cleared so it is not negative
  const nonce = crypto.randomBytes(8);
  nonce[0] = (nonce[0] & 0x7f) | 0x01;

  const response = await fetch(TIMESTAMP_AUTHORITY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/timestamp-query" },
    body: buildRequest(digest, nonce),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`The timestamp authority answered ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new Error("The timestamp reply is too large");
  }

  return readToken(body, digest, nonce);
}

module.exports = { requestTimestamp };
