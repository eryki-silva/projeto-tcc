import { spawn } from 'node:child_process';
import { createApp } from './server.mjs';

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const server = createApp();
server.requestTimeout = 120_000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está ocupada. Feche a outra instância ou defina PORT.` : 'Não foi possível iniciar o servidor local.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Dota Coach iniciado na porta ${port}. Feche esta janela para encerrar.`);
  const url = `http://127.0.0.1:${port}`;
  const command = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const browser = spawn(command[0], command[1], { stdio: 'ignore', detached: true });
  browser.on('error', () => console.log('Abra o navegador local na porta indicada.'));
  browser.unref();
});
