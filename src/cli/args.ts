export type CliCommand =
  | { readonly kind: 'serve' }
  | { readonly kind: 'setup' }
  | { readonly kind: 'doctor' }
  | { readonly kind: 'gateway' }
  | { readonly kind: 'version' }
  | { readonly kind: 'help' }
  | { readonly kind: 'unknown'; readonly arg: string };

/** Maps the first CLI argument to a command. No args means `serve`. */
export const parseArgs = (argv: readonly string[]): CliCommand => {
  const [first] = argv;
  switch (first) {
    case undefined:
    case 'serve':
    case 'run':
    case 'start':
      return { kind: 'serve' };
    case 'setup':
    case 'wizard':
    case 'init':
      return { kind: 'setup' };
    case 'doctor':
    case 'check':
      return { kind: 'doctor' };
    case 'gateway':
    case 'daemon':
      return { kind: 'gateway' };
    case '--version':
    case '-v':
    case 'version':
      return { kind: 'version' };
    case '--help':
    case '-h':
    case 'help':
      return { kind: 'help' };
    default:
      return { kind: 'unknown', arg: first };
  }
};
