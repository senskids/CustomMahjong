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
 * @returns {Boolean}         ツモあがりできるか否か
 */
exports.canTsumo = function(hands, melds, tsumo, field_info){
    const obj = getObj(field_info);
    const ret = Majiang.Util.hule(convert2Majiang(hands, melds, tsumo), null, obj);
    return ret != undefined && ret.defen != 0;
}


/**
 * FIXME、フリテンを考慮していない
 * ロンあがりできるかチェックする
 * @param {Array} myhands         プレイヤーの手牌、ツモ牌も含む（タイルID表現） 
 * @param {Array} mymelds         プレイヤーの鳴き牌（鳴き牌表現） 
 * @param {Number} discard        捨牌のタイルID
 * @param {Number} seat_relation  プレイヤーと捨牌プレイヤーの座席関係（0～3）
 * @param {JSON} field_info       FIXME
 * @returns {Boolean}             ロンあがりできるか否か
 */
exports.canRon = function(myhands, mymelds, discard, seat_relation, field_info){
    const d_tile = id2tile[discard] + ["","-","=","+"][seat_relation];
    const obj = getObj(field_info);
    const ret = Majiang.Util.hule(convert2Majiang(myhands, mymelds, null), d_tile, obj);
    return ret != undefined && ret.defen != 0;
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
        fubaopai:       (field_info.fugaopai != null)? field_info.fugaopai.map(e=>id2tile[e]): null,   // 裏ドラ表示牌の配列
        hupai: {
            lizhi:      field_info.lizhi,        // 立直なし0, 立直1, ダブリー2
            yifa:       field_info.yifa,         // 一発
            qianggang:  field_info.qianggang,    // 槍槓
            lingshang:  field_info.lingshang,    // 嶺上
            haidi:      field_info.haidi,    // 0: ハイテイなし、1: ハイテイツモ、2: ハイテイロン  FIXME
            tianhu:     field_info.tianhu,   // 0: 天和/地和なし、1: 天和、2: 地和   FIXME
        },
        jicun: {
            changbang:  field_info.changbang,    // 積み棒の本数
            lizhibang:  field_info.lizhibang,    // 立直棒の本数   // FIXME
        }
    }
}
