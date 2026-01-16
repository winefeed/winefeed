require('dotenv').config({ path: '.env.local' });

// Import the actual service
const { importDocumentService } = require('../lib/import-document-service');

const importId = '68406ec1-4972-4b77-8335-06b21f31f757';
const tenantId = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000001';

(async () => {
  console.log('Testing importDocumentService.generate5369() directly...\n');

  try {
    const result = await importDocumentService.generate5369(
      importId,
      tenantId,
      userId
    );

    console.log('✅ SUCCESS! Document generated:');
    console.log('Document ID:', result.document.id);
    console.log('Type:', result.document.type);
    console.log('Version:', result.document.version);
    console.log('Storage Path:', result.document.storage_path);
    console.log('SHA256:', result.document.sha256);
    console.log('Created At:', result.document.created_at);

  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Full error:', error);
  }

  process.exit(0);
})();
