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
const musicBtn = document.querySelector('#music-btn');
const music = new Audio('./music/bgm.mp3'); // BGM
const actions = ['chi', 'pon', 'kan', 'ron', 'riichi', 'tsumo', 'drawn', 'skip'];
const action_JPs = {'chi': "チー", 'pon': "ポン", 'kan': "カン", 'ron': "ロン", 'riichi': "リーチ", 'tsumo': "ツモ", 'drawn': "九種九牌流局", 'skip': "スキップ"};
const actionBtns = {};
actions.forEach(action => {
    actionBtns[action] = document.getElementById(`${action}-btn`);
    document.getElementById(`${action}-btn`).addEventListener('click', (event) => {
        console.log(action);
        if(action === "riichi"){
            //すべてのイベントリスナーを除去
            renderTiles(handEls[0], handTiles[0], "100px", false, true, is_Draw);
        }
        socket.emit('declare-action', action);
    });    
});

// playerInfoEls[playerIdx]["name" or "point" or "wind"]
const playerInfoEls = idx2player_map.map(p => {return {"name":document.getElementById(`${p}-name`), 
"point":document.getElementById(`${p}-point`), "wind":document.getElementById(`${p}-wind`)}});
const handEls = idx2player_map.map(p => document.getElementById(`${p}-hand-tiles`));
const discardEls = idx2player_map.map(p => document.getElementById(`${p}-discard-tiles`));
const meldEls = idx2player_map.map(p => document.getElementById(`${p}-meld-tiles`));
const declareEls = idx2player_map.map(p => document.getElementById(`${p}-declare-msg`));
const doraEl = document.getElementById('dora-tiles');
const wallEl = document.querySelector('wall-tiles');

const tileNum = document.getElementById('tiles-num');
let currentTilesNum = 136;
const resultView = {
    "main":document.getElementById('result-area'),
    "hands":document.getElementById('result-hands-area'),
    "melds":document.getElementById('result-melds-area'),
    "yaku":document.getElementById('result-yaku-area'),
    "score":document.getElementById('result-score-area'),
}

// 牌を引いたかを判定するフラグ
let is_Draw = false;
// 牌を描画するかどうかを判定するフラグ
let is_Render = false;

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
let riichiTurns = [null, null, null, null];  // 立直の際の捨て牌の位置

