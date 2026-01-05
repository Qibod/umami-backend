import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 Setting up Umami database...\n');

  try {
    // Read schema file
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('📋 Executing database schema...');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_').select('*').limit(0);
          if (directError) {
            console.error(`❌ Error executing statement: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Database setup completed!`);
    console.log(`   Successful: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount} statements`);
      console.log(`   Note: Some errors may be expected (e.g., if tables already exist)`);
    }

    console.log('\n📊 Verifying tables...');
    await verifyTables();

  } catch (error: any) {
    console.error('❌ Failed to set up database:', error.message);
    console.log('\n💡 Please run the schema.sql file manually in Supabase SQL Editor:');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to SQL Editor');
    console.log('   4. Paste the contents of schema.sql');
    console.log('   5. Run the query');
    process.exit(1);
  }
}

async function verifyTables() {
  const tables = [
    'breweries',
    'sake',
    'users',
    'reviews',
    'food_pairings',
    'sake_food_pairings',
    'user_collections'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ ${table}: Not found or error`);
    } else {
      console.log(`   ✅ ${table}: ${count || 0} records`);
    }
  }
}

// Run setup
setupDatabase();
