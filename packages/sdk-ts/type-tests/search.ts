import { from } from '../src'

from('posts').where({ asset_types: { has: 'image' } })
from('posts').where({ asset_types: { hasSome: ['image', 'video'] } })

// @ts-expect-error asset types are restricted to values indexed by the API
from('posts').where({ asset_types: { has: 'audio' } })

// @ts-expect-error asset_types is only queryable on posts
from('profiles').where({ asset_types: { has: 'video' } })
