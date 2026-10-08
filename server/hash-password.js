import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const input = process.stdin;

if (!input.isTTY) {
  console.error('Run this command in an interactive terminal so the password can be entered privately.');
  process.exit(1);
}

emitKeypressEvents(input);
input.setRawMode(true);
input.resume();
process.stdout.write('Admin password (minimum 12 characters, input hidden): ');

let password = '';
input.on('keypress', async (character, key) => {
  if (key.ctrl && key.name === 'c') {
    input.setRawMode(false);
    process.exit(1);
  }

  if (key.name === 'return') {
    input.setRawMode(false);
    process.stdout.write('\n');
    input.pause();

    if (password.length < 12) {
      console.error('Use a password with at least 12 characters.');
      process.exitCode = 1;
      return;
    }

    const salt = randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    process.stdout.write(`ADMIN_PASSWORD_HASH=${salt}:${hash.toString('hex')}\n`);
    password = '';
    return;
  }

  if (key.name === 'backspace') {
    password = password.slice(0, -1);
  } else if (character && !key.ctrl && !key.meta && password.length < 256) {
    password += character;
  }
});