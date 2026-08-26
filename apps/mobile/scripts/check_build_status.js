const fs = require("fs");
const path = require("path");
const { SignJWT, importPKCS8 } = require("jose");

const KEY_ID = "T479RMTYDJ";
const ISSUER_ID = process.env.APPLE_ISSUER_ID || "07ba3ed9-33fb-4952-8cb5-aca4d1f5a7d6";
const ROOT_DIR = path.resolve(__dirname, "../../..");
const PRIVATE_KEY_PATH = path.join(ROOT_DIR, `AuthKey_${KEY_ID}.p8`);

async function getToken() {
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
  const key = await importPKCS8(privateKeyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID, typ: "JWT" })
    .setIssuer(ISSUER_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 1200)
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

async function checkBuilds() {
  const token = await getToken();
  
  console.log("Checking builds for At-Tayyibun (App ID: 6805307609)...");
  const res = await fetch("https://api.appstoreconnect.apple.com/v1/builds?filter[app]=6805307609&include=buildBetaDetail,betaAppReviewSubmission", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  const data = await res.json();
  const builds = data.data || [];
  
  if (builds.length === 0) {
    console.log("⏳ Build is currently being ingested by Apple (takes 2-5 minutes to appear in App Store Connect).");
    return;
  }
  
  console.log(`Found ${builds.length} build(s):`);
  for (const b of builds) {
    console.log(`  • Version: ${b.attributes.version} | State: ${b.attributes.processingState} | Uploaded: ${b.attributes.uploadedDate}`);
  }
}

checkBuilds().catch(console.error);
