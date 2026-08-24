/** Small browser-compatible event emitter with event-specific argument types. */
export class TypedEventEmitter<
    TEvents extends { [K in keyof TEvents]: unknown[] },
> {
    private readonly listeners = new Map<keyof TEvents, unknown[]>()

    on<K extends keyof TEvents>(
        event: K,
        listener: (...args: TEvents[K]) => void,
    ): void {
        const eventListeners = this.listeners.get(event) ?? []
        eventListeners.push(listener)
        this.listeners.set(event, eventListeners)
    }

    off<K extends keyof TEvents>(
        event: K,
        listener: (...args: TEvents[K]) => void,
    ): void {
        const eventListeners = this.listeners.get(event)
        if (!eventListeners) return

        const index = eventListeners.indexOf(listener)
        if (index !== -1) eventListeners.splice(index, 1)
        if (eventListeners.length === 0) this.listeners.delete(event)
    }

    emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
        const eventListeners = this.listeners.get(event)
        if (!eventListeners) return

        eventListeners.forEach(listener =>
            (listener as (...eventArgs: TEvents[K]) => void)(...args),
        )
    }
}
