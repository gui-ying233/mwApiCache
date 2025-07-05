// ==UserScript==
// @name         萌娘百科缓存部分Api请求
// @namespace    https://github.com/gui-ying233/mwApiCache
// @version      3.6.2
// @description  缓存部分Api请求结果以提升速度减少WAF几率
// @author       鬼影233
// @license      MIT
// @match        zh.moegirl.org.cn/*
// @match        mzh.moegirl.org.cn/*
// @match        commons.moegirl.org.cn/*
// @match        library.moegirl.org.cn/*
// @match        en.moegirl.org.cn/*
// @match        ja.moegirl.org.cn/*
// @icon         http://moegirl.org.cn/favicon.ico
// @supportURL   https://github.com/gui-ying233/mwApiCache/issues
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
	"use strict";
	if (new URLSearchParams(window.location.search).get("safemode")) return;
	const ver = 2;
	const log = (type, ...args) => {
		console.debug(
			`%cmwApiCache-${type}\n${args.join("\n")}`,
			"border-left:1em solid #4E3DA4;background-color:#3C2D73;color:#D9D9D9;padding:1em"
		);
	};
	log("Beg", new Date().toISOString());
	log("Ver", ver);
	log("Svd", +window.localStorage.getItem("mwApiCache-Svd"));
	let win;
	window.XMLHttpRequest = class extends window.XMLHttpRequest {
		constructor() {
			super();
			this.addEventListener("load", () => {
				const url = new URL(this.responseURL);
				if (
					url.hostname.match(
						/^(?:m?zh|commons|library|en|ja)\.moegirl\.org\.cn$/
					) &&
					this.status === 200 &&
					this.responseText.match(
						"https://ssl.captcha.qq.com/TCaptcha.js"
					)
				) {
					if (win) win.focus();
					else {
						win = window.open(
							url,
							"_blank",
							"width=360,height=360"
						);
						win.addEventListener(
							"DOMContentLoaded",
							() => {
								if (
									![...win.document.scripts].some(
										({ src }) =>
											src ===
											"https://ssl.captcha.qq.com/TCaptcha.js"
									)
								) {
									win.close();
									win = null;
								}
								const id = setInterval(() => {
									if (
										!win?.performance
											.getEntriesByType("navigation")
											.some(nav => nav.type === "reload")
									)
										return;
									clearInterval(id);
									if (
										location.hostname ===
										win.location.hostname
									)
										document.cookie = win.document.cookie;
									win.close();
									win = null;
								}, 50);
							},
							{ passive: true, once: true }
						);
					}
				}
			});
		}
	};
	const id = setInterval(async () => {
		if (!window.mediaWiki?.Api?.prototype) return;
		clearInterval(id);
		const originalMediaWikiApiPost = window.mediaWiki.Api.prototype.post;
		await window.$.ready;
		const cfg = window.mediaWiki.config;
		const userName = cfg.get("wgUserName");
		window.addEventListener(
			"storage",
			e => {
				if (!e.key.startsWith("mwApiCache-")) return;
				if (
					e.newValue &&
					(e.key !== "mwApiCache-Svd" ||
						+e.newValue > (+e.oldValue ?? 0))
				) {
					e.storageArea.setItem(e.key, e.newValue);
					log("Set", e.key, e.newValue);
				} else {
					e.storageArea.removeItem(e.key);
					log("Del", e.key);
				}
			},
			{ passive: true }
		);
		const timestamp = Date.now();
		for (const key in window.localStorage) {
			if (!key.startsWith("mwApiCache-")) continue;
			if (key === "mwApiCache-Svd") continue;
			const cache = JSON.parse(window.localStorage.getItem(key));
			if (cache.timestamp < timestamp || cache.ver !== ver) {
				log("Del", key);
				window.localStorage.removeItem(key);
			}
		}
		const bc = new BroadcastChannel("mwApiCache");
		bc.addEventListener("message", e => {
			if (e.data === "init")
				Object.keys(sessionStorage).forEach(
					key =>
						key.startsWith("mwApiCache-") &&
						bc.postMessage({
							key: key.replace("mwApiCache-", ""),
							value: JSON.parse(sessionStorage.getItem(key)),
						})
				);
			else {
				const { key, value } = e.data;
				window.sessionStorage.setItem(
					`mwApiCache-${key}`,
					JSON.stringify(value)
				);
				log("Set", key, JSON.stringify(value));
			}
		});
		bc.postMessage("init");
		const second = 1000,
			minute = second * 60,
			hour = minute * 60,
			day = hour * 24;
		const getCache = (t, method, arg, ms = day * 7) => {
			const _arg = JSON.stringify(arg);
			const cache = JSON.parse(
				window[ms ? "localStorage" : "sessionStorage"].getItem(
					`mwApiCache-${_arg}`
				)
			);
			if (!cache) {
				const res = method.call(t, arg);
				res.then(_res => {
					log("Set", _arg, JSON.stringify(_res));
					const key = `mwApiCache-${_arg}`;
					const value = {
						ver,
						timestamp: timestamp + ms,
						res: _res,
					};
					window[ms ? "localStorage" : "sessionStorage"].setItem(
						key,
						JSON.stringify(value)
					);
					if (!ms) bc.postMessage({ key: _arg, value });
					return _res;
				});
				return res;
			}
			window.localStorage.setItem(
				"mwApiCache-Svd",
				+window.localStorage.getItem("mwApiCache-Svd") + 1
			);
			log("Get", _arg);
			return $()
				.promise()
				.then(() => cache.res);
		};
		const apiFilter = (t, method, [payload, ...args]) => {
			const arg = JSON.stringify(payload);
			switch (arg) {
				case `{"action":"query","ususers":"${userName}","meta":["userinfo","siteinfo"],"list":["users"],"uiprop":["rights"],"siprop":["specialpagealiases"],"usprop":["blockinfo"]}`:
				case '{"action":"query","meta":"siteinfo","siprop":"specialpagealiases","formatversion":2,"uselang":"content","maxage":3600}':
				case '{"action":"query","meta":"userinfo","uiprop":["groups","rights"]}':
				case `{"action":"query","prop":"revisions","titles":"User:${userName}/codemirror-mediawiki.json","rvprop":"content","rvlimit":1}`:
				case '{"action":"paraminfo","modules":"main","helpformat":"html","uselang":"zh"}':
				case '{"action":"paraminfo","modules":"json","helpformat":"html","uselang":"zh"}':
				case '{"action":"query","meta":"siteinfo","siprop":["general","namespaces"]}':
				case '{"action":"query","meta":"notifications","formatversion":2,"notfilter":"!read","notprop":"list","notformat":"model","notlimit":"max"}':
					return getCache(t, method, payload, 5 * minute - 1);
				case `{"action":"query","prop":"revisions","titles":"${cfg.get(
					"wgPageName"
				)}","rvprop":"content"}`:
				case `{"action":"parse","page":"${cfg.get(
					"wgPageName"
				)}","prop":"wikitext|langlinks|categories|templates|images|sections","format":"json"}`:
					return getCache(
						t,
						method,
						Object.assign(payload, {
							requestid: `mwApiCacheV${ver}-wgCurRevisionId:${wgCurRevisionId}`,
						}),
						0
					);
				default:
					if (
						/^{"action":"query","meta":"allmessages","ammessages":\[".*?"\],"amlang":"zh","formatversion":2}$/.test(
							arg
						) ||
						/^{"action":"parse","text":"<span id=\\"mw_editnotice_test_var\\".+?","preview":true,"disablelimitreport":true,"disableeditsection":true,"disabletoc":true}$/.test(
							arg
						)
					)
						return getCache(t, method, payload);
					if (
						/^{"action":"query","meta":"allmessages","ammessages":\["Editnotice-\d+","Editnotice-\d+-.+"],"amenableparser":1}$/.test(
							arg
						)
					)
						return getCache(t, method, payload, 3 * day);
					if (
						payload?.action === "compare" ||
						/^{"action":"query","prop":"revisions\|info","inprop":"protection\|watched","format":"json","pageids":\d+}$/.test(
							arg
						)
					)
						return getCache(t, method, payload, 0);
					if (
						window?.InPageEdit?.preference
							?.get?.("plugins")
							?.includes("edit-any-page.js") &&
						/^{"action":"parse","page":".+","prop":"wikitext\|langlinks\|categories\|templates\|images\|sections","format":"json"}$/.test(
							arg
						)
					)
						return getCache(
							t,
							method,
							Object.assign(payload, {
								requestid: `mwApiCacheV${ver}-timestamp:${timestamp}`,
							}),
							0
						);
					log("Ign", arg);
					return method.apply(t, [payload, ...args]);
			}
		};
		window.mediaWiki.Api.prototype.get = function (...args) {
			return apiFilter(this, originalMediaWikiApiPost, args);
		};
		window.mediaWiki.Api.prototype.post = function (...args) {
			return apiFilter(this, originalMediaWikiApiPost, args);
		};
	}, 5);
})();
