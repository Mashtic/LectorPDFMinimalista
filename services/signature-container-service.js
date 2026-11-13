const crypto = require("node:crypto");
const forge = require("node-forge");

const { asn1 } = forge;

/*
 * Assembles the CMS container that goes inside the PDF signature. The card
 * only computes the RSA signature over the signed attributes; everything else
 * is put together here:
 *
 *   signed attributes     what the card vouches for: the digest of the
 *                         document, which certificate signed it and the
 *                         revocation proof gathered before signing
 *   unsigned attributes   the timestamp, added after the card signed, so it
 *                         certifies the signature without altering it
 *   certificates          the signer and the authorities above it
 */

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  signatureTimestamp: "1.2.840.113549.1.9.16.2.14",
  revocationInfoArchival: "1.2.840.113583.1.1.8",
  sha256: "2.16.840.1.101.3.4.2.1",
  sha256WithRsa: "1.2.840.113549.1.1.11",
};

// Room for what is only known after signing: the signature and the timestamp
const STRUCTURE_BYTES = 2048;
const TIMESTAMP_BYTES = 8192;

function universal(type, constructed, value) {
  return asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
}

function context(tagNumber, value) {
  return asn1.create(asn1.Class.CONTEXT_SPECIFIC, tagNumber, true, value);
}

function sequence(value) {
  return universal(asn1.Type.SEQUENCE, true, value);
}

function set(value) {
  return universal(asn1.Type.SET, true, value);
}

function oid(value) {
  return universal(asn1.Type.OID, false, asn1.oidToDer(value).getBytes());
}

function octets(buffer) {
  return universal(asn1.Type.OCTETSTRING, false, buffer.toString("binary"));
}

function integer(value) {
  return universal(asn1.Type.INTEGER, false, asn1.integerToDer(value).getBytes());
}

function algorithm(value) {
  return sequence([oid(value), universal(asn1.Type.NULL, false, "")]);
}

function parse(der) {
  return asn1.fromDer(der.toString("binary"));
}

function encode(node) {
  return Buffer.from(asn1.toDer(node).getBytes(), "binary");
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest();
}

function attribute(type, value) {
  return sequence([oid(type), set([value])]);
}

// DER orders the members of a SET by their encoding
function sortForSet(nodes) {
  return nodes
    .map((node) => ({ node, encoded: encode(node) }))
    .sort((first, second) => Buffer.compare(first.encoded, second.encoded))
    .map((entry) => entry.node);
}

/*
 * Binds the signature to one certificate, so it cannot later be presented as
 * made with another certificate that shares the same key.
 */
function buildSigningCertificate(certificateDer) {
  return attribute(
    OID.signingCertificateV2,
    sequence([sequence([sequence([octets(sha256(certificateDer))])])]),
  );
}

/*
 * The revocation proof travels as a signed attribute: lists under [0] and
 * OCSP answers under [1]. Being signed, it also fixes what the signer knew
 * about the certificates at the moment of signing.
 */
function buildRevocationInfo(revocation) {
  const parts = [];

  if (revocation.crls.length) {
    parts.push(context(0, [sequence(revocation.crls.map(parse))]));
  }

  if (revocation.ocsps.length) {
    parts.push(context(1, [sequence(revocation.ocsps.map(parse))]));
  }

  return parts.length
    ? attribute(OID.revocationInfoArchival, sequence(parts))
    : null;
}

function readIssuerAndSerial(certificateDer) {
  const fields = parse(certificateDer).value[0].value;
  const hasVersion =
    fields[0].tagClass === asn1.Class.CONTEXT_SPECIFIC && fields[0].type === 0;
  const offset = hasVersion ? 1 : 0;

  return sequence([fields[offset + 2], fields[offset]]);
}

function estimateContainerSize({ certificatesDer, revocation }) {
  const embedded = [
    ...certificatesDer,
    ...revocation.crls,
    ...revocation.ocsps,
  ].reduce((total, item) => total + item.length, 0);

  return embedded + STRUCTURE_BYTES + TIMESTAMP_BYTES;
}

/*
 * content           the bytes of the PDF covered by the signature
 * certificatesDer   the signer's certificate first, then its authorities
 * revocation        { crls, ocsps } gathered for those certificates
 * key               stands for the private key: sign(messageDigest)
 * requestTimestamp  async (signatureValue) => timestamp token, or null to
 *                   sign without one
 *
 * Returns the container and whether it carries a timestamp. A timestamp that
 * cannot be obtained does not fail the signature: the caller decides.
 */
async function buildSignatureContainer({
  content,
  certificatesDer,
  revocation,
  key,
  requestTimestamp,
}) {
  const signerDer = certificatesDer[0];

  const signedAttributes = sortForSet(
    [
      attribute(OID.contentType, oid(OID.data)),
      attribute(OID.messageDigest, octets(sha256(content))),
      buildSigningCertificate(signerDer),
      buildRevocationInfo(revocation),
    ].filter(Boolean),
  );

  // What gets signed is the attributes encoded as a SET
  const digest = forge.md.sha256.create();
  digest.update(asn1.toDer(set(signedAttributes)).getBytes());
  const signatureValue = Buffer.from(key.sign(digest), "binary");

  const signerInfo = [
    integer(1),
    readIssuerAndSerial(signerDer),
    algorithm(OID.sha256),
    context(0, signedAttributes),
    algorithm(OID.sha256WithRsa),
    octets(signatureValue),
  ];

  let hasTimestamp = false;
  let timestampError = null;

  if (requestTimestamp) {
    try {
      const token = await requestTimestamp(signatureValue);
      signerInfo.push(
        context(1, [attribute(OID.signatureTimestamp, parse(token))]),
      );
      hasTimestamp = true;
    } catch (error) {
      timestampError = error;
    }
  }

  const container = sequence([
    oid(OID.signedData),
    context(0, [
      sequence([
        integer(1),
        set([algorithm(OID.sha256)]),
        sequence([oid(OID.data)]),
        // Copied byte for byte: re-encoding a certificate could alter it
        context(0, certificatesDer.map(parse)),
        set([sequence(signerInfo)]),
      ]),
    ]),
  ]);

  return { container: encode(container), hasTimestamp, timestampError };
}

module.exports = { buildSignatureContainer, estimateContainerSize };
