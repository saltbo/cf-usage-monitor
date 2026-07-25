import type { ProductName } from "../metrics";

const API_BASE_URL = "https://api.cloudflare.com/client/v4";
const CACHE_TTL_SECONDS = 15 * 60;
const CACHE_PREFIX = "resource-catalog-v1";
const PAGE_SIZE = 1_000;

export type ResourceNames = Partial<
  Record<ProductName, Record<string, string>>
>;

interface ResourceCatalogEnv {
  STATE: KVNamespace;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface ResourceDefinition {
  path: string;
  idField: string;
  nameField: string;
}

const RESOURCE_DEFINITIONS: Partial<
  Record<ProductName, ResourceDefinition>
> = {
  d1: {
    path: "d1/database",
    idField: "uuid",
    nameField: "name",
  },
  kv: {
    path: "storage/kv/namespaces",
    idField: "id",
    nameField: "title",
  },
  durable_objects: {
    path: "workers/durable_objects/namespaces",
    idField: "id",
    nameField: "name",
  },
  queues: {
    path: "queues",
    idField: "queue_id",
    nameField: "queue_name",
  },
  containers: {
    path: "containers/applications",
    idField: "id",
    nameField: "name",
  },
};

export async function loadAccountName(
  env: ResourceCatalogEnv,
): Promise<string> {
  return loadCached(
    env.STATE,
    cacheKey(env.CF_ACCOUNT_ID, "account"),
    readNonEmptyString,
    async () => {
      const result = await requestCloudflare(
        env.CF_API_TOKEN,
        `/accounts/${env.CF_ACCOUNT_ID}`,
      );
      return readField(result, "name", "account");
    },
  );
}

export async function loadResourceNames(
  env: ResourceCatalogEnv,
  products: readonly ProductName[],
): Promise<ResourceNames> {
  const requestedProducts = [...new Set(products)].filter(
    (product) => RESOURCE_DEFINITIONS[product],
  );
  const entries = await Promise.all(
    requestedProducts.map(async (product) => [
      product,
      await loadProductResourceNames(env, product),
    ] as const),
  );
  return Object.fromEntries(entries);
}

async function loadProductResourceNames(
  env: ResourceCatalogEnv,
  product: ProductName,
): Promise<Record<string, string>> {
  const definition = RESOURCE_DEFINITIONS[product];
  if (!definition) {
    return {};
  }
  return loadCached(
    env.STATE,
    cacheKey(env.CF_ACCOUNT_ID, product),
    readNameMap,
    async () => {
      const resources = await listCloudflareResources(
        env.CF_ACCOUNT_ID,
        env.CF_API_TOKEN,
        definition.path,
      );
      return Object.fromEntries(
        resources.map((resource, index) => [
          readField(resource, definition.idField, `${product}[${index}]`),
          readField(resource, definition.nameField, `${product}[${index}]`),
        ]),
      );
    },
  );
}

async function listCloudflareResources(
  accountId: string,
  apiToken: string,
  path: string,
): Promise<Record<string, unknown>[]> {
  const resources: Record<string, unknown>[] = [];
  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(PAGE_SIZE),
    });
    const response = await requestCloudflare(
      apiToken,
      `/accounts/${accountId}/${path}?${query}`,
    );
    if (!Array.isArray(response)) {
      throw new Error(`Cloudflare API ${path} result must be an array`);
    }
    resources.push(
      ...response.map((resource, index) =>
        readRecord(resource, `${path}[${index}]`),
      ),
    );
    if (response.length < PAGE_SIZE) {
      return resources;
    }
  }
}

async function requestCloudflare(
  apiToken: string,
  path: string,
): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });
  const body: unknown = await response.json();
  const envelope = readRecord(body, `Cloudflare API ${path}`);
  if (!response.ok || envelope.success !== true) {
    throw new Error(
      `Cloudflare API ${path} failed with HTTP ${response.status}: ${readApiError(envelope)}`,
    );
  }
  return envelope.result;
}

async function loadCached<T>(
  state: KVNamespace,
  key: string,
  parse: (value: unknown, name: string) => T,
  load: () => Promise<T>,
): Promise<T> {
  const cached = await state.get<unknown>(key, "json");
  if (cached !== null) {
    return parse(cached, key);
  }
  const value = await load();
  await state.put(key, JSON.stringify(value), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return value;
}

function cacheKey(accountId: string, resource: string): string {
  return `${CACHE_PREFIX}:${accountId}:${resource}`;
}

function readNameMap(value: unknown, name: string): Record<string, string> {
  const record = readRecord(value, name);
  return Object.fromEntries(
    Object.entries(record).map(([id, resourceName]) => [
      id,
      readNonEmptyString(resourceName, `${name}.${id}`),
    ]),
  );
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readField(
  value: unknown,
  field: string,
  name: string,
): string {
  return readNonEmptyString(readRecord(value, name)[field], `${name}.${field}`);
}

function readNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function readApiError(envelope: Record<string, unknown>): string {
  const errors = envelope.errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return "unknown error";
  }
  const error = errors[0];
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return String(error);
  }
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "unknown error";
}
