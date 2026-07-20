/** Decodes and validates one setting value. */
export type SettingDecoder<T> = (value: unknown) => T

/** A decoder for each key in a desired settings result. */
export type SettingDecoderMap<T extends object> = {
    [K in keyof T]: SettingDecoder<T[K]>
}

/**
 * Decodes selected settings key-by-key. Extra raw keys are ignored, while
 * missing keys are passed to their decoder as `undefined`.
 */
export function decodeSettings<T extends object>(
    raw: Record<string, unknown>,
    decoders: SettingDecoderMap<T>,
): T {
    const decoded: Partial<T> = {}

    for (const key of Object.keys(decoders) as (keyof T)[]) {
        decoded[key] = decoders[key](raw[key as string])
    }

    return decoded as T
}
