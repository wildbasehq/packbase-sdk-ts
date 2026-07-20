/** A primitive value that can be represented in JSON. */
export type JsonPrimitive = string | number | boolean | null

/** A recursively typed JSON object. */
export interface JsonObject {
    [key: string]: JsonValue
}

/** Any value that can be represented in JSON. */
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
