const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const Mahjong = require('./game/mahjong');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const game = new Mahjong(io);

const login_users = {};  // ログイン済みユーザーの情報を管理するオブジェクト

// ランダムな文字列を生成する関数
function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

// ゲーム画面（正しいidを持っていないとエラーが出るようにする）
app.get('/game.html', (req, res) => {
    if(req.query.user_id == null || !login_users[req.query.user_id]){
        console.log("ミスっている", user_id);
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    else{
        res.sendFile(path.join(__dirname, 'public', 'game.html'));
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// クライアントとの接続
io.on('connection', (socket) => {

    // 接続時のデフォルト処理
    console.log('[Connected] socket id = ', socket.id);

    // プレイヤーがタイトル画面でログインボタンを押した時の処理
    socket.on('login', (data)=>{  
        if (data.password === 'password') {  // ログイン成功
            var user_id = data.user_id;
            if (!login_users[user_id])  {// user_idが同一のものが存在する（再リロードしたなど）
                user_id = generateRandomString(20);
                login_users[user_id] = { socketid: socket.id, user_name: data.user_name, user_id: user_id };
            }
            // ログイン情報をクライアント側に送信
            socket.emit('login-success', { user_id: user_id });
        } else {
            socket.emit('login-failure');
        }
    });

    socket.on('game-login', (data)=>{
        if (login_users[data.user_id]) {
            login_users[data.user_id].socketid = socket.id;
            game.addPlayer(login_users[data.user_id].user_name, socket.id, login_users[data.user_id].user_id);
            // ログインすると三秒後にゲームスタート
            setTimeout(() => {
                game.startGame();
            }, 3000);
        } else {
            // ログインしていない場合はログインページにリダイレクト
            socket.emit('login-failure', { msg: "not login" })
        }
    });

    // プレイヤーがstartボタンを押した時の処理
    socket.on('start-game', () => {
        game.startGame();
    });

    // プレイヤーがstopボタンを押した時の処理
    socket.on('stop-game', () => {
        console.log("[ERROR Z] server.js, stop-game, not implemented");
        return;
    });
    
    // プレイヤーが牌を捨てたときの処理
    socket.on('discard-tile', (tile) => {
        game.discardTile(socket.id, tile);
    });

    // プレイヤーがツモったときの処理
    socket.on('draw-tile', () => {
        game.drawTile(socket.id);
    });

    // プレイヤーが鳴きを行ったときの処理
    socket.on('declare-action', (action_type) => {
        game.notTurnPlayerDeclareAction(socket.id, action_type);
    });

    socket.on('select-meld-cand', (hands) => {
        game.performMeld(socket.id, hands);
    });

    // プレイヤーが加槓、暗槓を宣言したときの処理
    socket.on('declare-kan', (hands) => {
        if (hands.length == 4)
            game.performAnkan(socket.id, hands);
        else
            game.performKakan(socket.id, hands);
    });

    // プレイヤーが立直を宣言したときの処理
    socket.on('declare-riichi', (discardTile) => {
        game.declareRiichi(socket.id, discardTile);
    });
    
    // プレイヤーがツモあがりを宣言したときの処理
    socket.on('declare-tsumo', () => {
        game.declareTsumo(socket.id);
    });

    // プレイヤーが確認したので次へ進むボタンを押した時の処理
    socket.on('confirmed', () => {
        game.doConfirm(socket.id);
    });
    
    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('[Disconnected] socket id = ', socket.id);
        // プレイヤーを削除
        game.removePlayer(socket.id);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});




// Debug用データサイズ
app.use((req, res, next) => {
    const start = Date.now();
    const requestChunks = [];
  
    req.on('data', chunk => {
      requestChunks.push(chunk);
    });
  
    req.on('end', () => {
      const requestDataSize = Buffer.concat(requestChunks).length;
      console.log(`Request Data Size: ${requestDataSize} bytes`);
      next();
    });
  
    res.on('finish', () => {
      const responseDataSize = (isNaN(res.getHeader('content-length')))? 0: res.getHeader('content-length');
      console.log(`Response Data Size: ${responseDataSize} bytes`);
    });
});

