import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// Points the native apps at the deployed site, then syncs the Android/iOS projects.
const url = process.argv[2] || process.env.CAP_SERVER_URL;
if (!url || !/^https:\/\//.test(url)) {
  console.error('Usage: npm run cap:sync -- https://your-deployed-site.example');
  process.exit(1);
}

const file = new URL('../capacitor.config.json', import.meta.url);
const config = JSON.parse(await readFile(file, 'utf8'));
config.server = { url, cleartext: false };
await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);

const result = spawnSync('npx', ['cap', 'sync'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
