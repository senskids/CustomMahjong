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

// ゲームルール
const gameRule = {"washizu": false, "nextview": false};
const gameRuleBtn = {
    "washizu": document.getElementById("washizu-btn"), 
    "nextview": document.getElementById("nextview-btn"), 
};

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
            renderHandTiles(handEls[0], handTiles[0], handTileSizes[0], true, null, false);
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
const handTileSizes = [100, 30, 30, 30];
const discardTileSizes = [60, 60, 60, 60];
const meldTileSizes = [60, 40, 40, 40];

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
let riichiTurns = [null, null, null, null];   // 立直の際の捨て牌の位置
let lastCommands = [null, null, null, null];  // 各プレイヤーの直前のコマンド

/**
 * 手牌エリアを描画する関数
 * @param {Element} el                描画するhtmlエレメント
 * @param {Array} tiles               描画する手牌（タイルID表現）
 * @param {Number} imgWidth           手牌の描画サイズ（imgWidth[px]）
 * @param {Boolean} isDrawSpace       ツモ表現（最後の牌の前に少し空間を設ける）を適用するか否か
 * @param {Number} spaceIdx           spaceIdx番目の前に1牌分スペースを開ける。開けない場合null（間隔を開けた後0.3秒後にrenderしなおす）
 * @param {Boolean} isClickListener   手牌クリック時にdiscard-tileイベントを送信するか
 */
function renderHandTiles(el, tiles, imgWidth, isDrawSpace, spaceIdx, isClickListener){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    tiles.forEach((tile, idx) => {
        const tileEl = document.createElement('img');
        // 鷲巣麻雀
        if (gameRule.washizu && tile % 4 != 0) tileEl.classList.add("opacity-tile");
        tileEl.src = key2fname_map[tile];
        tileEl.alt = tile;
        let style = `width: ${imgWidth}px;`;
        // 下記2個のifが両方同時にtrueになることはない（ツモ切りのspaceIdxはtile.length）
        // ツモ牌の場合、手牌と少し空間をあける
        if (isDrawSpace && (idx == tiles.length - 1)) {
            style += style + ` margin-left: ${parseInt(imgWidth/2)}px;`;
        }
        // 牌を切った場合、切った牌の場所に空間をあける。0.3秒後に手牌をソートして再レンダリングする
        if (idx === spaceIdx) {
            style += style + ` margin-left: ${imgWidth}px;`;
            window.setTimeout(()=>{ 
                tiles.sort((a, b) => a - b);
                renderHandTiles(el, tiles, imgWidth, false, null, false);
            }, 300);
        }
        tileEl.style = style;
        el.appendChild(tileEl);
        // 手牌クリック時にdiscard-tileイベントを発生させる
        if (isClickListener){
            tileEl.addEventListener('click', () => {
                socket.emit('discard-tile', tile);
            })
        }
    });
}
/**
 * 捨牌エリアを描画する関数
 * @param {Element} el            描画するhtmlエレメント
 * @param {Array} tiles           描画する捨牌（タイルID表現）
 * @param {Number} imgWidth       捨牌の描画サイズ（imgWidth[px]）
 * @param {Number} riichiTurnIdx  立直宣言牌のindex。立直宣言していない場合null
 */
function renderDiscardTiles(el, tiles, imgWidth, riichiTurnIdx = null) {
    while(el.firstChild) el.removeChild(el.firstChild);  
    // 描画
    tiles.forEach((tile, idx) => {
        const tileEl = document.createElement('img');
        tileEl.src = key2fname_map[tile];
        tileEl.alt = tile;
        // 鷲巣麻雀
        if (gameRule.washizu && tile % 4 != 0) tileEl.classList.add("opacity-tile");
        if (idx != riichiTurnIdx){
            tileEl.style = `width: ${imgWidth}px; transform: translate(0)`;
            el.appendChild(tileEl);
        }
        else {
            const H = parseInt(imgWidth * (tileEl.height / tileEl.width));
            const L = parseInt((H - imgWidth) / 2);
            const divEl = document.createElement('div');
            divEl.style = `display: inline-block; width: ${H - L}px; `;
            tileEl.style = `width: ${imgWidth}px; margin-left: ${L}px; transform:rotate(90deg);`;
            divEl.append(tileEl);
            el.appendChild(divEl);
        }
    });
}
/**
 * 鳴き牌エリアを描画する関数
 * @param {Element} el            描画するhtmlエレメント
 * @param {Array} tiles           描画する公開面子（meld表現）
 * @param {Number} imgWidth       牌の描画サイズ（imgWidth[px]）
 */
