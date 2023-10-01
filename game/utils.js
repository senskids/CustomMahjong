/* 麻雀に関係ないUtils */
// 配列をシャッフルする（array自身がシャッフルされる）
exports.shuffleArray = function(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/* 麻雀に関係あるUtils */
const Majiang = require('@kobalab/majiang-core')  // https://github.com/kobalab/majiang-core

const id2tile = ([...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `m${i}`)).concat(
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `p${i}`), 
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `s${i}`), 
    [...Array(28)].map((_,i) => parseInt(i / 4) + 1).map(i => `z${i}`));
id2tile[4 * 4 + 0] = 'm0';
id2tile[4 * 13 + 0] = 'p0';
id2tile[4 * 13 + 1] = 'p0';
id2tile[4 * 22 + 0] = 's0';
exports.id2tile = id2tile;

exports.canChi = function(hands, discard){
    const tiles = hands.map((v,_) => id2tile[v]);
    const tile = id2tile[discard];
    let k = tile[0];  // 'm', 'p', 's', 'z'
    let v = tile[1];  // '0' ~ '9'
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

exports.canPon = function(hands, discard){
    const tiles = hands.map((v,_) => id2tile[v]);
    const tile = id2tile[discard];
    const cands = (tile[1] == "0" || tile[1] == "5")? [`${tile[0]}0`, `${tile[0]}5`] : [tile];
    const same_tiles = tiles.filter(t => cands.includes(t));
    if (same_tiles.length < 2) return [];
    console.log(tiles, tile, cands, same_tiles);
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
        console.log("[ERROR E]");
        return [];
    }
}

exports.canKan = function(hands, discard){
    const tiles = hands.map((v,_) => (id2tile[v][1] == "0")? `${id2tile[v][0]}5`: id2tile[v]);
    const tile = (id2tile[discard][1] == "0")? `${id2tile[discard][0]}5`: id2tile[discard];
    const idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
    if (idxs.length < 3) return [];
    return [[hands[idxs[0]], hands[idxs[1]], hands[idxs[2]]]];
}

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

exports.canKakan = function(hands, melds){
    const tiles = hands.map((v,_) => (id2tile[v][1] == "0")? `${id2tile[v][0]}5`: id2tile[v]);
    const ret = [];
    for (var i = 0; i < melds.length; i++){
        if (melds[i].type != 'pon') continue;
        let tgt =  id2tile[melds[i].from_discard]; 
        if (tgt[1] == "0") tgt = `${tgt[0]}5`;
        const idx = tiles.indexOf(tgt);
        if (idx >= 0)
            ret.push(hands[idx]);
    }
    return ret;
}

// 手牌と鳴牌をMajiangライブラリの文字表現にコンバートする
convert2Majiang = function(hands = [], melds = [], tsumo = null) {
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
        let hs = info.from_hands.map((e, i) => (id2tile[e][1] != "0")? [parseInt(id2tile[e][1]) + 0.1 * i, id2tile[e][1]]: [4.5 + 0.1 * i, "0"]);
        if (info.from_who != 0){  // 暗槓以外の場合
            let d = id2tile[info.from_discard];
            let ap = ['', '-', '=', '+'][info.from_who];
            hs = hs.concat([(d[1] != "0")? [parseInt(d[1]) + 0.25, d[1] + ap]: [4.75, `0${ap}`]]);
        }
        hs.sort((a, b) => a[0] - b[0]);
        let msg = id2tile[info.from_hands[0]][0];  // 'm', 'p', 's', 'z'
        hs.forEach(e=>{msg += e[1];});
        ret._fulou.push(msg);
    });
    return ret;
}
exports.convert2Majiang;

// リーチできるかチェックする  
exports.canRiichi = function(hands, melds){
    const ret = [];
    for(var i = 0; i < hands.length; i++){
        const subhands = hands.filter((v, j) => i != j);
        const xiangting_num = Majiang.Util.xiangting(convert2Majiang(subhands, melds, null))
        if (xiangting_num == 0) ret.push(hands[i]);
    }
    console.log(ret);
    return ret;
}

// FIXME どうやるか...
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

// ロンできるかチェックする
// myhands, mymelds : 手牌, 鳴牌, 他家の捨牌
// discard, seat_relation : 他家の捨牌, 他家との座席関係
// field_info : フリテンなど色々な情報
exports.canRon = function(myhands, mymelds, discard, seat_relation, field_info){
    const d_tile = id2tile[discard] + ["","-","=","+"][seat_relation];
    const obj = getObj(field_info);
    console.log(myhands, mymelds, null, d_tile);
    console.log(convert2Majiang(myhands, mymelds, null));
    const ret = Majiang.Util.hule(convert2Majiang(myhands, mymelds, null), d_tile, obj);
    return ret != undefined && ret.defen != 0;
}

// ツモあがりできるかチェックする
// handsはtsumoを含んでいる
exports.canTsumo = function(hands, melds, tsumo, field_info){
    const obj = getObj(field_info);
    const ret = Majiang.Util.hule(convert2Majiang(hands, melds, tsumo), null, obj);
    return ret != undefined && ret.defen != 0;
}