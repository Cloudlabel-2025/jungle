import { readFile, writeFile } from 'node:fs/promises';
const { url } = JSON.parse(await readFile('.data/shared-chat-inspection/source.json', 'utf8'));
const original = new URL(url);
const endpoints = [['page', original.href], ['public-data', `https://chatgpt.com/backend-api/share/${original.pathname.split('/').at(-1)}`]];
await Promise.all(endpoints.map(async ([name, address]) => {
  try {
    const response = await fetch(address, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', Accept: name === 'page' ? 'text/html' : 'application/json' } });
    const body = await response.text();
    await writeFile(`.data/shared-chat-inspection/${name}.txt`, body);
    console.log(JSON.stringify({ name, status: response.status, contentType: response.headers.get('content-type'), bytes: Buffer.byteLength(body), title: body.match(/<title>(.*?)<\/title>/s)?.[1], jsonKeys: response.headers.get('content-type')?.includes('json') ? Object.keys(JSON.parse(body)).slice(0, 12) : undefined }));
  } catch (error) { console.log(JSON.stringify({ name, error: error.name })); }
}));
