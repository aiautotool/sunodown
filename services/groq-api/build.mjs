import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const out = new URL('./dist/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [source, target] of [
  ['app/api/karaoke/groq/route.ts', 'route.mjs'],
  ['app/lib/karaoke.ts', 'karaoke.mjs'],
  ['components/v4/lyrics-clean.ts', 'lyrics-clean.mjs'],
]) {
  let code = stripTypeScriptTypes(readFileSync(new URL(source, root), 'utf8'));
  code = code.replace(/import \{[^}]*\} from ['"]next\/server['"];/, "const NextResponse = { json: (data, init) => Response.json(data, init) };")
    .replace("from '@/app/lib/karaoke'", "from './karaoke.mjs'")
    .replace("from '@/components/v4/lyrics-clean'", "from './lyrics-clean.mjs'")
    .replace("from '../../components/v4/lyrics-clean.ts'", "from './lyrics-clean.mjs'");
  writeFileSync(new URL(target, out), code);
}
console.log('Built standalone Groq API:', fileURLToPath(out));