function renderMeldTiles(el, tiles, imgWidth){
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    let X = 0;  // 描画する牌の左端の補正座標(px)
    const W1 = imgWidth;  
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
            // 鷲巣麻雀
            if (gameRule.washizu && renderTiles[i] % 4 != 0) tileEl.classList.add("opacity-tile");
            if (renderOpts[i] == 0) {      // 通常の手出し牌
                tileEl.style = `width: ${W1}px; transform: translate(${X}px);`;
                X -= W10;
            }
            else if (renderOpts[i] == 1){  // 鳴き牌
                X += W4;
                tileEl.style = `width: ${W1}px; transform: rotate(90deg) translate(${ROT1}px, ${-X}px);`;
                X -= SP;
            }
            else {  // 加槓牌
                X -= (W1 - SP);
                tileEl.style = `width: ${W1}px; transform: rotate(90deg) translate(${-ROT2}px, ${-X}px);`;
            }
            el.appendChild(tileEl);
        }
        X += W3;
    });
}
renderDoraTiles = function(el, tiles, img_width){
    const backcard_id = key2fname_map.length - 1;
    while(el.firstChild) el.removeChild(el.firstChild);  // 全要素を一旦削除
    const iMax = gameRule.washizu? tiles.length: 5;
    for (var i = 0; i < iMax; i++){  // ドラ表示が5枚になるようにする
        const tileEl = document.createElement('img');
        // 鷲巣麻雀
        if (gameRule.washizu && tiles[i] % 4 != 0) tileEl.classList.add("opacity-tile");
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
        renderHandTiles(handEls[i], handTiles[i], handTileSizes[i], false, null, i == 0);
        renderDiscardTiles(discardEls[i], discardTiles[i], discardTileSizes[i], riichiTurns[i]);
        renderMeldTiles(meldEls[i], meldTiles[i], meldTileSizes[i]);
    }
    renderDoraTiles(doraEl, doraTiles, "60px");
});


// WebSocketでサーバからのデータを受信する処理
socket.on('diff-data', (data) => {
    // ゲームの状態を更新する
    if ("enable_actions" in data)
        update_actions(data.enable_actions);

    // ドラ更新
    if (data.action == 'dora'){
        doraTiles.push(data.tile);
        renderDoraTiles(doraEl, doraTiles, "60px");
        return;
    }
    // ツモ
    else if (['draw', 'replacement-draw'].includes(data.action)){
        const p = data.player;
        handTiles[p].push(data.tile);
        tileNum.textContent = data.remain_tile_num;  // 残り牌数を更新する
        lastCommands[p] = 'draw';
        renderHandTiles(handEls[p], handTiles[p], handTileSizes[p], true, null, p == 0);
        if (data.opt != null) console.log(data.opt.next_tsumo);
        return;
    }
    // 捨て牌
    else if(data.action == 'discard'){
        const p = data.player;
        let discardIdx = handTiles[p].indexOf(data.tile);
        if (discardIdx != -1) {
            handTiles[p] = handTiles[p].filter(item => item != data.tile)
        }
        else if (p != 0){
            if(data.is_tsumo_giri) {
                discardIdx = handTiles[p].length - 1;
            }
            else {
                discardIdx = Math.floor(Math.random() * (handTiles[p].length - 1));
            }
            handTiles[p].splice(discardIdx, 1);
        }
        else 
            console.log("[ERROR C]");
        discardTiles[p].push(data.tile);
        const isDraw = (lastCommands[p] == 'draw') && !data.is_tsumo_giri;
        lastCommands[p] = 'discard';
        renderHandTiles(handEls[p], handTiles[p], handTileSizes[p], isDraw, discardIdx, p == 0);
        renderDiscardTiles(discardEls[p], discardTiles[p], discardTileSizes[p], riichiTurns[p]);
        return;
    }
    // 他家から鳴き
    else if(data.action == 'pon' || data.action == 'chi' || data.action == 'kan'){
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
        lastCommands[p1] = 'meld';
        renderHandTiles(handEls[p1], handTiles[p1], handTileSizes[p1], false, null, p1 == 0);
        renderMeldTiles(meldEls[p1], meldTiles[p1], meldTileSizes[p1]);
        renderDiscardTiles(discardEls[p2], discardTiles[p2], discardTileSizes[p2], riichiTurns[p2]);
        if (data.opt != null) console.log("a", data.opt.next_tsumo);
        return;
    }
    // 自分からカン
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
        else if (data.action == 'kakan'){ 
            for(var t = 0; t < meldTiles[p].length; t++){
                if (parseInt(meld_info.hands[0] / 4) == parseInt(meldTiles[p][t].discard / 4)) {
                    meldTiles[p][t].hands.push(meld_info.hands[0]);
                    meldTiles[p][t].type = 'kakan';
                }
            }
        }        
        lastCommands[p] = 'mykan';
        renderHandTiles(handEls[p], handTiles[p], handTileSizes[p], false, null, p == 0);
        renderMeldTiles(meldEls[p], meldTiles[p], meldTileSizes[p]);
        if (data.opt != null) console.log("a", data.opt.next_tsumo);
        return;
    }
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
    else
        showCandidate(data);
});

