const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { PGlite } = require('./package/dist/index.cjs')
const { pgcrypto } = require('./package/dist/contrib/pgcrypto.cjs')
const migration = readFileSync('supabase/migrations/20261119000000_control_hardening.sql', 'utf8')
const oldSchema = execFileSync('git', ['show', 'c78b4d8:supabase/schema.sql'], { encoding: 'utf8' })
const template = readFileSync('supabase/tests/control_hardening.sql', 'utf8')

async function run(legacy) {
  const script = template
    .replace(/\\if :\{\?legacy_schema\}\r?\n([\s\S]*?)(?:\\else\r?\n([\s\S]*?))?\\endif/g, (_, present, absent) => legacy ? present : (absent ?? ''))
    .replace(/^\\set.*$/gm, '')
    .replace(/^\\i :legacy_schema$/gm, () => oldSchema)
    .replace(/^\\ir .*$/gm, () => migration)
    .replace('current_database()', "'control_test_local'")
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await db.exec(script)
    console.log(legacy ? 'SQL fixture upgrade passed' : 'SQL fixture fresh passed')
  } finally {
    await db.close()
  }
}
run(false).then(() => run(true)).catch((error) => {
  console.error(error.message, error.position, error.where, error.code, error.query?.slice(0, 80))
  process.exitCode = 1
})
