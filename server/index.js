let Index = require('ws').Server
let env = require('../utils/envUtil')
let mysql = require('../utils/mysql')
let redis = require('../utils/redis')
let md5 = require('md5-node')

let roomUser = []
let roomState = []
redis.select(1)
ws = new Index({port: env.WEBSOCKET_PORT})
ws.on('connection', function (socket) {
    socket.on('message', function (data) {
        let request = JSON.parse(String(data))
        let method = request['method']
        let roomId = request['room_id']
        let userId = request['user_id']
        socket['room_id'] = roomId
        socket['user_id'] = userId
        switch (method) {
            case 'start':
                if (typeof roomUser[roomId] === 'undefined') {
                    roomUser[roomId] = []
                }
                if (typeof roomState[roomId] === 'undefined') {
                    roomState[roomId] = []
                    roomState[roomId]['play_state'] = 'pause'
                    roomState[roomId]['time'] = 0
                }
                let enterInfo = {
                    'method': 'user_enter',
                    'user_id': userId,
                    'nick_name': request['nick_name'],
                    'play_state': roomState[roomId]['play_state'],
                    'time': roomState[roomId]['time']
                }
                for (let key in roomUser[roomId]) {
                    roomUser[roomId][key].send(JSON.stringify(enterInfo))
                }
                roomUser[roomId][userId] = socket
                let startInfo = {
                    'method': 'start',
                    'user_id_list': Object.keys(roomUser[roomId])
                }
                roomUser[roomId][userId].send(JSON.stringify(startInfo))
                redis.incr('video_room:room:watching:' + roomId)
                socket['nick_name'] = request['nick_name']
                break
            case 'now_time':
                if (typeof roomState[roomId] === 'undefined') {
                    roomState[roomId] = []
                    roomState[roomId]['time'] = 0
                }
                if (request['time'] - roomState[roomId]['time'] > 5) {
                    sendPlayTime(roomId, request['time'], roomUser[roomId])
                    roomState[roomId]['time'] = request['time']
                } else if (request['time'] - roomState[roomId]['time'] < -5) {
                    let nowTimeInfo = {
                        'method': 'now_time',
                        'time': roomState[roomId]['time'],
                    }
                    socket.send(JSON.stringify(nowTimeInfo))
                } else {
                    roomState[roomId]['time'] = request['time']
                }
                break
            case 'offer':
                let offerInfo = {
                    'method': 'offer',
                    'user_id': userId,
                    'desc': request['desc']
                }
                if (typeof roomUser[roomId] === 'undefined') {
                    roomUser[roomId] = []
                }
                if (typeof roomUser[roomId][request['to_user_id']] !== 'undefined') {
                    roomUser[roomId][request['to_user_id']].send(JSON.stringify(offerInfo))
                }
                break
            case 'answer':
                let answerInfo = {
                    'method': 'answer',
                    'user_id': userId,
                    'desc': request['desc']
                }
                if (typeof roomUser[roomId] === 'undefined') {
                    roomUser[roomId] = []
                }
                if (typeof roomUser[roomId][request['to_user_id']] !== 'undefined') {
                    roomUser[roomId][request['to_user_id']].send(JSON.stringify(answerInfo))
                }
                break
            case 'candidate':
                let candidateInfo = {
                    'method': 'candidate',
                    'user_id': userId,
                    'label': request['label'],
                    'id': request['id'],
                    'candidate': request['candidate']
                }
                if (typeof roomUser[roomId] === 'undefined') {
                    roomUser[roomId] = []
                }
                if (typeof roomUser[roomId][request['to_user_id']] !== 'undefined') {
                    roomUser[roomId][request['to_user_id']].send(JSON.stringify(candidateInfo))
                }
                break
            case 'chat':
                let chatText = {
                    'method': 'chat',
                    'user_id': request['user_id'],
                    'nick_name': request['nick_name'],
                    'chat_text': request['chat_text'],
                    'md5': md5(Date.now() + request['chat_text'] + request['user_id'])
                }
                if (typeof roomUser[roomId] !== 'undefined') {
                    for (let key in roomUser[roomId]) {
                        roomUser[roomId][key].send(JSON.stringify(chatText))
                    }
                }
                break
            case 'play_state':
                if (typeof roomState[roomId] === 'undefined') {
                    roomState[roomId] = []
                    roomState[roomId]['play_state'] = request['state']
                    if (typeof roomUser[roomId] !== 'undefined') {
                        sendPlayState(roomId, roomState[roomId]['play_state'], roomUser[roomId])
                    }
                } else {
                    if (roomState[roomId]['play_state'] !== request['state']) {
                        roomState[roomId]['play_state'] = request['state']
                        sendPlayState(roomId, roomState[roomId]['play_state'], roomUser[roomId])
                    }
                }
                break
            case 'timeupdate':
                if (typeof roomState[roomId] === 'undefined') {
                    roomState[roomId] = []
                    roomState[roomId]['time'] = 0
                }
                sendPlayTime(roomId, request['time'], roomUser[roomId])
                roomState[roomId]['time'] = request['time']
                break
            case 'close':
                break
        }
    })
    socket.on('close', function (close) {
        let roomId = socket['room_id']
        let userId = socket['user_id']
        if (typeof roomUser[roomId] !== 'undefined') {
            if (typeof roomUser[roomId][userId] !== 'undefined') {
                delete roomUser[roomId][userId]
            }
            let closeInfo = {
                'method': 'user_leave',
                'user_id': userId,
                'nick_name': socket['nick_name']
            }
            for (let key in roomUser[roomId]) {
                roomUser[roomId][key].send(JSON.stringify(closeInfo))
            }
        }
        redis.decr('video_room:room:watching:' + socket['room_id'])
    })
})

function sendPlayState(roomId, playState, clients) {
    let playInfo = {
        'method': 'play_state',
        'room_id': roomId,
        'play_state': playState
    }
    for (let key in clients) {
        clients[key].send(JSON.stringify(playInfo))
    }
}

function sendPlayTime(roomId, playTime, clients) {
    let playInfo = {
        'method': 'timeupdate',
        'room_id': roomId,
        'time': playTime
    }
    for (let key in clients) {
        clients[key].send(JSON.stringify(playInfo))
    }
}