// 鳴きの候補を表示する
function showCandidate(arrs) {
    // action areaを非表示にする
    const actionArea = document.getElementById("action-area");
    actionArea.style.display = "none";
    // meld-cand-areaに牌を表示する
    const parent = document.getElementById("meld-cand-area2");
    for (var i = 0; i < arrs.length; i++) {
        const divEl = document.createElement('div');
        divEl.classList.add("cand");
        for (var j = 0; j < arrs[i].length; j++) {
            const imgEl = document.createElement('img');
            imgEl.src = key2fname_map[arrs[i][j]];
            imgEl.style = `width: ${discardTileSizes[0]}px;`;
            divEl.append(imgEl)
        }
        let tgt = arrs[i].map(v=>v);  // 下の関数で参照するためにコピー
        divEl.addEventListener('click', () => {
            // meld-candがクリックされたらサーバーに送信してaction areaを表示する
            socket.emit('select-meld-cand', tgt);
            const parent = document.getElementById("meld-cand-area2");
            while(parent.firstChild) parent.removeChild(parent.firstChild);  
            const actionArea = document.getElementById("action-area");
            actionArea.style.display = "flex";
        });
        parent.appendChild(divEl);
    }
}


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
                renderHandTiles(resultView["hands"], result.hands, 60, true, null, false);
                renderMeldTiles(resultView["melds"], meldTiles[result.winp], "60px");
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
                        renderHandTiles(handEls[player], hands, 30, false, null, false);
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
    // ゲームルールを取得する
    if (data.rule === "washizu") {
        gameRule.washizu = true;
        gameRule.nextview = false;
        gameRuleBtn.washizu.checked = true;
        gameRuleBtn.nextview.checked = false;
    }
    else if (data.rule === "nextview"){
        gameRule.washizu = false;
        gameRule.nextview = true;
        gameRuleBtn.washizu.checked = false;
        gameRuleBtn.nextview.checked = true;
    }
    else {
        gameRule.washizu = false;
        gameRule.nextview = false;
        gameRuleBtn.washizu.checked = false;
        gameRuleBtn.nextview.checked = false;
    }

    // data.seat : 起家は誰か（fixme : 誰が本局の親（東）かに変える）
    data.names.forEach((e, i)=>{
        playerInfoEls[i]["name"].innerHTML = e;
        playerInfoEls[i]["wind"].innerHTML = ["東", "南", "西", "北"][(i + data.seat + 4) % 4];
    });
});





// ゲームスタートボタンが押された時の処理
gameStartBtn.addEventListener('click', (event) => {
    gameRule.washizu = gameRuleBtn.washizu.checked;
    gameRule.nextview = gameRuleBtn.nextview.checked;
    socket.emit('start-game', gameRule);
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
