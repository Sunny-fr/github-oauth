var request = require('request')
var events = require('events')
var url = require('url')
var crypto = require('crypto')

export default function (opts) {

    if (!opts.callbackURI) opts.callbackURI = '/github/callback'

    if (!opts.loginURI) opts.loginURI = '/github/login'

    if (typeof opts.scope === 'undefined') opts.scope = 'user'

    const state = crypto.randomBytes(8).toString('hex')

    const urlObj = url.parse(opts.baseURL)

    urlObj.pathname = url.resolve(urlObj.pathname, opts.callbackURI)

    const redirectURI = url.format(urlObj)
    const emitter = new events.EventEmitter()

    function addRoutes(router, loginCallback) {
        // compatible with flatiron/director
        router.get(opts.loginURI, login)
        router.get(opts.callbackURI, callback)
        if (!loginCallback) return
        emitter.on('error', function (token, err, resp, tokenResp, req) {
            loginCallback(err, token, resp, tokenResp, req)
        })
        emitter.on('token', function (token, resp, tokenResp, req) {
            loginCallback(false, token, resp, tokenResp, req)
        })
    }

    function login(req, resp) {
        const u = 'https://github.com/login/oauth/authorize'
                + '?client_id=' + opts.githubClient
                + (opts.scope ? '&scope=' + opts.scope : '')
                + '&redirect_uri=' + redirectURI
                + '&state=' + state
            ;
        resp.statusCode = 302
        resp.setHeader('location', u)
        resp.end()
    }

    function callback(req, resp, cb) {
        const query = url.parse(req.url, true).query
        const code = query.code
        return new Promise((resolve, reject) => {

            if (!code) {
                //return emitter.emit('error', {error: 'missing oauth code'}, resp)
                reject('missing oauth code')
            }
            const url = 'https://github.com/login/oauth/access_token'
                    + '?client_id=' + opts.githubClient
                    + '&client_secret=' + opts.githubSecret
                    + '&code=' + code
                    + '&state=' + state

            request.get({url, json: true}, (err, tokenResp, body) => {
                if (err) {
                    // if (cb) {
                    //     err.body = body
                    //     err.tokenResp = tokenResp
                    //     return cb(err)
                    // }
                    //return emitter.emit('error', body, err, resp, tokenResp, req)
                    reject('error', body, err, resp)

                }
                resolve(tokenResp)
                // if (cb) {
                //     cb(null, body)
                // }
                //emitter.emit('token', body, resp, tokenResp, req)
            })
        })

    }

    emitter.login = login
    emitter.callback = callback
    emitter.addRoutes = addRoutes
    return emitter
}
