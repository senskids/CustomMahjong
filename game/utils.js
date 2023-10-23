/* 麻雀に関係ないUtils */

/**
 * 配列をシャッフルする（array自身がシャッフルされる）
 * @param {Array} array  シャッフルしたい配列
 */
exports.shuffleArray = function(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/* 麻雀に関係あるUtils */

/**
 * Majiangライブラリ　https://github.com/kobalab/majiang-core
 */
const Majiang = require('@kobalab/majiang-core')  


/**
 * タイルID（0~135）からタイル（'m0', 's6'など）に変換する辞書
 */
const id2tile = ([...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `m${i}`)).concat(
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `p${i}`), 
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `s${i}`), 
    [...Array(28)].map((_,i) => parseInt(i / 4) + 1).map(i => `z${i}`));
id2tile[4 * 4 + 0] = 'm0';
id2tile[4 * 13 + 0] = 'p0';
id2tile[4 * 13 + 1] = 'p0';
id2tile[4 * 22 + 0] = 's0';
exports.id2tile = id2tile;


/** 幺九牌のリスト */
const yaojius = ['m1','m9','p1','p9','s1','s9','z1','z2','z3','z4','z5','z6','z7']
exports.yaojius = yaojius; 


/**
 * プレイヤーの手牌、鳴牌をMajiangライブラリの形式に変換する
 * @param {Array} hands        プレイヤーの手牌（タイルID表現） 
 * @param {Array} melds        プレイヤーの鳴牌（鳴牌表現）
 * @param {Number} tsumo       ツモがある場合ツモのライルID、ない場合はnullを指定
 * @returns {Majiang.Shoupai}  Majiang.Shoupaiの手牌表現
 */
function convert2Majiang(hands = [], melds = [], tsumo = null) {
    const ret = new Majiang.Shoupai([]);
    let tiles = hands.map((v,_) => id2tile[v]);
    tiles.forEach(t => {
        let t1 = t[0];
        let t2 = parseInt(t[1]);
        ret._bingpai[t1][t2] += 1;
        if (t2 == 0) ret._bingpai[t1][5] += 1;  // 0は赤5を示す
    });
    if (tsumo != null){
        ret._zimo = id2tile[tsumo];
    }
    melds.forEach(info => {
        let hs = info.hands.map((e, i) => (id2tile[e][1] != "0")? [parseInt(id2tile[e][1]) + 0.1 * i, id2tile[e][1]]: [4.5 + 0.1 * i, "0"]);
        if (info.from_who != null){  // 暗槓以外の場合
            let d = id2tile[info.discard];
            let ap = ['', '-', '=', '+'][info.from_who];
            hs = hs.concat([(d[1] != "0")? [parseInt(d[1]) + 0.25, d[1] + ap]: [4.75, `0${ap}`]]);
        }
        hs.sort((a, b) => a[0] - b[0]);
        let msg = id2tile[info.hands[0]][0];  // 'm', 'p', 's', 'z'
        hs.forEach(e=>{msg += e[1];});
        ret._fulou.push(msg);
    });
    return ret;
}
exports.convert2Majiang = convert2Majiang;


/**
 * 捨て牌に対し、チー出来る候補を列挙する関数
 * @param {*} hands    チー判定したいプレイヤーの手牌（タイルID表現） 
 * @param {*} discard  捨て牌（タイルID表現） 
 * @returns  チー出来る手牌の候補（タイルID表現）  
 * 例：'s6'に対し[['s4','s5'], ['s5','s7']]のように返す（実際はタイルID）          
 */
