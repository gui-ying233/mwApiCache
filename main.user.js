// ==UserScript==
// @name         萌娘百科缓存部分Api请求
// @namespace    https://github.com/gui-ying233/mwApiCache
// @version      1.0.0
// @description  缓存部分Api请求结果7日以提升速度减少WAF几率
// @author       鬼影233
// @license      MIT
// @match        zh.moegirl.org.cn/*
// @match        mzh.moegirl.org.cn/*
// @icon         http://moegirl.org.cn/favicon.ico
// @supportURL   https://github.com/gui-ying233/mwApiCache/issues
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
	"use strict";
	if (new URLSearchParams(window.location.search).get("safemode")) return;
	const ver = 1;
	const id = setInterval(async () => {
		if (!window.mediaWiki?.Api?.prototype) return;
		clearInterval(id);
		const originalMediaWikiApiGet = window.mediaWiki.Api.prototype.get;
		await window.$.ready;
		const cfg = window.mediaWiki.config;
		const userName = cfg.get("wgUserName");
		const timestamp = Date.now();
		const getCache = (t, arg) => {
			const _arg = JSON.stringify(arg);
			const cache = JSON.parse(
				localStorage.getItem(`mwApiCache-${_arg}`)
			);
			if (
				!cache ||
				cache.ver !== ver ||
				timestamp - cache.timestamp > 1000 * 60 * 60 * 24 * 7
			) {
				const res = originalMediaWikiApiGet.call(t, arg);
				res.then(_res => {
					console.debug(
						`%cmwApiCache-Set\n${_arg}\n${JSON.stringify(_res)}`,
						"border-left:1em solid #4E3DA4;background-color:#3C2D73;color:#D9D9D9;padding:1em"
					);
					localStorage.setItem(
						`mwApiCache-${_arg}`,
						JSON.stringify({
							ver,
							timestamp,
							res: _res,
						})
					);
					return _res;
				});
				return res;
			}
			console.debug(
				`%cmwApiCache-Get\n${_arg}`,
				"border-left:1em solid #4E3DA4;background-color:#3C2D73;color:#D9D9D9;padding:1em"
			);
			return $()
				.promise()
				.then(() => cache.res);
		};
		window.mediaWiki.Api.prototype.get = function (...args) {
			const arg = JSON.stringify(args[0]);
			switch (arg) {
				case `{"action":"query","ususers":"${userName}","meta":["userinfo","siteinfo"],"list":["users"],"uiprop":["rights"],"siprop":["specialpagealiases"],"usprop":["blockinfo"]}`:
				case '{"action":"query","meta":"siteinfo","siprop":"specialpagealiases","formatversion":2,"uselang":"content","maxage":3600}':
				case '{"action":"query","meta":"userinfo","uiprop":["groups","rights"]}':
				case `{"action":"query","prop":"revisions","titles":"User:${userName}/codemirror-mediawiki.json","rvprop":"content","rvlimit":1}`:
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
					return getCache(this, args[0]);
				default:
					if (
						/{"action":"query","meta":"allmessages","ammessages":\[".*?"\],"amlang":"zh","formatversion":2}/.test(
							arg
						)
					)
						return getCache(this, args[0]);
					console.debug(
						`%cmwApiCache-Ign\n${arg}`,
						"border-left:1em solid #4E3DA4;background-color:#3C2D73;color:#D9D9D9;padding:1em"
					);
					return originalMediaWikiApiGet.apply(this, args);
			}
		};
	}, 5);
})();
