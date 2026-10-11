import { z } from 'zod';
import * as s from './schemas';

type Method = 'get' | 'post' | 'patch' | 'delete';

export interface RouteSpec {
  method: Method;
  /** Path under /api, with {param} placeholders. */
  path: string;
  summary: string;
  query?: z.ZodObject;
  body?: z.ZodType;
  /** Set for multipart uploads instead of `body`. */
  multipart?: Record<string, { type: 'string'; format?: 'binary'; enum?: readonly string[] }>;
  /** Left out: 204 with no body. */
  response?: z.ZodType;
  /** Set when the response is a file rather than JSON. */
  binaryResponse?: boolean;
  status?: 200 | 201 | 204;
}

/** Every endpoint the Worker serves. The API test checks this list against the real routes. */
export const routes: RouteSpec[] = [
  { method: 'get', path: '/me', summary: 'The signed-in staff member and their business', response: s.meResponseSchema },
  { method: 'get', path: '/staff', summary: 'Staff of the business, for the teacher picker', response: s.staffListResponseSchema },
  { method: 'get', path: '/dashboard', summary: "Today's and tomorrow's sessions, the attention list and counts", query: s.dashboardQuerySchema, response: s.dashboardResponseSchema },

  { method: 'get', path: '/members', summary: 'Members with their derived status', query: s.membersQuerySchema, response: s.membersResponseSchema },
  { method: 'post', path: '/members', summary: 'Add a member (needs the accuracy consent)', body: s.memberInputSchema, response: s.memberResponseSchema, status: 201 },
  { method: 'get', path: '/members/{id}', summary: 'A member with membership, last visits, payments and documents', response: s.memberDetailResponseSchema },
  { method: 'patch', path: '/members/{id}', summary: 'Change a member', body: s.memberPatchSchema, response: s.memberResponseSchema },
  { method: 'delete', path: '/members/{id}', summary: 'Delete a member and their stored files' },

  { method: 'get', path: '/offering-groups', summary: 'Class-type groups', response: s.offeringGroupsResponseSchema },
  { method: 'post', path: '/offering-groups', summary: 'Add a group', body: s.offeringGroupInputSchema, response: s.offeringGroupResponseSchema, status: 201 },
  { method: 'get', path: '/offerings', summary: 'Class types with the number of sessions this week', response: s.offeringsResponseSchema },
  { method: 'post', path: '/offerings', summary: 'Add a class type', body: s.offeringInputSchema, response: s.offeringResponseSchema, status: 201 },
  { method: 'patch', path: '/offerings/{id}', summary: 'Change a class type', body: s.offeringPatchSchema, response: s.offeringResponseSchema },

  { method: 'get', path: '/sessions', summary: 'Sessions between two dates', query: s.sessionsQuerySchema, response: s.sessionsResponseSchema },
  { method: 'post', path: '/sessions', summary: 'Schedule a session from a class type', body: s.sessionInputSchema, response: s.sessionResponseSchema, status: 201 },
  { method: 'get', path: '/sessions/{id}', summary: 'A session with its attendees', response: s.sessionDetailResponseSchema },
  { method: 'patch', path: '/sessions/{id}', summary: 'Change a session', body: s.sessionPatchSchema, response: s.sessionResponseSchema },
  { method: 'delete', path: '/sessions/{id}', summary: 'Delete a session' },

  { method: 'post', path: '/sessions/{id}/visits', summary: 'Check a member in', body: s.visitInputSchema, response: s.visitResponseSchema, status: 201 },
  { method: 'delete', path: '/visits/{id}', summary: 'Undo a check-in' },

  { method: 'get', path: '/plans', summary: 'Membership plans', response: s.plansResponseSchema },
  { method: 'patch', path: '/plans/{id}', summary: 'Change a plan name or price', body: s.planPatchSchema, response: s.planResponseSchema },

  { method: 'post', path: '/memberships', summary: 'Start a membership', body: s.membershipInputSchema, response: s.membershipResponseSchema, status: 201 },
  { method: 'post', path: '/memberships/{id}/renew', summary: 'Start the following one-month period', body: s.membershipRenewSchema, response: s.membershipResponseSchema, status: 201 },
  { method: 'post', path: '/memberships/{id}/freeze', summary: 'Freeze until a date, or lift the freeze', body: s.membershipFreezeSchema, response: s.membershipResponseSchema },

  { method: 'get', path: '/payments', summary: 'Payments between two dates, with the total', query: s.paymentsQuerySchema, response: s.paymentsResponseSchema },
  { method: 'post', path: '/payments', summary: 'Record a payment', body: s.paymentInputSchema, response: s.paymentResponseSchema, status: 201 },

  {
    method: 'post',
    path: '/documents',
    summary: 'Upload a scanned upisnica (PDF, JPG, PNG or HEIC, up to 20 MB)',
    multipart: { file: { type: 'string', format: 'binary' }, source: { type: 'string', enum: s.DOCUMENT_SOURCES } },
    response: s.documentResponseSchema,
    status: 201,
  },
  { method: 'get', path: '/documents/{id}/file', summary: 'The stored file', binaryResponse: true },
  { method: 'patch', path: '/documents/{id}', summary: 'Link a document to a member and store the recognised fields', body: s.documentPatchSchema, response: s.documentResponseSchema },
  { method: 'delete', path: '/documents/{id}', summary: 'Delete a document and its file' },

  { method: 'get', path: '/sync', summary: 'Rows changed since the cursor', query: s.syncQuerySchema, response: s.syncPullResponseSchema },
  { method: 'post', path: '/sync', summary: 'Push offline changes; last write wins by updated_at', body: s.syncPushSchema, response: s.syncPushResponseSchema },
];