exports.canChi = function(hands, discard){
    const tiles = hands.map((v,_) => id2tile[v]);
    const tile = id2tile[discard];
    let k = tile[0];  // 'm', 'p', 's', 'z'
    if (k == 'z') return [];  // 字牌
    let cands = [...Array(7)].map((_,i) => [`${k}${i+1}`, `${k}${i+2}`, `${k}${i+3}`]).concat(
        [[`${k}3`, `${k}4`, `${k}0`], [`${k}4`, `${k}0`, `${k}6`], [`${k}0`, `${k}6`, `${k}7`]]);
    cands = cands.filter(arr => arr.includes(tile));
    cands = cands.map(arr => arr.filter(t => t != tile));
    const results = cands.filter(cand => cand.every(t => tiles.includes(t)));
    const ret = [];
    results.forEach(arr => {
        tile1 = hands[tiles.indexOf(arr[0])];
        tile2 = hands[tiles.indexOf(arr[1])];
        ret.push([tile1, tile2]);
    });
    return ret;
}


/**
 * 捨て牌に対し、ポン出来る候補を列挙する関数
 * @param {*} hands    ポン判定したいプレイヤーの手牌（タイルID表現） 
 * @param {*} discard  捨て牌（タイルID表現） 
 * @returns  ポン出来る手牌の候補（タイルID表現）  
 * 例：'s5'に対し[['s5','s5'], ['s5','s0']]のように返す（実際はタイルID表現）          
 */
exports.canPon = function(hands, discard){
    const tiles = hands.map((v,_) => id2tile[v]);
    const tile = id2tile[discard];
    const cands = (tile[1] == "0" || tile[1] == "5")? [`${tile[0]}0`, `${tile[0]}5`] : [tile];
    const same_tiles = tiles.filter(t => cands.includes(t));
    if (same_tiles.length < 2) return [];
    if (cands.length == 1){
        var idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
        return [[hands[idxs[0]], hands[idxs[1]]]];
    }
    else {  // 5の場合赤ドラと白の複合を考える
        var ridxs = tiles.reduce((acc, t, idx) => (t == `${tile[0]}0` ? [...acc, idx] : acc), []);
        var widxs = tiles.reduce((acc, t, idx) => (t == `${tile[0]}5` ? [...acc, idx] : acc), []);
        if (widxs.length == 0) return [[hands[ridxs[0]], hands[ridxs[1]]]];  // 赤が2枚
        if (ridxs.length == 0) return [[hands[widxs[0]], hands[widxs[1]]]];  // 白が2枚
        if (ridxs.length == 1 && widxs.length == 1) return [[hands[widxs[0]], hands[ridxs[0]]]];
        if (ridxs.length == 1 && widxs.length > 1) return [[hands[widxs[0]], hands[widxs[1]]], [hands[widxs[0]], hands[ridxs[0]]]];
        if (widxs.length == 1 && ridxs.length > 1) return [[hands[widxs[0]], hands[ridxs[0]]], [hands[ridxs[0]], hands[ridxs[1]]]];
        // 同じ牌が4枚しかないなら赤2枚、白2枚はありえない
        console.log("[ERROR, canPon]");
        return [];
    }
}


/**
 * 捨て牌に対し、明槓出来る候補を列挙する関数
 * @param {*} hands    明槓判定したいプレイヤーの手牌（タイルID表現） 
 * @param {*} discard  捨て牌（タイルID表現） 
 * @returns  明槓出来る手牌の候補（タイルID表現、2次元配列なことに注意）  
 * 例：'s5'に対し[['s5','s5','s0']]のように返す（実際はタイルID表現）          
 */
exports.canKan = function(hands, discard){
    const tiles = hands.map((v,_) => (id2tile[v][1] == "0")? `${id2tile[v][0]}5`: id2tile[v]);
    const tile = (id2tile[discard][1] == "0")? `${id2tile[discard][0]}5`: id2tile[discard];
    const idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
    if (idxs.length < 3) return [];
    return [[hands[idxs[0]], hands[idxs[1]], hands[idxs[2]]]];
}


/**
 * 暗槓できる候補を列挙する関数
 * @param {*} hands    暗槓判定したいプレイヤーの手牌（タイルID表現） 
 * @returns  暗槓出来る手牌の候補（タイルID表現、2次元配列なことに注意）  
 * 例：[['s1','s1','s1','s1'],['s3','s3','s3','s3']]のように返す（実際はタイルID表現）          
 */
