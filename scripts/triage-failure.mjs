import { readFileSync, existsSync } from 'node:fs';

const { GH_TOKEN, REPO, RUN_URL } = process.env;
const tail = (file, n = 6000) => (existsSync(file) ? readFileSync(file, 'utf8').slice(-n) : '(no output)');
const logs = `BUILD:\n${tail('build.log')}\n\nUNIT TESTS:\n${tail('unit.log')}\n\nAUDIT:\n${tail('audit.log', 2000)}`;

async function suggestFix() {
  try {
    const res = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a senior engineer triaging a failed CI run for a React + Express ecommerce app. Give: 1) likely root cause, 2) the file(s) to change, 3) a suggested patch as a unified diff if confident. Be concise. Do not invent files.' },
          { role: 'user', content: logs },
        ],
      }),
    });
    if (!res.ok) return `LLM unavailable (HTTP ${res.status}).`;
    return (await res.json()).choices?.[0]?.message?.content ?? 'LLM returned no content.';
  } catch (error) {
    return `LLM unavailable: ${error.message}`;
  }
}

const analysis = await suggestFix();
const body = `Automated QA failed: ${RUN_URL}\n\n## AI triage (suggestion only, review before applying)\n\n${analysis}\n\n<details><summary>Log tails</summary>\n\n\`\`\`\n${logs.slice(-5000)}\n\`\`\`\n</details>`;

const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });

const open = await (await api('/issues?state=open&labels=automated-qa&per_page=1')).json();
if (Array.isArray(open) && open.length) {
  await api(`/issues/${open[0].number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
} else {
  await api('/issues', { method: 'POST', body: JSON.stringify({ title: 'Automated QA failure', body, labels: ['automated-qa'] }) });
}