renderTiles = function(el, tiles, img_width, is_listener = false, is_current = false, is_draw = false, playerNum){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    
    tiles.forEach((tile, idx) => {
        const tileEl = document.createElement('img');
        tileEl.classList.add('hand-tile');
        tileEl.src = key2fname_map[tile];
        tileEl.alt = tile;
        tileEl.style = `width: ${img_width};`;
        // 立直の牌の場合90度傾ける
        if(idx == riichiTurns[playerNum]) {
            tileEl.style = "transform:rotate(90deg);";
        }
        if (is_listener){
            tileEl.addEventListener('click', () => {
                socket.emit('discard-tile', tile);
            })
        }

        // 最後の牌には新たなクラスを付与する。自分の牌と他の人の牌でスペースの空き方を変える
        if ((idx == tiles.length - 1) && is_current && is_draw) {
            if(is_listener){
                tileEl.classList.add('last-my-tile');
            }
            else {
                tileEl.classList.add('last-other-tile');
            }
        }
        el.appendChild(tileEl);
    });
}
renderMeldTiles = function(el, tiles, img_width){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    let X = 0;  // 描画する牌の左端の補正座標(px)
    const W1 = parseInt(img_width);  // '60px' => 60
    const W2 = parseInt(W1 / 2);
    const W3 = parseInt(W1 / 3);
    const W4 = parseInt(W1 / 4);
    const W10 = parseInt(W1 / 10);
    const W30 = parseInt(W1 / 30);
    const SP = 3;  // 決め打ちの値 fixme
    const ROT1 = W4 - W30;
    const ROT2 = ROT1 + W2;

    tiles.forEach((meld, _) => {
        let renderTiles = [];
        let renderOpts = [];
        // 描画する情報を格納する
        switch(meld.type) {
            case 'ankan':
                renderTiles = [meld.hands[0], 136, 136, meld.hands[3]];  // 136: 裏側
                renderOpts = [0, 0, 0, 0];
                break;
            case 'kakan':
                renderTiles = meld.hands.slice(0, 2);
                renderOpts = renderTiles.map(v => 0);
                var rotIdx = [null, 2, 1, 0][meld.from_who];
                renderTiles.splice(rotIdx, 0, meld.discard, meld.hands[2]);  // rotIdxの場所にdiscard, hands[2]を挿入
                renderOpts.splice(rotIdx, 0, 1, 2);  // rotIdxの場所に1, 2を挿入
                break;
            default:  // pon, chi, kan
                renderTiles = [...meld.hands];
                renderOpts = renderTiles.map(v => 0);
                var rotIdx = [null, meld.hands.length, 1, 0][meld.from_who];
                renderTiles.splice(rotIdx, 0, meld.discard);  // rotIdxの場所にdiscardを挿入
                renderOpts.splice(rotIdx, 0, 1);  // rotIdxの場所に1を挿入
                break;
        }
        // 牌を描画する（Xの変化度合は、経験的に決定）
        for (let i = 0; i < renderTiles.length; i++) {
            const tileEl = document.createElement('img');
            tileEl.src = key2fname_map[renderTiles[i]];
            if (renderOpts[i] == 0) {      // 通常の手出し牌
                tileEl.style = `width: ${img_width}px; transform: translate(${X}px);`;
                X -= W10;
            }
            else if (renderOpts[i] == 1){  // 鳴き牌
                X += W4;
                tileEl.style = `width: ${img_width}px; transform: rotate(90deg) translate(${ROT1}px, ${-X}px);`;
                X -= SP;
            }
            else {  // 加槓牌
                X -= (W1 - SP);
                tileEl.style = `width: ${img_width}px; transform: rotate(90deg) translate(${-ROT2}px, ${-X}px);`;
            }
            el.appendChild(tileEl);
        }
        X += W3;
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
    var riichis = [data.myRiichiTurn, data.rightRiichiTurn, data.oppositeRiichiTurn, data.leftRiichiTurn];
    for(var i = 0; i < 4; i++){
        if (hands[i].code == 'full')
            handTiles[i] = hands[i].value;
        if (discards[i].code == 'full')
            discardTiles[i] = discards[i].value;
        if (melds[i].code == 'full')
            meldTiles[i] = melds[i].value;
        riichiTurns[i] = riichis[i];
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
    if ("enable_actions" in data)
        update_actions(data.enable_actions);
    // ドラ表示を除いて牌を描画する
    is_Render = true;
    if (data.action == 'draw'){
        handTiles[data.player].push(data.tile);
        currentTilesNum = data.remain_tile_num;
        is_Draw = true;
    }
    else if(data.action == 'discard'){
        if (handTiles[data.player].indexOf(data.tile) != -1){
            handTiles[data.player] = handTiles[data.player].filter(item => item != data.tile)
            handTiles[data.player].sort((a, b) => a - b);
        }
        else if (data.player != 0){
            let discardIdx = -1;
            if(data.is_tsumo_giri){
                discardIdx = handTiles[data.player].length - 1;
                console.log("tumogiri:", data.is_tsumo_giri);
            }
            else {
                discardIdx = Math.floor(Math.random() * (handTiles[data.player].length - 1));
            }
            handTiles[data.player].splice(discardIdx, 1);
        }
        else 
            console.log("[ERROR C]");
        discardTiles[data.player].push(data.tile);
        is_Draw = false;
    }
    else if(data.action == 'pon' || data.action == 'chi' || data.action == 'kan'){
        console.log(data);
        // var meld_info = {from_who: person, dicard: tile, hands: []};
        var meld_info = data.meld;
        var p1 = data.player;  // 鳴いた人
        var p2 = (p1 + meld_info.from_who + 4) % 4;  // 鳴かれた人  from_who : 1 => data.playerからみて下家
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
        meldTiles[p1].push({'type': data.action, 'from_who': p2, 'discard': meld_info.discard, 'hands': meld_info.hands});
    }
    else if(data.action == 'ankan' || data.action == 'kakan'){
        console.log(data);
        var p = data.player;  // 鳴いた人
        var meld_info = data.meld;
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
        if (data.action == 'ankan') {
            meldTiles[p].push({'type': 'ankan', 'from_who': null, 'discard': null, 'hands': meld_info.hands});
        }
        else if (data.action == 'kakan'){ // FIXME 既にあるhandsから探してそこに追加する
            for(var t = 0; t < meldTiles[p].length; t++){
                if (parseInt(meld_info.hands[0] / 4) == parseInt(meldTiles[p][t].discard / 4)) {
                    meldTiles[p][t].hands.push(meld_info.hands[0]);
                    meldTiles[p][t].type = 'kakan';
                }
            }
        }
    }
    else if (data.action == 'replacement-draw'){
        let p = data.player;
        currentTilesNum = data.remain_tile_num;
        handTiles[p].push(data.tile);
        is_Draw = true;
    }
    else if (data.action == 'dora'){
        doraTiles.push(data.tile);
        renderDoraTiles(doraEl, doraTiles, "60px");
        is_Render = false;
    }

    if (is_Render){
        // 牌を描画する
        for(var i = 0; i < 4; i++){
            renderTiles(handEls[i], handTiles[i], (i == 0)? "100px":"30px", (i == 0)? true: false, (i == data.player)? true: false, is_Draw);
            renderTiles(discardEls[i], discardTiles[i], "60px",false,false,false,i);
            renderMeldTiles(meldEls[i], meldTiles[i], "60px");
        }
    }

    // 残り牌数を更新する
    tileNum.textContent = currentTilesNum;
});


// 立直、ポンなどの何かしらの宣言が生じた際に送られてくるイベント
socket.on('declare', (data) => {
    let p = data.player;         // 宣言した人
    let action = data.action;    // 宣言の種類
    // 立直の場合、riichiTurnsに曲げ牌の位置を記録する
    if (action == 'riichi') riichiTurns[p] = discardTiles[p].length;
    declareEls[p].innerHTML = action_JPs[action];
    declareEls[p].style.display = "block";
    window.setTimeout(()=>{ declareEls[p].style.display = "none"; }, 1000);
});


socket.on('select-meld-cand', (data) => {
    if (data.length == 1)
        socket.emit('select-meld-cand', data[0]);
    else{
        console.log("select-meld-cand", data);
        // FIXME 鳴ける組み合わせを表示して、選択できるようにする
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
        // FIXME 捨てられる牌を表示して、選択できるようにする
        imgEls = handEls[0].getElementsByTagName('img');
        for (var i = 0; i < imgEls.length; i++){
            if (data.includes(parseInt(imgEls[i].alt))){
                let v = parseInt(imgEls[i].alt)
                imgEls[i].addEventListener('click', () => {
                    socket.emit('declare-riichi', v);
                })
            }
        }
    }
});


socket.on('cannot-discard-tile', (tile_id) => {
    console.log(`[WARNING] you cannot discard the tile ${tile_id}`);
});


socket.on('one-game-end', (results) => {
    console.log(results);
    let i = 0; // インデックスを初期化

    function displayResult() {
        if (i < results.length) {
            const result = results[i];
            console.log(results);
            resultView["main"].style.display = "block";
            resultView["main"].style.backgroundColor = "#ff0000a0";

            if (["ron", "tsumo"].includes(result.type)){
                result.hands.push((result.type == "tsumo")? result.tsumo: result.discard);
                renderTiles(resultView["hands"], result.hands, "60px", false);
                renderMeldTiles(resultView["melds"], meldTiles[result.winp], "60px");  // fixme
                resultView["yaku"].innerHTML = "";
                for (var j = 0; j < result.hule.hupai.length; j++) resultView["yaku"].innerHTML += `<p>${result.hule.hupai[j].name}</p>`;
                resultView["score"].innerHTML = result.hule.defen;
            }
            else if ("drawn" == result.type){
                // 聴牌の人（自分以外）の手牌を可視化      
                resultView["main"].style.backgroundColor = "#ffffff30";
                resultView["yaku"].innerHTML = "";
                for (var j = 0; j < result.tenpais.length; j++) {
                    let player = result.tenpais[j].player;
                    let hands = result.tenpais[j].hands;
                    if (player != 0) 
                        renderTiles(handEls[player], hands, "30px", false, false, false);
                }        
            }
            else if ("drawn-mangan") {
                resultView["yaku"].innerHTML = "<p>流し満貫</p>";
                // resultView["score"].innerHTML = result.hule.defen;
            }
            else {
                resultView["main"].innerHTML = result.type;
            }
            i++; // インデックスを進める
        } else {
            resultView["main"].style.display = "none";
            socket.emit('confirmed', null); // iが最後まで到達したらsocket.emitを送信
        }
    }

    // 初回の呼び出し
    displayResult();

    // resultView要素をクリックしたときに次の結果を表示
    resultView["main"].addEventListener('click', displayResult);
});


socket.on('point', (points) => {
    for (var i = 0; i < points.length; i++){
        playerInfoEls[i]["point"].innerHTML = points[i];
    }
});


socket.on('game-status', (data) => {
    // data.seat : 起家は誰か（fixme : 誰が本局の親（東）かに変える）
    data.names.forEach((e, i)=>{
        playerInfoEls[i]["name"].innerHTML = e;
        playerInfoEls[i]["wind"].innerHTML = ["東", "南", "西", "北"][(i + data.seat + 4) % 4];
    });
});





// ゲームスタートボタンが押された時の処理
gameStartBtn.addEventListener('click', (event) => {
    socket.emit('start-game');
    music.play();
    music.loop = true;
});

musicBtn.addEventListener('click', (event)=>{
    if(music.muted == false){
        music.pause();
        music.muted = true;
    }else{
        music.play();
        music.muted = false;
    }
})



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
