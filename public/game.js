// サーバーから送られてくる牌表現とそれに対応する画像名のマップ
const key2fname_map = 
([...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `./pic/m${i}.png`)).concat(
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `./pic/p${i}.png`),
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `./pic/s${i}.png`), 
    [...Array(28)].map((_,i) => parseInt(i / 4) + 1).map(i => `./pic/z${i}.png`), 
    ['./pic/bt.png']);
key2fname_map[4 * 4 + 0] = './pic/m0.png';
key2fname_map[4 * 13 + 0] = './pic/p0.png';
key2fname_map[4 * 13 + 1] = './pic/p0.png';
key2fname_map[4 * 22 + 0] = './pic/s0.png';

// 0: 自分, 1: 下家, 2: 対面, 3: 上家
const idx2player_map = ['my', 'right', 'opposite', 'left'];

// ゲーム画面の要素を取得
const gameEl = document.querySelector('#field');
const gameStartBtn = document.querySelector('#game-start-btn');
const actions = ['chi', 'pon', 'kan', 'ron', 'riichi', 'tsumo', 'skip'];
const actionBtns = {};
actions.forEach(action => {
    actionBtns[action] = document.getElementById(`${action}-btn`);
    document.getElementById(`${action}-btn`).addEventListener('click', (event) => {
        console.log(action);
        socket.emit('declare-action', action);
    });    
});

const nameEls = idx2player_map.map(p => document.getElementById(`${p}-name`));
const handEls = idx2player_map.map(p => document.getElementById(`${p}-hand-tiles`));
const discardEls = idx2player_map.map(p => document.getElementById(`${p}-discard-tiles`));
const meldEls = idx2player_map.map(p => document.getElementById(`${p}-meld-tiles`));
const doraEl = document.getElementById('dora-tiles');
const wallEl = document.querySelector('wall-tiles');

const tileNum = document.getElementById('tiles-num');
let currentTilesNum = 136;

// Socket.IOのインスタンスを作成
const socket = io();

// 現在実行可能なアクションを更新する
let enable_actions = {}
update_actions = function(enable_action){
    this.enable_actions = enable_action;
    actions.forEach(a => {
        if (enable_action[a]){
            actionBtns[a].style = "display: block; background-color: #00ff00;"
        }
        else {
            actionBtns[a].style = "display: none;"
        }
    });
}

// 手牌、捨牌、鳴牌の配列（0:自分, 1:下家, 2:対面, 3:上家）
let handTiles = [[], [], [], []];
let discardTiles = [[], [], [], []];
let meldTiles = [[], [], [], []];
let doraTiles = [];
// let wallTiles = [];

renderTiles = function(el, tiles, img_width, is_listener = false){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    tiles.forEach((tile, idx) => {
        const tileEl = document.createElement('img');
        tileEl.classList.add('hand-tile');
        tileEl.src = key2fname_map[tile];
        tileEl.style = `width: ${img_width};`
        if (is_listener){
            tileEl.addEventListener('click', () => {
                socket.emit('discard-tile', tile);
            })
        }
        el.appendChild(tileEl);
    });
}
renderMeldTiles = function(el, tiles, img_width){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    tiles.forEach((arr, _) => {
        arr.melds.forEach((tile, idx) => {
            const tileEl = document.createElement('img');
            tileEl.classList.add('hand-tile');
            tileEl.src = key2fname_map[tile];
            tileEl.style = "width: " + img_width + ";";
            el.appendChild(tileEl);
        });
    });
}
renderDoraTiles = function(el, tiles, img_width){
    const backcard_id = key2fname_map.length - 1;
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    for (var i = 0; i < 5; i++){  // ドラ表示が5枚になるようにする
        const tileEl = document.createElement('img');
        tileEl.classList.add('hand-tile');
        tileEl.src = key2fname_map[(i < tiles.length)? tiles[i] : backcard_id];
        tileEl.style = `width: ${img_width};`;
        el.appendChild(tileEl);
    }
}


// WebSocketでサーバからのデータを受信する処理
socket.on('data', (data) => {
    // ゲームの状態を更新する
    update_actions(data.enable_actions);

    var hands = [data.myHandTiles, data.rightHandTiles, data.oppositeHandTiles, data.leftHandTiles];
    var discards = [data.myDiscardTiles, data.rightDiscardTiles, data.oppositeDiscardTiles, data.leftDiscardTiles];
    var melds = [data.myMeldTiles, data.rightMeldTiles, data.oppositeMeldTiles, data.leftMeldTiles];
    for(var i = 0; i < 4; i++){
        if (hands[i].code == 'full')
            handTiles[i] = hands[i].value;
        if (discards[i].code == 'full')
            discardTiles[i] = discards[i].value;
        if (melds[i].code == 'full')
            meldTiles[i] = melds[i].value;
    }
    // ドラ
    doraTiles = data.doraTiles.value;

    // 牌を描画する
    for(var i = 0; i < 4; i++){
        renderTiles(handEls[i], handTiles[i], (i == 0)? "100px":"30px", (i == 0)? true: false);
        renderTiles(discardEls[i], discardTiles[i], "60px");
        renderMeldTiles(meldEls[i], meldTiles[i], "60px");
    }
    renderDoraTiles(doraEl, doraTiles, "60px");
});