exports.canAnkan = function(hands){
    const tiles = hands.map((v,_) => (id2tile[v][1] == "0")? `${id2tile[v][0]}5`: id2tile[v]);
    const unique_tiles = [...new Set(tiles)];
    const ret = [];
    for (var i = 0; i < unique_tiles.length; i++){
        let tile = unique_tiles[i];
        let idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
        if (idxs.length >= 4) ret.push([hands[idxs[0]], hands[idxs[1]], hands[idxs[2]], hands[idxs[3]]]);
    }
    return ret;
}


/**
 * 立直している時に暗槓できる候補を列挙する関数  
 * 立直中は待ちが変わらない暗槓はできる
 * @param {*} myhands    暗槓判定したいプレイヤーの手牌（タイルID表現） 
 * @param {Array} mymelds         プレイヤーの鳴き牌（鳴き牌表現） 
 * @param {Number} tsumo          ツモした牌のタイルID（ない場合null）
 * @returns  暗槓出来る手牌の候補（タイルID表現、2次元配列なことに注意）  
 * 例：[['s1','s1','s1','s1'],['s3','s3','s3','s3']]のように返す（実際はタイルID表現）          
 */
exports.canAnkanInRiichi = function(myhands, mymelds, tsumo){
    const ankan_cands = exports.canAnkan(myhands);
    const origin_winning_tiles = exports.getWinningTiles(myhands, mymelds, tsumo);  // 立直時の待ち牌
    const ret = [];
    for (var i = 0; i < ankan_cands.length; i++){
        // 仮想暗槓する
        let dummy_hands = myhands.filter(e => !(ankan_cands[i].includes(e)));
        let dummy_melds = [...mymelds];
        dummy_melds.push({ type: "ankan", from_who: null, discard: null, hands: [...ankan_cands[i]]});
        let winning_tiles = exports.getWinningTiles(dummy_hands, dummy_melds, null);  // 仮想暗槓の待ち牌
        if (origin_winning_tiles.length == winning_tiles.length && origin_winning_tiles.every((value, index) => value == winning_tiles[index])) ret.push([...ankan_cands[i]]);
    }
    return ret;
}


/**
 * 加槓できる候補を列挙する関数
 * @param {*} hands    加槓判定したいプレイヤーの手牌（タイルID表現） 
 * @param {*} melds    加槓判定したいプレイヤーの鳴き牌（鳴き牌表現） 
 * @returns  加槓出来る手牌の候補（タイルID表現、1次元配列なことに注意）  
 * 例：['s1','s4']のように返す（実際はタイルID表現）          
 */
exports.canKakan = function(hands, melds){
    const tiles = hands.map((v,_) => (id2tile[v][1] == "0")? `${id2tile[v][0]}5`: id2tile[v]);
    const ret = [];
    for (var i = 0; i < melds.length; i++){
        if (melds[i].type != 'pon') continue;
        let tgt =  id2tile[melds[i].discard]; 
        if (tgt[1] == "0") tgt = `${tgt[0]}5`;
        const idx = tiles.indexOf(tgt);
        if (idx >= 0)
            ret.push(hands[idx]);
    }
    return ret;
}


/**
 * リーチできるかチェックする
 * @param {Array} hands  判定したいプレイヤーの手牌（タイルID表現） 
 * @param {Array} melds  判定したいプレイヤーの鳴き牌（鳴き牌表現） 
 * @returns {Array}      捨てて立直できる手牌の候補（タイルID表現）
 * 例：['s1','s4']のように返す（実際はタイルID表現）          
 */
exports.canRiichi = function(hands, melds){
    const ret = [];
    for(var i = 0; i < hands.length; i++){
        const subhands = hands.filter((v, j) => i != j);
        const xiangting_num = Majiang.Util.xiangting(convert2Majiang(subhands, melds, null))
        if (xiangting_num == 0) ret.push(hands[i]);
    }
    return ret;
}


