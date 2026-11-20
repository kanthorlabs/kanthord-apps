import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "yaml";

const ROOT = join(import.meta.dirname, "..");
const OPENAPI_DIR = join(ROOT, "test", "openapi");
const DAEMON = join(ROOT, "mock", "daemon.mjs");
const TOKEN = `contract-test-${crypto.randomUUID()}`;
const START_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 10000;
const METHODS = ["get", "put", "post", "delete", "patch"];

const ROUTES_WITHOUT_OPERATION = [
  {
    method: "PUT",
    path: "/api/mock/container",
    reason:
      "The mock sets the container placement reason for the dashboard demo. The engine has no such control.",
  },
  {
    method: "GET",
    path: "/api/openapi.yaml",
    reason: "The engine serves the document itself, outside the operation registry.",
  },
];

const loaded = new Map();

const loadYaml = (file) => {
  if (!loaded.has(file)) loaded.set(file, parse(readFileSync(file, "utf8")));
  return loaded.get(file);
};

const decodePointer = (pointer) =>
  pointer
    .split("/")
    .slice(1)
    .map((part) => decodeURIComponent(part).replaceAll("~1", "/").replaceAll("~0", "~"));

const followPointer = (document, pointer) =>
  decodePointer(pointer).reduce((node, key) => node[key], document);

const splitRef = (ref, fromFile) => {
  const [filePart, pointer = ""] = ref.split("#");
  const file = filePart === "" ? fromFile : join(fromFile, "..", filePart);
  return { file, pointer };
};

const pathRegex = (template) =>
  new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+")}$`);

const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
const validators = new Map();

const addDocument = (file) => {
  ajv.addSchema({ ...loadYaml(file), $id: pathToFileURL(file).href }, undefined, false);
};

const validatorOf = (file, schemaRef) => {
  const key = `${file}|${schemaRef}`;
  if (!validators.has(key)) {
    const uri = new URL(schemaRef, pathToFileURL(file)).href;
    validators.set(key, ajv.compile({ $ref: uri }));
  }
  return validators.get(key);
};

const resolveResponse = (response, file) => {
  if (response.$ref === undefined) return { response, file };
  const target = splitRef(response.$ref, file);
  return resolveResponse(followPointer(loadYaml(target.file), target.pointer), target.file);
};

const responseOf = (rawResponse, operationFile) => {
  const { response, file } = resolveResponse(rawResponse, operationFile);
  const content = response.content ?? {};
  if (content["text/event-stream"] !== undefined) return { kind: "stream" };
  const schema = content["application/json"]?.schema;
  if (schema === undefined && Object.keys(content).length > 0) {
    return { kind: "other", types: Object.keys(content) };
  }
  if (schema === undefined) return { kind: "empty" };
  if (schema.$ref === undefined) throw new Error(`Inline response schema in ${file}`);
  return { kind: "json", validate: validatorOf(file, schema.$ref) };
};

const loadOperations = () => {
  const index = join(OPENAPI_DIR, "openapi.yaml");
  const operations = [];
  for (const [template, item] of Object.entries(loadYaml(index).paths)) {
    const target = splitRef(item.$ref, index);
    addDocument(target.file);
    const pathItem = followPointer(loadYaml(target.file), target.pointer);
    for (const method of METHODS.filter((name) => pathItem[name] !== undefined)) {
      operations.push({
        method: method.toUpperCase(),
        template,
        regex: pathRegex(template),
        file: target.file,
        raw: pathItem[method],
      });
    }
  }
  addDocument(join(OPENAPI_DIR, "openapi", "shared", "components.yaml"));
  return operations;
};

const operations = loadOperations();

const operationOf = (method, pathname) =>
  operations
    .filter((operation) => operation.method === method && operation.regex.test(pathname))
    .sort((a, b) => a.template.split("{").length - b.template.split("{").length)[0];

const pathnameOf = (path) => path.split("?")[0];

const isExcepted = (method, pathname) =>
  ROUTES_WITHOUT_OPERATION.some((entry) => entry.method === method && entry.path === pathname);

