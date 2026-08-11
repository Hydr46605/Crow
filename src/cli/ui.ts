import { createInterface } from 'node:readline';
import { bold, cyan, dim, green, red, yellow } from './colors.js';

export const step = (title: string): void => {
  process.stdout.write(`\n${cyan(bold(`» ${title}`))}\n`);
};

export const success = (message: string): void => {
  process.stdout.write(`${green('✓')} ${message}\n`);
};

export const failure = (message: string): void => {
  process.stderr.write(`${red('✗')} ${message}\n`);
};

export const warning = (message: string): void => {
  process.stdout.write(`${yellow('!')} ${message}\n`);
};

export const info = (message: string): void => {
  process.stdout.write(`${dim(message)}\n`);
};

const askText = (question: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/** Asks a normal, visible question and returns the trimmed answer. */
export const ask = (question: string): Promise<string> => askText(`${question} `);

/** Asks a question while hiding the typed input (for secrets). */
export const askHidden = (question: string): Promise<string> => {
  process.stdout.write(`${question} `);

  const input = process.stdin;
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve) => {
    const chars: string[] = [];

    const onData = (chunk: Buffer): void => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          process.stdout.write('\n');
          cleanup();
          resolve(chars.join(''));
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          process.exit(1);
        }
        if (ch === '\u007f' || ch === '\b') {
          chars.pop();
        } else if (ch >= ' ') {
          chars.push(ch);
        }
      }
    };

    const cleanup = (): void => {
      input.removeListener('data', onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    input.on('data', onData);
  });
};

/** Asks a yes/no question, defaulting to "no". */
export const confirm = async (question: string): Promise<boolean> => {
  const answer = await askText(`${question} [y/N] `);
  return /^y(es)?$/i.test(answer);
};
