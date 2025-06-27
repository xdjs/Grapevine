import { db } from './supabase';
import postgres from 'postgres';

async function investigateSchema() {
  if (!db) {
    console.log('No database connection available');
    return;
  }

  try {
    console.log('🔍 Investigating MusicNerd database schema...\n');

    // Get all tables in the public schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const client = postgres(process.env.CONNECTION_STRING!);
    const tables = await client.unsafe(tablesQuery);
    
    console.log('📋 Available Tables:');
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });
    console.log('');

    // For each table, get its columns
    for (const table of tables) {
      const tableName = table.table_name;
      
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `;
      
      const columns = await client.unsafe(columnsQuery);
      
      console.log(`🗂️  Table: ${tableName}`);
      columns.forEach((col: any) => {
        console.log(`    ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ''}`);
      });
      
      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM "${tableName}";`;
      try {
        const count = await client.unsafe(countQuery);
        console.log(`    📊 Rows: ${count[0].count}`);
      } catch (e) {
        console.log(`    📊 Rows: Unable to count`);
      }
      console.log('');
    }

    // Look for artist-related tables specifically
    const artistTables = tables.filter((t: any) => 
      t.table_name.toLowerCase().includes('artist') || 
      t.table_name.toLowerCase().includes('musician') ||
      t.table_name.toLowerCase().includes('user')
    );

    if (artistTables.length > 0) {
      console.log('🎵 Potential Artist Tables Found:');
      for (const table of artistTables) {
        const sampleQuery = `SELECT * FROM "${table.table_name}" LIMIT 3;`;
        try {
          const sample = await client.unsafe(sampleQuery);
          console.log(`\n📝 Sample data from ${table.table_name}:`);
          console.log(JSON.stringify(sample, null, 2));
        } catch (e) {
          console.log(`\n❌ Could not query ${table.table_name}: ${e}`);
        }
      }
    }

    await client.end();
    
  } catch (error) {
    console.error('❌ Error investigating schema:', error);
  }
}

// Run the investigation
investigateSchema();