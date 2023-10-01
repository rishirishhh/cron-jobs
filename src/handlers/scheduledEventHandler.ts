import { KVNamespace } from '@cloudflare/workers-types';

import { handleConfig } from '../config/config';
import { DISCORD_NICKNAME_CHANGED_TIMESTAMP, NAMESPACE_NAME } from '../constants';
import { env, nicknameUpdateResponseType } from '../types/global.types';
import { generateJwt } from '../utils/generateJwt';

export async function ping(env: env) {
	const url = handleConfig(env);
	const response = await fetch(`${url.baseUrl}/healthcheck`);
	return response;
}

export async function callDiscordNicknameBatchUpdate(env: env) {
	const namespace = env[NAMESPACE_NAME] as unknown as KVNamespace;
	let lastNicknameUpdate: string | number = 0;
	try {
		lastNicknameUpdate = (await namespace.get(DISCORD_NICKNAME_CHANGED_TIMESTAMP)) ?? 0;
	} catch (err) {
		console.log('Error while fetching the timestamp for last nickname update');
		throw err;
	}

	const url = handleConfig(env);
	let token;
	try {
		token = await generateJwt(env);
	} catch (err) {
		console.log(`Error while generating JWT token: ${err}`);
		throw err;
	}
	const response = await fetch(`${url.baseUrl}/discord-actions/nickname/status`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			lastNicknameUpdate,
		}),
	});
	if (!response.ok) {
		throw new Error("Error while trying to update users' discord nickname");
	}

	const data: nicknameUpdateResponseType = await response.json();
	if (data?.data.totalUsersStatus !== 0 && data?.data.successfulNicknameUpdates === 0) {
		throw new Error("Error while trying to update users' discord nickname");
	}
	try {
		await namespace.put(DISCORD_NICKNAME_CHANGED_TIMESTAMP, Date.now().toString());
	} catch (err) {
		console.log('Error while trying to update the last nickname change timestamp');
	}

	return data;
}
