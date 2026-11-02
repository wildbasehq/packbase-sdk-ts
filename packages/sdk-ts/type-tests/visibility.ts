import { from, PackbaseSDK, type HowlReadContext, type HowlReadOptions, type Paginated, type ProfileRelationship } from '../src'

const pb = new PackbaseSDK({autoLogin: false})
const records: Promise<Paginated<ProfileRelationship>> = pb.me.blocks.list({limit: 10})
const context: HowlReadContext = 'feed'
const options: HowlReadOptions = {context}
void pb.howls('id', options)
void from('posts').context('direct').build()
void records
// @ts-expect-error Relationship tables are never available through search.
from('profile_blocks')
// @ts-expect-error Relationship tables are never available through search.
from('profile_mutes')
// @ts-expect-error No context can bypass blocking.
from('posts').context('unfiltered')
