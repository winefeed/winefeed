import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

beforeAll(async () => {
  // Verify required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  console.log('\n🧪 Test Environment Initialized');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
});

afterAll(async () => {
  console.log('\n✅ Test Suite Complete\n');
});