// WebSocketでサーバからのデータを受信する処理
socket.on('diff-data', (data) => {
    // ゲームの状態を更新する
    update_actions(data.enable_actions);
    if (data.action == 'draw'){
        handTiles[data.player].push(data.tile);
        currentTilesNum = data.remain_tile_num;
    }
    else if(data.action == 'discard'){
        if (handTiles[data.player].indexOf(data.tile) != -1){
            handTiles[data.player] = handTiles[data.player].filter(item => item != data.tile)
            handTiles[data.player].sort((a, b) => a - b);
        }
        else if (data.player != 0){
            var rand = Math.floor(Math.random() * handTiles[data.player].length);
            handTiles[data.player].splice(rand, 1);  // 自摸切りを分ける  FIXME
        }
        else 
            console.log("[ERROR C]");
        discardTiles[data.player].push(data.tile);
    }
    else if(data.action == 'meld'){
        console.log(data);
        // var meld_info = {tgt_p: person, dicard: tile, hands: []};
        var meld_info = data.tile;
        var p1 = data.player;  // 鳴いた人
        var p2 = (p1 + meld_info.tgt_p + 4) % 4;  // 鳴かれた人  tgt_p : 1 => data.playerからみて下家
        // 鳴かれた人の捨牌から最新のものを取り除く
        discardTiles[p2].pop();
        // 鳴いた人の手牌から必要なものを取り除く
        meld_info.hands.forEach((_id, idx) => {
                if (handTiles[p1].indexOf(_id) != -1){
                    handTiles[p1] = handTiles[p1].filter(item => item != _id)
                    handTiles[p1].sort((a, b) => a - b);
                }
                else if (p1 != 0){
                    var rand = Math.floor(Math.random() * handTiles[p1].length);
                    handTiles[p1].splice(rand, 1);
                }
        });
        meldTiles[p1].push({'tgt_p': p2, 'discard': meld_info.discard, 'melds': meld_info.hands.concat(meld_info.discard)});
    }
    else if(data.action == 'ankan' || data.action == 'kakan' || data.action == 'kan'){
        console.log(data);
        var p = data.player;  // 鳴いた人
        var meld_info = data.melds;
        var tile_info = data.tile;
        var p2 = (data.action == 'ankan')? null: (p + meld_info.tgt_p + 4) % 4; 
        if (data.action == 'kan')
            discardTiles[p2].pop();
        // 槓した人の手牌から必要なものを取り除く
        meld_info.hands.forEach((_id, idx) => {
                if (handTiles[p].indexOf(_id) != -1){
                    handTiles[p] = handTiles[p].filter(item => item != _id)
                    handTiles[p].sort((a, b) => a - b);
                }
                else if (p != 0){
                    var rand = Math.floor(Math.random() * handTiles[p].length);
                    handTiles[p].splice(rand, 1);
                }
        });
        handTiles[p].push(tile_info);
        if (data.action == 'ankan')
            meldTiles[p].push({'tgt_p': null, 'discard': null, 'melds': meld_info.hands});
        else if (data.action == 'kakan')// FIXME 既にあるmeldsから探してそこに追加する
            meldTiles[p].push({'tgt_p': p2, 'discard': meld_info.discard, 'melds': meld_info.hands.concat(meld_info.discard)});
        else{
            meldTiles[p].push({'tgt_p': p2, 'discard': meld_info.discard, 'melds': meld_info.hands.concat(meld_info.discard)});
        }
        currentTilesNum = data.remain_tile_num;
    }
    else if (data.action == 'dora'){
        doraTiles.push(data.tile);
        renderDoraTiles(doraEl, doraTiles, "60px");
    }

    // 牌を描画する
    for(var i = 0; i < 4; i++){
        renderTiles(handEls[i], handTiles[i], (i == 0)? "100px":"30px", (i == 0)? true: false);
        renderTiles(discardEls[i], discardTiles[i], "60px");
        renderMeldTiles(meldEls[i], meldTiles[i], "60px");
    }

    // 残り牌数を更新する
    tileNum.textContent = currentTilesNum;
});

socket.on('select-meld-cand', (data) => {
    if (data.length == 1)
        socket.emit('select-meld-cand', data[0]);
    else{
        console.log("select-meld-cand", data);
        socket.emit('select-meld-cand', data[1]);
    }
});


socket.on('select-kan-cand', (data) => {
    if (data.length == 1)
        socket.emit('declare-kan', data[0]);
    else{
        console.log("declare-kan", data);
        socket.emit('declare-kan', data[1]);
    }
});


socket.on('select-riichi-cand', (data) => {
    if (data.length == 1)
        socket.emit('declare-riichi', data[0]);
    else{
        console.log("declare-riichi", data);
        socket.emit('declare-riichi', data[1]);
    }
});



socket.on('game-status', (data) => {
    data.names.forEach((e, i)=>{
        nameEls[i].innerHTML = e;
    });
});





// ゲームスタートボタンが押された時の処理
gameStartBtn.addEventListener('click', (event) => {
    socket.emit('start-game');
});



// SocketIO接続時にuserIDを送信する
socket.on('connect', () => {
    console.log('Connected to the server');
    const array = document.cookie.split(';');
    var user_id = "null";
    array.forEach(function(value){
        const content = value.replace(' ', '').split('=');
        if(content[0] == "girlmas"){
            user_id = content[1];
        }
    })
    socket.emit('game-login', {user_id});
});

socket.on('disconnect', () => {
    console.log('Disconnected from the server');
});

// WebSocketでサーバからのデータを受信する処理
socket.on('login-failure', (data) => {
    // アラートを出し、その後/に移動する  FIXME
    window.location.href = '/';
});


// 初期化処理
function init() {
}


// 初期化処理を実行する
init();
