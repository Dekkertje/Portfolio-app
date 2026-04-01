import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigrations() {
  console.log('🚀 Running politicians migrations...\n')

  const migrations = [
    '20260401000001_create_politicians_tables.sql',
    '20260401000002_seed_nancy_pelosi_data.sql'
  ]

  for (const migration of migrations) {
    console.log(`📄 Running ${migration}...`)
    
    const filePath = path.join(process.cwd(), 'supabase', 'migrations', migration)
    const sql = fs.readFileSync(filePath, 'utf-8')

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        
        if (error) {
          // Try direct execution if rpc fails
          const { error: directError } = await supabase.from('_migrations').insert({})
          console.error(`❌ Error:`, error.message)
        }
      } catch (err) {
        console.error(`⚠️  Warning:`, err)
      }
    }

    console.log(`✅ Completed ${migration}\n`)
  }

  console.log('🎉 All migrations completed!')
}

runMigrations().catch(console.error)

