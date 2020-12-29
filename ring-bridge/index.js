const express = require("express")
const ring = require('ring-client-api');
const fs = require('fs')

const port = 8000;
const TOKENS_FILENAME = '/data/tokens.json'

console.log('Initializing webservice.')
const webservice = express()

/** 
 * Get (initial) refresh token set as refresh_token in addon config and passed via run.sh
 **/
var refreshToken = process.env.REFRESH_TOKEN
if (refreshToken == undefined) {
	console.log("You must set a refresh token in the addon config")
	process.exit(22)
}

/**
 * Check if we have a fresher token persisted in /data/tokens.json from the last run
 *   or if the refresh_token in the addon config was updated, so we have to update persisted tokens in /data/tokens.json
 **/
console.log('Checking and possibly updating persisted tokens.')
var tokens = null
if (fs.existsSync(TOKENS_FILENAME)) {
	tokens = JSON.parse(fs.readFileSync(TOKENS_FILENAME));
	if (tokens.config === refreshToken) {
		refreshToken = tokens.updated
		console.log(`Ignoring token in addon config, using updated one from ${TOKENS_FILENAME}`,tokens)
	} else {
		tokens.config = refreshToken
		tokens.updated = refreshToken
		console.log(`Updated ${TOKENS_FILENAME} given new refresh_token in addon config`,tokens)
	}
} else {
	tokens = {
		config: refreshToken,
		updated: refreshToken
	}
	console.log(`Created /data/tokens.json`,tokens)
}
fs.writeFileSync(TOKENS_FILENAME, JSON.stringify(tokens));

/**
 * Initialize Ring API using refresh token determined above
 **/
console.log(`Initializing RingApi with refreshToken ${refreshToken}.`);
const ringApi = new ring.RingApi({
	refreshToken: refreshToken	
})		

/**
 * Subscribe to updated refresh tokens and persist on change
 **/
console.log('Initializing subscriber for refresh token updates.')
ringApi.onRefreshTokenUpdated.subscribe(({ oldRefreshToken, newRefreshToken }) => {
	console.log(`onRefreshTokenUpdated: got old ${oldRefreshToken}, new ${newRefreshToken}, known ${refreshToken}`)
	if (!oldRefreshToken) {
		console.log("onRefreshTokenUpdated: no oldRefreshToken, skipping.")
	  	return
	} else if (newRefreshToken === refreshToken) {
		console.log(`onRefreshTokenUpdated: no update required, skipping`)
		return
	}
	refreshToken = newRefreshToken
	console.log(`onRefreshTokenUpdated: set ${newRefreshToken} as refreshToken in-process`)
	tokens = JSON.parse(fs.readFileSync(TOKENS_FILENAME));
	tokens.updated = newRefreshToken
	fs.writeFileSync(TOKENS_FILENAME, JSON.stringify(tokens));
	console.log(`onRefreshTokenUpdated: set ${newRefreshToken} as tokens.updated in /data/tokens.json`)
})

/**
 * API to retrieve mode of 1st location connected to Ring account. Returns JSON, mode has key 'mode'
 **/
webservice.get('/location-mode', async (req, res) => {
	console.log("GET /location-mode")
	locations = await ringApi.getLocations().catch(e => { console.log(e); res.json({status: 'error'}); return });
	location = locations[0]
	locationMode = await location.getLocationMode().catch(e => { console.log(e); res.json({status: 'error'}); return });
	console.log("GET /location-mode: locationMode",locationMode)
	res.json(locationMode)
})

/**
 * API to set mode of 1st location connected to Ring account. Accepts JSON, assumes mode has key 'mode'
 **/
webservice.post('/location-mode', express.json(), async (req, res) => {
	console.log("POST /location-mode",req.body)
	locations = await ringApi.getLocations().catch(e => { console.log(e); res.json({status: 'error'}); return });
	location = locations[0]
	await location.setLocationMode(req.body.mode).catch(e => { console.log(e); res.json({status: 'error'}); return });
	locationMode = await location.getLocationMode().catch(e => { console.log(e); res.json({status: 'error'}); return });
	console.log("POST /location-mode: locationMode",locationMode)
	res.json(locationMode)
})

/**
 * Listen to defined port. Might be exposed differently depending on addon config.
 **/
console.log(`Starting listener on port ${port}.`)
webservice.listen(port, () => {
	console.log(`Ring Bridge is running on port ${port}.`);
})
