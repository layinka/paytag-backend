import { generateEntitySecret } from "@circle-fin/developer-controlled-wallets";

/**
 * Generate Circle Entity Secret
 * Run: npm run generate:entity-secret
 */
console.log('🔐 Generating Circle Entity Secret...\n');

const entitySecret = generateEntitySecret();

console.log('✅ Entity Secret Generated:\n');
console.log('════════════════════════════════════════════════════════════');
console.log(entitySecret);
console.log('════════════════════════════════════════════════════════════');
console.log('\n📝 Add this to your .env file:');
console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
console.log('\n⚠️  IMPORTANT: Store this securely and never commit to version control!');
