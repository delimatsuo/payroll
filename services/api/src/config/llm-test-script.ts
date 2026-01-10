/**
 * Test LLM Configuration
 * Run: npm run test:llm
 */

import { testLLMConfig, getModelInfo, getLLMService } from './llm';

async function main() {
  console.log('=== Escala Simples - LLM Configuration Test ===\n');

  // Show current config
  const info = getModelInfo();
  console.log('Model Info:');
  console.log(`  Provider: ${info.provider}`);
  console.log(`  Model: ${info.model}`);
  console.log(`  Fallback: ${info.fallback}`);
  console.log('');

  // Test basic connection
  console.log('Testing LLM connection...');
  const success = await testLLMConfig();

  if (success) {
    console.log('✅ LLM connection successful!\n');

    // Test restriction parsing
    console.log('Testing restriction parsing...');
    const service = getLLMService();

    const testMessages = [
      'Quarta não posso',
      'Terça e quinta depois das 18h',
      'Posso qualquer horário',
    ];

    for (const msg of testMessages) {
      console.log(`\nInput: "${msg}"`);
      const restrictions = await service.parseRestrictions(msg);
      console.log('Output:', JSON.stringify(restrictions, null, 2));
    }

    console.log('\n✅ All tests passed!');
  } else {
    console.log('❌ LLM connection failed!');
    process.exit(1);
  }
}

main().catch(console.error);