/**
 * ツモあがりできるかチェックする
 * @param {Array} hands       プレイヤーの手牌、ツモ牌も含む（タイルID表現） 
 * @param {Array} melds       プレイヤーの鳴き牌（鳴き牌表現） 
 * @param {Number} tsumo      ツモした牌のタイルID
 * @param {JSON} field_info   FIXME
 * @returns {*}      Majiangライブラリのhule情報（json）
 */
exports.canTsumo = function(hands, melds, tsumo, field_info){
    const obj = getObj(field_info);
    const ret = Majiang.Util.hule(convert2Majiang(hands, melds, tsumo), null, obj);
    return ret;
}


/**
 * ロンあがりできるかチェックする
 * @param {Array} myhands         プレイヤーの手牌、ツモ牌も含む（タイルID表現） 
 * @param {Array} mymelds         プレイヤーの鳴き牌（鳴き牌表現） 
 * @param {Number} discard        捨牌のタイルID
 * @param {Number} seat_relation  プレイヤーと捨牌プレイヤーの座席関係（0～3）
 * @param {JSON} field_info       FIXME
 * @returns {*}      Majiangライブラリのhule情報（json）
 */
exports.canRon = function(myhands, mymelds, discard, seat_relation, field_info){
    const d_tile = id2tile[discard] + ["","-","=","+"][seat_relation];
    const obj = getObj(field_info);
    let ret = Majiang.Util.hule(convert2Majiang(myhands, mymelds, null), d_tile, obj);
    // 人和の反映（Majiangライブラリに実装されていない）
    if (ret != undefined && field_info.hupai.tianhu == 3) {
        let p1_seat_id = field_info.menfeng;
        let p2_seat_id = (p1_seat_id + seat_relation) % 4;
        ret = updateHuleWithRenhe(ret, p1_seat_id, p2_seat_id, field_info);
    }
    return ret;
}


/**
 * 九種九牌宣言できるか確認する
 * @param {Array} hands  プレイヤーの手牌、ツモ牌も含む（タイルID表現） 
 * @return {Boolean} 
 */
exports.canNineDiffTerminalTiles = function(hands){
    const cands = [];
    for (var i = 0; i < hands.length; i++) {
        if (yaojius.includes(id2tile[hands[i]]) && !cands.includes(id2tile[hands[i]])) cands.push(id2tile[hands[i]]);
    }
    return cands.length >= 9;
}


/**
 * 待ち牌のリストを取得する  
 * 役無しの牌も含むことに注意
 * @param {Array} myhands         プレイヤーの手牌、ツモ牌も含む（タイルID表現） 
 * @param {Array} mymelds         プレイヤーの鳴き牌（鳴き牌表現） 
 * @param {Number} tsumo          ツモした牌のタイルID（ない場合null）
 * @returns {Array}      待ち牌のリスト（牌表現） 聴牌でない時は[]
 */
exports.getWinningTiles = function(myhands, mymelds, tsumo){
    const hands = (tsumo == null)? myhands.slice(): myhands.slice(0, -1);
    const shoupai = convert2Majiang(hands, mymelds, null);
    const cands = Majiang.Util.tingpai(shoupai);
    const xiangting_num = Majiang.Util.xiangting(shoupai);
    if (xiangting_num == 0) return cands;
    else return [];
}


/**
 * 鳴いた際に捨ててはいけない牌のリストを取得する
 * @param {Array} from_hands    手出し牌のリスト
 * @param {Array} from_discard  捨て牌
 * @param {String} meld_type    鳴きの種類（'pon', 'chi', 'kan'）のいずれか
 * @returns {Array}  捨ててはいけない牌のリスト（タイルID表現）
 */
