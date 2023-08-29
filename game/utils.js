const Majiang = require('@kobalab/majiang-core')  // https://github.com/kobalab/majiang-core


const id2tile = ([...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `m${i}`)).concat(
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `p${i}`), 
    [...Array(36)].map((_,i) => parseInt(i / 4) + 1).map(i => `s${i}`), 
    [...Array(28)].map((_,i) => parseInt(i / 4) + 1).map(i => `z${i}`));
id2tile[4 * 4 + 0] = 'm5r';
id2tile[4 * 13 + 0] = 'p5r';
id2tile[4 * 13 + 1] = 'p5r';
id2tile[4 * 22 + 0] = 's5r';
exports.id2tile;

// 配列をシャッフルする（array自身がシャッフルされる）
exports.shuffleArray = function(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 牌のid (数字) をMajiangライブラリの牌表現（'m5'など）にコンバートする
convert2Majiang = function(hands = [], melds = [], tsumo = null) {
    const ret = new Majiang.Shoupai([]);
    let tiles = hands.map((v,_) => id2tile[v]);
    tiles.forEach(t => {
        let t1 = t[0];
        let t2 = parseInt(t[1]);
        ret._bingpai[t1][t2] += 1;
        if (t.length == 3) ret._bingpai[t1][0] += 1;
    });
    if (tsumo != null){
        ret._zimo = (id2tile[tsumo].length < 3)? id2tile[tsumo]: (id2tile[tsumo][0] + "0");
    }
    melds.forEach(info => {
        // FIXME ankanの場合バグる
        var d = id2tile[info.from_discard];
        let k = d[0];  // kind of tile
        let ap = ['', '-', '=', '+'][info.from_who];  
        var a = (d.length < 3)? [parseInt(d[1]) + 0.25, d[1] + ap]: [4.75, `0${ap}`];
        let hs = info.from_hands.map((e, i) => (id2tile[e].length < 3)? [parseInt(id2tile[e][1]) + 0.1 * i, id2tile[e][1]]: [4.5 + 0.1 * i, "0"]).concat([a]);
        hs.sort((a, b) => a[0] - b[0]);
        let msg = k;
        hs.forEach(e=>{msg += e[1];});
        ret._fulou.push(msg);
    });
    return ret;
}
exports.convert2Majiang;

exports.canChi = function(hands, discard){
    const tiles = hands.map((v,_) => id2tile[v]);
    const tile = id2tile[discard].slice(0, 2);
    k = tile[0];  
    v = tile[1];   
    if (k == 'z') return [];
    cands = [...Array(7)].map((_,i) => [`${k}${i+1}`, `${k}${i+2}`, `${k}${i+3}`]).concat([
        [`${k}3`, `${k}4`, `${k}5r`], [`${k}4`, `${k}5r`, `${k}6`], [`${k}5r`, `${k}6`, `${k}7`]]);
    cands = cands.filter(arr => arr.includes(tile));
    cands = cands.map(arr => arr.filter(t => t !== tile));
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
    const tiles = hands.map((v,_) => id2tile[v].slice(0, 2));
    const tile = id2tile[discard].slice(0, 2);
    const same_tiles = tiles.filter(t => t == tile);
    if (same_tiles.length < 2) return [];
    if (tile.slice(1, 2) != '5'){
        var idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
        return [[hands[idxs[0]], hands[idxs[1]]]];
    }
    else {  // 5の場合赤ドラと白の複合を考える
        var ridxs = tiles.reduce((acc, t, idx) => (t == `${tile[0]}5r` ? [...acc, idx] : acc), []);
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
    const tiles = hands.map((v,_) => id2tile[v].slice(0, 2));
    const tile = id2tile[discard].slice(0, 2);
    const idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
    if (idxs.length < 3) return [];
    return [[hands[idxs[0]], hands[idxs[1]], hands[idxs[2]]]];
}

exports.canAnkan = function(hands){
    const tiles = hands.map((v,_) => id2tile[v].slice(0, 2));
    const unique_tiles = [...new Set(tiles)];
    const ret = [];
    for (var i = 0; i < unique_tiles.length; i++){
        var tile = unique_tiles[i];
        var idxs = tiles.reduce((acc, t, idx) => (t == tile ? [...acc, idx] : acc), []);
        if (idxs.length >= 4) ret.push([hands[idxs[0]], hands[idxs[1]], hands[idxs[2]], hands[idxs[3]]]);
    }
    return ret;
}

exports.canKakan = function(hands, melds){
    console.log("canKakan is not implemented");
    return [];
}

// リーチできるかチェックする
exports.canRiichi = function(hands, melds){
    const ret = [];
    for(var i = 0; i < hands.length; i++){
        const subhands = hands.filter((v, j) => i != j);
        const xiangting_num = Majiang.Util.xiangting(convert2Majiang(subhands, melds, null))
        console.log(xiangting_num);
        if (xiangting_num == 0){
            ret.push(hands[i]);
        }
    }
    return ret;
}

exports.canRon = function(myhands, mymelds, from_who, mydiscard, field_info){
    console.log(field_info);
    let obj = {
        rule:           Majiang.rule(),
        zhuangfeng:     field_info.zhuangfeng,      // 場風
        menfeng:        field_info.menfeng,      // 自風
        baopai:         field_info.baopai.map(e=>id2tile[e]),        // ドラ表示牌の配列
        fubaopai:       null,       // 裏ドラ表示牌の配列
        hupai: {
            lizhi:      null,      // 立直なし0, 立直1, ダブリー2
            yifa:       false,  // 一発
            qianggang:  false,  // 槍槓
            lingshang:  false,  // 嶺上
            haidi:      field_info.haidi,    // 0: ハイテイなし、1: ハイテイツモ、2: ハイテイロン  FIXME
            tianhu:     field_info.tianhu,   // 0: 天和/地和なし、1: 天和、2: 地和   FIXME
        },
        jicun: {
            changbang:  field_info.changbang,    // 積み棒の本数
            lizhibang:  field_info.lizhibang,    // 立直棒の本数   // FIXME
        }
    }
    let discard = (id2tile[mydiscard].length < 3)? id2tile[mydiscard]: (id2tile[mydiscard][0] + "0");
    discard = discard + ["","-","=","+"][from_who];
    const ret = Majiang.Util.hule(convert2Majiang(myhands, mymelds, null), discard, obj);
    return ret != undefined && ret.defen != 0;
}

// ツモあがりできるかチェックする  handsはtsumoを既に含んでいる
exports.canTsumo = function(hands, melds, tsumo, field_info){
    let obj = {
        rule:           Majiang.rule(),
        zhuangfeng:     field_info.zhuangfeng,      // 場風
        menfeng:        field_info.menfeng,      // 自風
        baopai:         field_info.baopai.map(e=>id2tile[e]),        // ドラ表示牌の配列
        fubaopai:       null,       // 裏ドラ表示牌の配列
        hupai: {
            lizhi:      null,      // 立直なし0, 立直1, ダブリー2
            yifa:       false,  // 一発
            qianggang:  false,  // 槍槓
            lingshang:  false,  // 嶺上
            haidi:      field_info.haidi,    // 0: ハイテイなし、1: ハイテイツモ、2: ハイテイロン  FIXME
            tianhu:     field_info.tianhu,   // 0: 天和/地和なし、1: 天和、2: 地和   FIXME
        },
        jicun: {
            changbang:  field_info.changbang,    // 積み棒の本数
            lizhibang:  field_info.lizhibang,    // 立直棒の本数   // FIXME
        }
    }
    const ret = Majiang.Util.hule(convert2Majiang(hands, melds, tsumo), null, obj);
    return ret != undefined && ret.defen != 0;
}


