import type { Howl } from '../src/types/howl'

declare const howl: Howl

const concreteRecordId: string = howl.id
const canonicalInteractionId: string | undefined = howl.canonical_id
const legacyRehowlId: string | undefined = howl.rehowl_id

void concreteRecordId
void canonicalInteractionId
void legacyRehowlId
