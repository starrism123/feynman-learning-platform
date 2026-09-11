const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

function loadOpenApiDocument() {
  const openApiPath = path.join(__dirname, "../../docs/openapi.yaml");
  return YAML.parse(fs.readFileSync(openApiPath, "utf8"));
}

module.exports = { loadOpenApiDocument };
