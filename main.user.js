// ==UserScript==
// @name         萌娘百科缓存部分Api请求
// @namespace    https://github.com/gui-ying233/mwApiCache
// @version      3.0.0
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
	const id = setInterval(async () => {
		if (!window.mediaWiki?.Api?.prototype) return;
		clearInterval(id);
		const originalMediaWikiApiPost = window.mediaWiki.Api.prototype.post;
		await window.$.ready;
		const cfg = window.mediaWiki.config;
		const userName = cfg.get("wgUserName");
		const debug = (type, ...args) => {
			console.debug(
				`%cmwApiCache-${type}\n${args.join("\n")}`,
				"border-left:1em solid #4E3DA4;background-color:#3C2D73;color:#D9D9D9;padding:1em"
			);
		};
		const timestamp = Date.now();
		for (const key in localStorage) {
			if (!key.startsWith("mwApiCache-")) continue;
			const cache = JSON.parse(localStorage.getItem(key));
			if (cache.timestamp < timestamp || cache.ver !== ver) {
				debug("Del", key);
				localStorage.removeItem(key);
			}
		}
		const getCache = (t, method, arg, day = 7) => {
			const _arg = JSON.stringify(arg);
			const storage = day ? localStorage : sessionStorage;
			const cache = JSON.parse(storage.getItem(`mwApiCache-${_arg}`));
			if (!cache) {
				const res = method.call(t, arg);
				res.then(_res => {
					debug("Set", _arg, JSON.stringify(_res));
					storage.setItem(
						`mwApiCache-${_arg}`,
						JSON.stringify({
							ver,
							timestamp: timestamp + 1000 * 60 * 60 * 24 * day,
							res: _res,
						})
					);
					return _res;
				});
				return res;
			}
			debug("Get", _arg);
			return $()
				.promise()
				.then(() => cache.res);
		};
		const apiFilter = (t, method, args) => {
			const arg = JSON.stringify(args[0]);
			switch (arg) {
				case `{"action":"query","ususers":"${userName}","meta":["userinfo","siteinfo"],"list":["users"],"uiprop":["rights"],"siprop":["specialpagealiases"],"usprop":["blockinfo"]}`:
				case '{"action":"query","meta":"siteinfo","siprop":"specialpagealiases","formatversion":2,"uselang":"content","maxage":3600}':
				case '{"action":"query","meta":"userinfo","uiprop":["groups","rights"]}':
				case `{"action":"query","prop":"revisions","titles":"User:${userName}/codemirror-mediawiki.json","rvprop":"content","rvlimit":1}`:
				case '{"action":"paraminfo","modules":"main","helpformat":"html","uselang":"zh"}':
				case '{"action":"paraminfo","modules":"json","helpformat":"html","uselang":"zh"}':
					return getCache(t, method, args[0]);
				case `{"action":"query","meta":"allmessages","ammessages":["Editnotice-${cfg.get(
					"wgNamespaceNumber"
				)}","Editnotice-${cfg.get("wgNamespaceNumber")}-${cfg
					.get("wgPageName")
					.replaceAll("_", " ")
					.replace(
						`${
							cfg.get("wgFormattedNamespaces")[
								cfg.get("wgNamespaceNumber")
							]
						}:`,
						""
					)}"],"amenableparser":1}`:
					return getCache(t, method, args[0], 3);
				case `{"action":"query","prop":"revisions|info","inprop":"protection|watched","format":"json","pageids":${cfg.get(
					"wgArticleId"
				)}}`:
					return getCache(t, method, args[0], 0);
				default:
					if (
						/^{"action":"query","meta":"allmessages","ammessages":\[".*?"\],"amlang":"zh","formatversion":2}$/.test(
							arg
						) ||
						/^{"action":"parse","text":"<span id=\\"mw_editnotice_test_var\\".+?","preview":true,"disablelimitreport":true,"disableeditsection":true,"disabletoc":true}$/.test(
							arg
						)
					)
						return getCache(t, method, args[0]);
					if (args[0]?.action === "compare")
						return getCache(t, method, args[0], 0);
					debug("Ign", arg);
					return method.apply(t, args);
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
