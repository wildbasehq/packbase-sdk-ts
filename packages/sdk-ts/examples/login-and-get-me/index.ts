import {PackbaseSDK} from '../../src'

const pb = new PackbaseSDK({
    apiKey: process.env.PACKBASE_API_KEY,
    baseUrl: process.env.PACKBASE_BASE_URL || 'https://vgs.packbase.app',
})

pb.on('ready', (profile) => {
    console.log(`Logged in as ${profile.username}!`)
})
