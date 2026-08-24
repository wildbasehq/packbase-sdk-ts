const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

interface OpenApiOperation {
    operationId?: unknown
}

interface OpenApiDocument {
    paths: Record<string, Record<string, OpenApiOperation>>
}

export function getOperationIds(document: OpenApiDocument): string[] {
    const operationIds: string[] = []

    for (const [path, operations] of Object.entries(document.paths)) {
        for (const [method, operation] of Object.entries(operations)) {
            if (!HTTP_METHODS.has(method)) continue
            if (typeof operation.operationId !== 'string') {
                throw new Error(
                    `OpenAPI ${method.toUpperCase()} ${path} is missing operationId`,
                )
            }
            operationIds.push(operation.operationId)
        }
    }

    const duplicateIds = operationIds.filter(
        (operationId, index) => operationIds.indexOf(operationId) !== index,
    )
    if (duplicateIds.length > 0) {
        throw new Error(
            `Duplicate OpenAPI operation IDs: ${[...new Set(duplicateIds)].join(', ')}`,
        )
    }

    return operationIds
}
