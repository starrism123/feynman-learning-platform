const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        Buffer: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
    },
  },
  {
    files: ["examples/ajax-demo/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        document: "readonly",
        fetch: "readonly",
        performance: "readonly",
        window: "readonly",
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      "node_modules.incomplete-*/**",
      "coverage/**",
      ".codex-ppt02/**",
      "练习/**",
      "output/**",
      "feynman-platform-frontend/**",
      "whisper-service/**",
      "video/**",
      "报告/**",
    ],
  },
];
