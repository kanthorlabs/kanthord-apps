const headerPattern = /^(\w+)(?:\(([^)]+)\))?: (.+)$/;

const shape = {
  rules: {
    'header-shape': (parsed) => [
      headerPattern.test(parsed.header ?? ''),
      'header must match "type(scope): subject"',
    ],
  },
};

export default {
  parserPreset: {
    parserOpts: {
      headerPattern,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  plugins: [shape],
  rules: {
    'header-shape': [2, 'always'],
    'header-max-length': [2, 'always', 100],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'refactor',
        'test',
        'docs',
        'style',
        'perf',
        'ci',
        'build',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
  },
};
