/// <reference path="../typings/hapi/hapi.d.ts" />
/// <reference path="../typings/i18next//i18next.d.ts" />
/// <reference path="../typings/accept-language-parser.d.ts" />
var i18n = require('i18next');
var util = require('util');
var acceptLanguageParser = require('accept-language-parser');
var defaults = {
    supportedLngs: ['en'],
    fallbackLng: 'en',
    lng: 'en',
    cookieName: 'i18next',
    useCookie: true,
    detectLngFromPath: 0,
    detectLngFromQueryString: false,
    detectLngFromHeaders: false,
    forceDetectLngFromPath: false
};
exports.register = function (server, options, next) {
    var i18nextOptions = util._extend(defaults, options.i18nextOptions);
    if (i18nextOptions.useCookie) {
        server.state(i18nextOptions.cookieName, options.cookieOptions || {});
    }
    /**
     * i18n.getInstance
     * @description
     */
    server.method('i18n.getInstance', function () {
        return i18n;
    });
    /**
     * i18n.translateWithCache
     * @description This method is a facade for i18next's bundled 't' method. We wrap it so that we can
     * pass an extra language parameter for Hapi server.method caching (so you can generate keys based on languages
     * and avoid cache pollution)
     */
    server.method('i18n.translateWithCache', function (key, lng, opts) {
        return i18n.t(key, opts);
    });
    i18n.init(i18nextOptions);
    server.ext('onPreHandler', function (request, reply) {
        var translations = {}, headerLang, fromPath, language, temp;
        if (!language && i18nextOptions.detectLngFromPath) {
            // if force is true, then we set lang even if it is not in supported languages list
            temp = detectLanguageFromPath(request);
            if (i18nextOptions.forceDetectLngFromPath || isLanguageSupported(temp)) {
                language = fromPath;
            }
        }
        if (!language && i18nextOptions.detectLngFromHeaders) {
            headerLang = detectLanguageFromHeaders(request);
            temp = headerLang[0].code + (headerLang.region ? '-' + headerLang.region : '');
            language = trySetLanguage(temp);
        }
        if (!language && i18nextOptions.detectLngFromQueryString) {
            temp = detectLanguageFromQS(request);
            language = trySetLanguage(temp);
        }
        if (!language && i18nextOptions.useCookie) {
            temp = detectLanguageFromCookie(request);
            language = trySetLanguage(temp);
            if (language) {
                request.state[i18nextOptions.cookieName] = language;
            }
        }
        language = language || i18nextOptions.lng || i18nextOptions.fallbackLng;
        if (language !== i18n.lng()) {
            i18n.setLng(language, function () {
                reply.continue();
            });
            return;
        }
        reply.continue();
    });
    function trySetLanguage(language) {
        return isLanguageSupported(language) ? language : undefined;
    }
    function isLanguageSupported(language) {
        var supported = i18nextOptions.supportedLngs;
        if ((!supported.length && language) || (supported.indexOf(language) > -1)) {
            return true;
        }
        return false;
    }
    function detectLanguageFromHeaders(request) {
        var langs, langHeader = request.headers['accept-language'];
        langs = acceptLanguageParser.parse(langHeader);
        langs.sort(function (a, b) {
            return b.q - a.q;
        });
        return langs;
    }
    function detectLanguageFromQS(request) {
        // Use the query param name specified in options, defaults to lang
        return request.query[options.detectLngQS || 'lang'];
    }
    function detectLanguageFromPath(request) {
        var parts = request.url.path.split('/');
        if (parts.length > options.detectLngFromPath) {
            return parts[options.detectLngFromPath];
        }
    }
    function detectLanguageFromCookie(request) {
        return request.state[options.i18nextOptions.cookieName] || null;
    }
    next();
};
exports.register.attributes = {
    name: 'hapi-i18next',
    version: '0.0.1'
};