exports.getForbiddenTilesForMeld = function(from_hands, from_discard, meld_type){
    if (meld_type == 'kan') return [];  // 1種につき4枚しかないので、喰い変えは発生しない
    if (meld_type == 'pon') return [...Array(4)].map((_,i) => parseInt(from_discard / 4) * 4 + i);
    if (from_hands.length != 2) console.log("[ERROR, utils.js, getForbiddenTilesForMeld] something wrong");
    if (from_hands[0] > from_hands[1]) console.log("[ERROR, utils.js, getForbiddenTilesForMeld] something wrong");
    let cands = [from_discard];
    const tiles = [from_hands[0], from_hands[1], from_discard].map((v,_) => (id2tile[v][1] == "0")? 5: parseInt(id2tile[v][1]));
    if (tiles[1] - tiles[0] == 1){  
        if ((tiles[2] - tiles[1] == 1) && tiles[0] != 1) cands.push(from_hands[0] - 4);  // [5, 6, 7] => [5, 6, 7, 4]
        else if ((tiles[0] - tiles[2] == 1) && tiles[1] != 9) cands.push(from_hands[1] + 4);  // [5, 6, 4] => [5, 6, 4, 7]
    }
    let ret = [];
    for (var i = 0; i < cands.length; i++){
        let t = parseInt(cands[i] / 4) * 4;
        ret = ret.concat([t, t+1, t+2, t+3]);
    }
    return ret;
}


/**
 * FIXME
 * あがり判定のための場の状況（風、ドラ、嶺上ツモ、海底ツモなど）のjsonを取得する
 * @param {JSON} field_info  FIXME　場の状況
 * @returns {JSON} 
 */
getObj = function(field_info){
    return {
        rule:           Majiang.rule(),
        zhuangfeng:     field_info.zhuangfeng,   // 場風
        menfeng:        field_info.menfeng,      // 自風
        baopai:         field_info.baopai.map(e=>id2tile[e]),        // ドラ表示牌の配列
        fubaopai:       field_info.fubaopai.map(e=>id2tile[e]),      // 裏ドラ表示牌の配列
        hupai: {
            lizhi:      field_info.hupai.lizhi,        // 立直なし0, 立直1, ダブリー2
            yifa:       field_info.hupai.yifa,         // 一発
            qianggang:  field_info.hupai.qianggang,    // 槍槓
            lingshang:  field_info.hupai.lingshang,    // 嶺上
            haidi:      field_info.hupai.haidi,        // 0: ハイテイなし、1: ハイテイツモ、2: ハイテイロン  FIXME
            tianhu:     field_info.hupai.tianhu,       // 0: 天和/地和なし、1: 天和、2: 地和   FIXME
        },
        jicun: {
            changbang:  field_info.jicun.changbang,    // 積み棒の本数
            lizhibang:  field_info.jicun.lizhibang,    // 立直棒の本数   // FIXME
        }
    }
}


/**
 * あがり役に人和を追加する
 */
updateHuleWithRenhe = function(hule, p1, p2, field_info) {
    let hupai = [ {name: '人和', fanshu: '*'} ];
    let damanguan = 1;
    if (hule.hupai != undefined){
        for (var i = 0; i < hule.hupai.length; i++) {
            if (hule.hupai[i].fanshu === '*'){
                hupai.push(hule.hupai[i]);
                damanguan += 1;
            }
            else if (hule.hupai[i].fanshu === '**') {
                hupai.push(hule.hupai[i]);
                damanguan += 2;
            }
        }
    }
    let defen = 32000 * damanguan;  // 親はありえない
    let fenpei = [0, 0, 0, 0];
    fenpei[p1] = defen + field_info.jicun.changbang * 300 + field_info.jicun.lizhibang * 1000;
    fenpei[p2] = -(defen + field_info.jicun.changbang * 300);
    const ret = {
        hupai: hupai, 
        fu: undefined,
        fanshu: undefined,
        damanguan: damanguan,
        defen: defen,
        fenpei: [...fenpei],
    }
    return ret;
}