const problemsOf = (method, path, status, contentType, text) => {
  const label = `${method} ${path} -> ${status}`;
  const pathname = pathnameOf(path);
  const operation = operationOf(method, pathname);
  if (operation === undefined)
    return isExcepted(method, pathname) ? [] : [`${label}: no engine operation`];
  const declared = operation.raw.responses[String(status)];
  if (declared === undefined) {
    return [`${label}: the engine declares ${Object.keys(operation.raw.responses).join(", ")}`];
  }
  const expected = responseOf(declared, operation.file);
  if (expected.kind === "stream") {
    return contentType.startsWith("text/event-stream")
      ? []
      : [`${label}: content type ${contentType} is not text/event-stream`];
  }
  if (expected.kind === "other") {
    return expected.types.some((type) => contentType.startsWith(type))
      ? []
      : [`${label}: content type ${contentType} is not ${expected.types.join(" or ")}`];
  }
  if (expected.kind === "empty") return text === "" ? [] : [`${label}: the body is not empty`];
  if (!contentType.startsWith("application/json")) {
    return [`${label}: content type ${contentType} is not application/json`];
  }
  if (expected.validate(JSON.parse(text))) return [];
  return expected.validate.errors.map(
    (error) => `${label}: ${error.instancePath || "/"} ${error.message}`,
  );
};

const requestsOf = (route, requests) =>
  requests.filter(
    (request) => request.method === route.method && route.pattern.test(pathnameOf(request.path)),
  );

export const routesWithoutRequest = (routeList, requests) =>
  routeList.filter((route) => requestsOf(route, requests).length === 0);

export const routesWithoutOperation = (routeList, requests) =>
  routeList.filter((route) => {
    const excepted = ROUTES_WITHOUT_OPERATION.some(
      (entry) => entry.method === route.method && route.pattern.test(entry.path),
    );
    return (
      !excepted &&
      !requestsOf(route, requests).some(
        (request) => operationOf(request.method, pathnameOf(request.path)) !== undefined,
      )
    );
  });

export const describeRoute = (route) => `${route.method} ${route.pattern}`;

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

export const startMock = async (extraEnvironment = {}) => {
  const port = await freePort();
  const child = spawn(process.execPath, [DAEMON], {
    env: {
      ...process.env,
      KANTHORD_HTTP_PORT: String(port),
      KANTHORD_DEV_TOKEN: TOKEN,
      KANTHORD_MOCK_UNHEALTHY: "0",
      KANTHORD_MOCK_EMPTY: "0",
      ...extraEnvironment,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The mock did not start.")),
        START_TIMEOUT_MS,
      );
      child.once("error", reject);
      child.stdout.on("data", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } catch (error) {
    child.kill();
    throw error;
  }
  return { base: `http://127.0.0.1:${port}`, child };
};

export const stopMock = (mock) =>
  new Promise((resolve) => {
    if (mock.child.exitCode !== null) return resolve();
    mock.child.once("exit", resolve);
    mock.child.kill();
  });

let keySequence = 0;
const idempotencyKey = () => `idempotency_key_0${String(keySequence++).padStart(25, "0")}`;

export const makeClient = (mock) => {
  const sent = [];
  const problems = [];
  const call = async (method, path, { body, token = TOKEN } = {}) => {
    const headers = { "idempotency-key": idempotencyKey() };
    if (token !== null) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const controller = new AbortController();
    const timeout = new Error(`${method} ${path} timed out after ${REQUEST_TIMEOUT_MS} ms`);
    const timer = setTimeout(() => controller.abort(timeout), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${mock.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const stream = contentType.startsWith("text/event-stream");
      const text = stream ? "" : await response.text();
      if (stream) controller.abort();
      sent.push({ method, path });
      const found = problemsOf(method, path, response.status, contentType, text);
      problems.push(...found);
      const parsed =
        contentType.startsWith("application/json") && text !== "" ? JSON.parse(text) : text;
      return { status: response.status, body: parsed, problems: found };
    } catch (error) {
      if (controller.signal.reason === timeout) throw timeout;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  return { call, sent, problems };
};