type JsonSchema = Record<string, unknown>;

/**
 * Converts a zod schema. Named schemas (Member, SessionView, …) come out as $ref and are
 * collected into `components`, so generated clients get one type per name.
 */
function converter() {
  const components: Record<string, JsonSchema> = {};
  const relink = (schema: unknown): JsonSchema => JSON.parse(JSON.stringify(schema).replaceAll('#/$defs/', '#/components/schemas/')) as JsonSchema;
  const jsonSchema = (schema: z.ZodType): JsonSchema => {
    const out = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema & { $defs?: Record<string, unknown> };
    for (const [name, def] of Object.entries(out.$defs ?? {})) components[name] = relink(def);
    delete out.$defs;
    delete out.$schema;
    return relink(out);
  };
  return { components, jsonSchema, json: (schema: z.ZodType) => ({ 'application/json': { schema: jsonSchema(schema) } }) };
}

/** The OpenAPI 3.1 document for the API, built from the zod schemas. */
export function buildOpenApi() {
  const { components, jsonSchema, json } = converter();
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const parameters: unknown[] = [];
    for (const match of route.path.matchAll(/\{(\w+)\}/g)) {
      parameters.push({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
    }
    if (route.query) {
      const shape = jsonSchema(route.query) as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(shape.properties ?? {})) {
        parameters.push({ name, in: 'query', required: shape.required?.includes(name) ?? false, schema });
      }
    }

    const status = route.status ?? (route.response || route.binaryResponse ? 200 : 204);
    const success = route.binaryResponse
      ? { description: 'The file', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }
      : route.response
        ? { description: 'OK', content: json(route.response) }
        : { description: 'Done' };

    const requestBody = route.multipart
      ? { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: route.multipart, required: ['file'] } } } }
      : route.body
        ? { required: true, content: json(route.body) }
        : undefined;

    paths[route.path] ??= {};
    paths[route.path]![route.method] = {
      summary: route.summary,
      ...(parameters.length ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: {
        [status]: success,
        default: { description: 'Error', content: json(s.errorResponseSchema) },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Prana CRM API',
      version: '1.0.0',
      description: 'Dates are YYYY-MM-DD, instants are UTC ISO 8601, money is integer cents. Every request needs a Firebase ID token.',
    },
    servers: [{ url: '/api' }],
    security: [{ firebase: [] }],
    components: { securitySchemes: { firebase: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' } }, schemas: components },
    paths,
  };
}
