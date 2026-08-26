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

async function checkStatus() {
  const token = await getToken();
  
  console.log("Checking App Store Connect for registered apps...");
  const res = await fetch("https://api.appstoreconnect.apple.com/v1/apps", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  const data = await res.json();
  const apps = data.data || [];
  
  console.log(`Found ${apps.length} app(s) in App Store Connect:`);
  for (const app of apps) {
    console.log(`  • Name: ${app.attributes.name} | Bundle ID: ${app.attributes.bundleId} | SKU: ${app.attributes.sku}`);
  }
  
  const atTayyibun = apps.find(a => a.attributes.bundleId === "com.attayyibun.attayyibun");
  if (atTayyibun) {
    console.log("\n✅ At-Tayyibun app record exists! App ID:", atTayyibun.id);
    return true;
  } else {
    console.log("\n⚠️ At-Tayyibun app record is not yet created in App Store Connect.");
    return false;
  }
}

checkStatus().catch(console.error);
